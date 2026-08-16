var request = require('request');

var ESPN_DEPTH_URL = 'https://www.espn.com/nfl/team/depth/_/name/';
var PAYLOAD_MARKER = "window['__espnfitt__']=";
var PAYLOAD_END = '};';

// GroupMe silently drops anything past ~1000 characters.
var MAX_MESSAGE_LENGTH = 950;
var DEFAULT_DEPTH = 3;
var FLEX_DEPTH = 4;
var POSITION_DEPTH = 6;

var USAGE = 'Usage: /depth <team> [qb|rb|wr|te|k|flex]\n' +
            'Examples: /depth patriots, /depth kc rb, /depth sea flex';

// [ espn slug, location, nickname, extra aliases ]
var TEAMS = [
    ['ari', 'Arizona', 'Cardinals', ['az', 'cards']],
    ['atl', 'Atlanta', 'Falcons', ['dirty birds']],
    ['bal', 'Baltimore', 'Ravens', []],
    ['buf', 'Buffalo', 'Bills', ['mafia']],
    ['car', 'Carolina', 'Panthers', ['cats']],
    ['chi', 'Chicago', 'Bears', ['da bears']],
    ['cin', 'Cincinnati', 'Bengals', ['cincy']],
    ['cle', 'Cleveland', 'Browns', []],
    ['dal', 'Dallas', 'Cowboys', ['boys']],
    ['den', 'Denver', 'Broncos', []],
    ['det', 'Detroit', 'Lions', []],
    ['gb', 'Green Bay', 'Packers', ['gnb', 'pack', 'cheeseheads']],
    ['hou', 'Houston', 'Texans', []],
    ['ind', 'Indianapolis', 'Colts', ['indy']],
    ['jax', 'Jacksonville', 'Jaguars', ['jac', 'jags']],
    ['kc', 'Kansas City', 'Chiefs', ['kan']],
    ['lv', 'Las Vegas', 'Raiders', ['oak', 'oakland', 'vegas']],
    ['lac', 'Los Angeles', 'Chargers', ['sd', 'san diego', 'bolts']],
    ['lar', 'Los Angeles', 'Rams', ['stl', 'st louis']],
    ['mia', 'Miami', 'Dolphins', ['fins', 'phins']],
    ['min', 'Minnesota', 'Vikings', ['vikes']],
    ['ne', 'New England', 'Patriots', ['nwe', 'pats']],
    ['no', 'New Orleans', 'Saints', ['nor', 'nola']],
    ['nyg', 'New York', 'Giants', ['gmen']],
    ['nyj', 'New York', 'Jets', ['gang green']],
    ['phi', 'Philadelphia', 'Eagles', ['philly', 'birds']],
    ['pit', 'Pittsburgh', 'Steelers', ['pgh']],
    ['sf', 'San Francisco', '49ers', ['sfo', 'niners', 'forty niners']],
    ['sea', 'Seattle', 'Seahawks', ['hawks']],
    ['tb', 'Tampa Bay', 'Buccaneers', ['tam', 'tampa', 'bucs']],
    ['ten', 'Tennessee', 'Titans', ['tenn']],
    ['wsh', 'Washington', 'Commanders', ['was', 'wft']]
];

// ESPN row labels that score in fantasy, in the order they should print.
// Defense only matters as a team unit, so individual defenders are skipped.
var FANTASY_POSITIONS = ['QB', 'RB', 'WR', 'TE', 'PK'];
var FLEX_POSITIONS = ['RB', 'WR', 'TE'];

// ESPN calls the kicker PK; a fantasy chat calls it K.
var DISPLAY_LABELS = { PK: 'K' };

var POSITION_QUERIES = {
    qb: ['QB'],
    quarterback: ['QB'],
    rb: ['RB'],
    hb: ['RB'],
    back: ['RB'],
    backs: ['RB'],
    runningback: ['RB'],
    runningbacks: ['RB'],
    wr: ['WR'],
    wideout: ['WR'],
    wideouts: ['WR'],
    receiver: ['WR'],
    receivers: ['WR'],
    widereceiver: ['WR'],
    te: ['TE'],
    tightend: ['TE'],
    tightends: ['TE'],
    k: ['PK'],
    pk: ['PK'],
    kicker: ['PK'],
    flex: FLEX_POSITIONS,
    skill: FANTASY_POSITIONS,
    all: FANTASY_POSITIONS
};

