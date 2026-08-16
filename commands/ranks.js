var request = require('request')

var rePlayer = /\"[a-zA-Z.' -]*\"/i;
var reMatchup = /(vs.|at)\s*[A-Z]*/

const MAX_RANKINGS = 15;

// Balanced Telegram/reply keyboard: weekly + ROS share columns, specialties last.
// Previous 4/3/4 layout (FLX/DST/K in the middle) made the grid look staggered.
const RANKS_KEYBOARD = [
    ['QB', 'RB', 'WR', 'TE'],
    ['ROS QB', 'ROS RB', 'ROS WR', 'ROS TE'],
    ['FLX', 'DST', 'K']
];

const PICKER_MESSAGE = 'Fantasy rankings\nPick a position:';
const PICKER_MESSAGE_TEXT =
    PICKER_MESSAGE + '\n' +
    'Weekly: QB, RB, WR, TE, FLX, DST, K\n' +
    'ROS: ROS QB, ROS RB, ROS WR, ROS TE\n' +
    'Example: /ranks qb   or   /ranks ros wr';

const PPR_POSITIONS = { rb: true, wr: true, te: true, flex: true, flx: true };
const STANDARD_POSITIONS = { qb: true, dst: true, def: true, k: true, kicker: true };

function normalizePosition(raw) {
    if (!raw) return null;
    var p = String(raw).toLowerCase().trim();
    if (p === 'flx') return 'flex';
    if (p === 'def') return 'dst';
    if (p === 'kicker') return 'k';
    return p;
}

function parseRanksQuery(message) {
    var parts = String(message || '').trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) {
        return { showPicker: true };
    }

    var first = parts[0].toLowerCase();
    var second = parts[1] ? parts[1].toLowerCase() : '';

    // Bare /ranks (GroupMe passes the command when there is no arg)
    if (first === '/ranks' && !second) {
        return { showPicker: true };
    }

    // "ROS QB" / "ros-qb" style from keyboard buttons
    if (first === 'ros' && second) {
        return { position: normalizePosition(second), ros: true };
    }
    if (first.indexOf('ros-') === 0) {
        return { position: normalizePosition(first.slice(4)), ros: true };
    }
    if (first.indexOf('ros') === 0 && first.length > 3 && first.charAt(3) !== '-') {
        // e.g. unlikely "rosqb" — ignore
    }

    // "QB ROS" style
    var position = normalizePosition(first);
    var ros = second === 'ros';

    if (!PPR_POSITIONS[position] && !STANDARD_POSITIONS[position]) {
        return { error: 'Ranks not available for: ' + first + '. Please enter qb, rb, wr, te, flex, dst, or k' };
    }

    return { position: position, ros: ros };
}

function buildUrl(position, ros) {
    if (position === 'qb') {
        return ros
            ? 'https://www.fantasypros.com/nfl/rankings/ros-qb.php'
            : 'https://www.fantasypros.com/nfl/rankings/qb.php';
    }
    if (position === 'dst') {
        return ros
            ? 'https://www.fantasypros.com/nfl/rankings/ros-dst.php'
            : 'https://www.fantasypros.com/nfl/rankings/dst.php';
    }
    if (position === 'k') {
        return ros
            ? 'https://www.fantasypros.com/nfl/rankings/ros-k.php'
            : 'https://www.fantasypros.com/nfl/rankings/k.php';
    }
    // rb / wr / te / flex — half-PPR
    return ros
        ? 'https://www.fantasypros.com/nfl/rankings/ros-half-point-ppr-' + position + '.php'
        : 'https://www.fantasypros.com/nfl/rankings/half-point-ppr-' + position + '.php';
}

function scrapeRankings(body, position) {
    var result = '';
    var playerCount = 0;

    // Modern FantasyPros pages embed consensus ranks in `var ecrData = {...};`
    var ecrMatch = /var ecrData\s*=\s*(\{[\s\S]*?\});/.exec(body);
    if (ecrMatch) {
        try {
            var ecrData = JSON.parse(ecrMatch[1]);
            var players = ecrData.players || [];
            for (var j = 0; j < players.length && playerCount < MAX_RANKINGS; j++) {
                playerCount++;
                var p = players[j];
                var line = playerCount + ') ' + (p.player_name || 'Unknown');
                if (p.player_opponent) {
                    line += ' ' + p.player_opponent;
                }
                result += line + '\n';
            }
            return { text: result, count: playerCount };
        } catch (e) {
            console.log('Failed to parse ecrData, falling back to HTML scrape', e);
        }
    }

    // Legacy fallback (older FantasyPros markup)
    var lines = body.split('\n');
    for (var i = 0; i < lines.length; i++) {
        if (lines[i].indexOf('fp-player-name=') > -1) {
            playerCount++;
            var player = lines[i].match(rePlayer);
            var vs;
            if (position === 'flex') {
                vs = reMatchup.exec(lines[i + 2]);
            } else {
                vs = reMatchup.exec(lines[i + 1]);
            }
            var a = playerCount + ') ' + player;
            if (vs) {
                a += ' ' + vs[0];
            }
            a = a.replace(/\"/g, '');
            result += a + '\n';
            if (playerCount >= MAX_RANKINGS) {
                break;
            }
        }
    }

    return { text: result, count: playerCount };
}

function ranksKeyboardMarkup() {
    return {
        keyboard: RANKS_KEYBOARD,
        resize_keyboard: true,
        one_time_keyboard: true
    };
}

exports.RANKS_KEYBOARD = RANKS_KEYBOARD;
exports.PICKER_MESSAGE = PICKER_MESSAGE;
exports.ranksKeyboardMarkup = ranksKeyboardMarkup;

exports.run = function(message, cb) {
    var parsed = parseRanksQuery(message);

    if (parsed.showPicker) {
        // Telegram gets the reply keyboard; GroupMe/other get a text menu.
        cb(PICKER_MESSAGE, {
            reply_markup: ranksKeyboardMarkup(),
            textFallback: PICKER_MESSAGE_TEXT
        });
        return;
    }

    if (parsed.error) {
        cb(parsed.error, { reply_markup: ranksKeyboardMarkup() });
        return;
    }

    var position = parsed.position;
    var ros = parsed.ros;
    var URL = buildUrl(position, ros);

    console.log('HITTING URL:' + URL);
    request(URL, function(error, response, body) {
        console.log(error);
        if (error || !body) {
            cb('Sorry, could not fetch rankings right now. Try again in a bit.');
            return;
        }

        var scraped = scrapeRankings(body, position);
        if (scraped.count === 0) {
            cb('No rankings found for ' + position.toUpperCase() + '. The source page may have changed.');
            return;
        }

        var header = ros ? 'Rest of Season Rankings\n' : 'Weekly Rankings\n';
        cb(header + scraped.text);
    });
};