var ALIASES = buildAliases();

exports.run = function (message, cb) {
    var query = parseQuery(message);

    if (!query.team) {
        cb(query.error || USAGE);
        return;
    }

    fetchDepthChart(query.team.slug, function (error, chart) {
        if (error) {
            cb(error);
            return;
        }
        cb(render(chart, query));
    });
};

function buildAliases() {
    var aliases = {};

    for (var i = 0; i < TEAMS.length; i++) {
        var slug = TEAMS[i][0];
        var location = TEAMS[i][1];
        var nickname = TEAMS[i][2];
        var extras = TEAMS[i][3];
        var team = { slug: slug, name: location + ' ' + nickname };
        var keys = [slug, nickname, location + ' ' + nickname].concat(extras);

        // Both New York and Los Angeles teams share a location, so the bare
        // city name is ambiguous and is deliberately left unmapped.
        if (location !== 'New York' && location !== 'Los Angeles') {
            keys.push(location);
        }

        for (var j = 0; j < keys.length; j++) {
            aliases[normalize(keys[j])] = team;
        }
    }

    return aliases;
}

function normalize(text) {
    return String(text).toLowerCase().replace(/[^a-z0-9]/g, '');
}

// app.js hands the module everything after the first space, which means a bare
// "/depth" arrives as the command itself rather than an empty string.
function parseQuery(message) {
    var text = String(message || '').trim();

    if (!text || text.charAt(0) === '/') {
        return { team: null };
    }

    var words = text.split(/\s+/);

    // Team names run up to three words ("New England Patriots"), so match the
    // longest prefix that resolves and treat whatever is left as the view.
    for (var size = Math.min(3, words.length); size > 0; size--) {
        var team = ALIASES[normalize(words.slice(0, size).join(' '))];
        if (team) {
            return { team: team, view: words.slice(size).join(' ') };
        }
    }

    return {
        team: null,
        error: "Don't know a team called \"" + text.split(/\s+/)[0] + '".\n' + USAGE
    };
}

function fetchDepthChart(slug, cb) {
    var options = {
        uri: ESPN_DEPTH_URL + slug,
        method: 'GET',
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Allio)' }
    };

    request(options, function (error, response, body) {
        if (error || !response || response.statusCode !== 200) {
            console.error('Depth chart request failed for ' + slug, error);
            cb("Couldn't reach ESPN for that depth chart. Try again in a bit.");
            return;
        }

        var chart = extractDepthChart(body);
        if (!chart) {
            cb("Couldn't read ESPN's depth chart. They may have changed the page.");
            return;
        }

        cb(null, chart);
    });
}

// The depth chart is only rendered client side, so pull it out of the state
// blob ESPN embeds in the page instead of scraping the markup.
function extractDepthChart(body) {
    var start = String(body).indexOf(PAYLOAD_MARKER);
    if (start === -1) {
        return null;
    }

    var payload = String(body).substring(start + PAYLOAD_MARKER.length);
    var end = payload.indexOf(PAYLOAD_END + '</script>');
    if (end === -1) {
        return null;
    }

    try {
        var depth = JSON.parse(payload.substring(0, end + 1)).page.content.depth;
        return depth && depth.dethTeamGroups ? depth : null;
    } catch (e) {
        console.error('Unable to parse ESPN depth chart payload', e);
        return null;
    }
}

function render(chart, query) {
    var view = normalize(query.view);
    var teamName = (chart.team && chart.team.displayName) || 'NFL';
    var season = seasonLabel(chart);

    if (!view) {
        return truncate(teamName + ' Depth Chart' + season + '\n' +
            renderRows(collectRows(chart, FANTASY_POSITIONS), DEFAULT_DEPTH));
    }

    var positions = POSITION_QUERIES[view];
    if (!positions) {
        return "I only track fantasy spots, so I've got nothing for \"" + query.view.trim() +
            '".\n' + USAGE;
    }

    var rows = collectRows(chart, positions);
    if (!rows.length) {
        return teamName + ' has no ' + view.toUpperCase() + ' listed yet.';
    }

    var header = teamName + ' ' + viewName(view) + season + '\n';
    var depth = viewDepth(view);

    // A lone position reads better stacked than crammed onto one line.
    if (rows.length === 1) {
        var players = rows[0].players.slice(0, depth);
        var lines = [];
        for (var i = 0; i < players.length; i++) {
            lines.push((i + 1) + '. ' + playerName(players[i]));
        }
        return truncate(header + lines.join('\n'));
    }

    return truncate(header + renderRows(rows, depth));
}

// Walk the requested labels in order rather than in ESPN's page order so the
// output always reads QB, RB, WR, TE, K. The kicker lives in a different group
// than the rest, so every group gets scanned for each label.
function collectRows(chart, labels) {
    var collected = [];

    for (var i = 0; i < labels.length; i++) {
        var matches = [];

        for (var j = 0; j < chart.dethTeamGroups.length; j++) {
            var rows = chart.dethTeamGroups[j].rows;

            for (var k = 0; k < rows.length; k++) {
                if (rows[k][0] !== labels[i] || rows[k].length < 2) {
                    continue;
                }
                matches.push({
                    label: DISPLAY_LABELS[labels[i]] || labels[i],
                    players: rows[k].slice(1)
                });
            }
        }

        collected = collected.concat(numberDuplicates(matches));
    }

    return collected;
}

// ESPN lists three separate WR rows; number them so WR1/WR2/WR3 stay distinct.
function numberDuplicates(rows) {
    var counts = {};
    var seen = {};
    var i;

    for (i = 0; i < rows.length; i++) {
        counts[rows[i].label] = (counts[rows[i].label] || 0) + 1;
    }

    for (i = 0; i < rows.length; i++) {
        var label = rows[i].label;
        if (counts[label] > 1) {
            seen[label] = (seen[label] || 0) + 1;
            rows[i].label = label + seen[label];
        }
    }

    return rows;
}

function renderRows(rows, depth) {
    var lines = [];

    for (var i = 0; i < rows.length; i++) {
        var players = rows[i].players.slice(0, depth);
        var names = [];

        for (var j = 0; j < players.length; j++) {
            names.push((j + 1) + '. ' + playerName(players[j]));
        }

        lines.push(rows[i].label + ': ' + names.join('  '));
    }

    return lines.join('\n');
}

function playerName(player) {
    if (!player) {
        return 'TBD';
    }

    var name = player.name || player.displayName || player.shortName || 'TBD';

    if (player.injuries && player.injuries.length) {
        name += ' (' + player.injuries.join('/') + ')';
    }

    return name;
}

// Asking for one position means you want to see past the starters; asking for
// several means the message has to stay readable.
function viewDepth(view) {
    if (view === 'all' || view === 'skill') {
        return DEFAULT_DEPTH;
    }
    if (view === 'flex') {
        return FLEX_DEPTH;
    }
    return POSITION_DEPTH;
}

function viewName(view) {
    if (view === 'flex') {
        return 'Flex Depth';
    }
    if (view === 'all' || view === 'skill') {
        return 'Depth Chart';
    }

    var label = POSITION_QUERIES[view][0];
    return (DISPLAY_LABELS[label] || label) + ' Depth';
}

function seasonLabel(chart) {
    var meta = chart.metadata;
    if (!meta || !meta.seasonSummary) {
        return '';
    }
    return ' (' + meta.seasonSummary + (meta.name ? ' ' + meta.name : '') + ')';
}

function truncate(message) {
    if (message.length <= MAX_MESSAGE_LENGTH) {
        return message;
    }

    var clipped = message.substring(0, MAX_MESSAGE_LENGTH);
    return clipped.substring(0, clipped.lastIndexOf('\n')) + '\n...';
}
