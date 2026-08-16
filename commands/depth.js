var request = require('request');

var ESPN_DEPTH_URL = 'https://www.espn.com/nfl/team/depth/_/name/';
var PAYLOAD_MARKER = "window['__espnfitt__']=";
var PAYLOAD_END = '};';

// GroupMe silently drops anything past ~1000 characters.
var MAX_MESSAGE_LENGTH = 950;
var DEFAULT_DEPTH = 3;
var POSITION_DEPTH = 6;

var USAGE = 'Usage: /depth <team> [qb|rb|wr|te|off|def|st|all]\n' +
            'Examples: /depth patriots, /depth kc rb, /depth sea def';

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

var VIEWS = {
    skill: 'skill',
    fantasy: 'skill',
    off: 'offense',
    o: 'offense',
    offense: 'offense',
    def: 'defense',
    d: 'defense',
    defense: 'defense',
    st: 'special',
    special: 'special',
    specialteams: 'special',
    kicking: 'special',
    all: 'all',
    full: 'all',
    everything: 'all'
};

// Positions worth showing a fantasy group chat by default.
var SKILL_POSITIONS = ['QB', 'RB', 'WR', 'TE'];

// Shorthand that maps to one or more depth chart row labels.
var POSITION_ALIASES = {
    k: ['PK'],
    kicker: ['PK'],
    punter: ['P'],
    returner: ['PR', 'KR'],
    ol: ['LT', 'LG', 'C', 'RG', 'RT'],
    oline: ['LT', 'LG', 'C', 'RG', 'RT'],
    line: ['LT', 'LG', 'C', 'RG', 'RT'],
    secondary: ['LCB', 'RCB', 'NB', 'SS', 'FS'],
    safety: ['SS', 'FS'],
    corner: ['LCB', 'RCB', 'NB']
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

// Group names vary by scheme ("Base 3-4 D", "Base 4-3 D"), so classify by
// contents rather than by name.
function classify(group) {
    if (/special/i.test(group.name)) {
        return 'special';
    }
    return hasRow(group, 'QB') ? 'offense' : 'defense';
}

function hasRow(group, label) {
    for (var i = 0; i < group.rows.length; i++) {
        if (group.rows[i][0] === label) {
            return true;
        }
    }
    return false;
}

function render(chart, query) {
    var view = normalize(query.view);
    var teamName = (chart.team && chart.team.displayName) || 'NFL';
    var season = seasonLabel(chart);

    if (!view || VIEWS[view] === 'skill') {
        return truncate(teamName + ' Depth Chart' + season + '\n' +
            renderRows(collectRows(chart, isSkillPosition), DEFAULT_DEPTH));
    }

    if (VIEWS[view] === 'all') {
        return truncate(teamName + ' Depth Chart' + season + '\n' + renderAll(chart));
    }

    if (VIEWS[view]) {
        var unit = VIEWS[view];
        var rows = collectRows(chart, null, unit);
        if (!rows.length) {
            return teamName + ' has no ' + unit + ' depth chart posted yet.';
        }
        return truncate(teamName + ' ' + unitName(unit) + season + '\n' +
            renderRows(rows, DEFAULT_DEPTH));
    }

    return renderPosition(chart, view, teamName, season);
}

function renderPosition(chart, view, teamName, season) {
    var labels = POSITION_ALIASES[view];
    var rows = collectRows(chart, function (label) {
        var key = normalize(label);
        return labels ? labels.indexOf(label) > -1 : key === view;
    });

    // Fall back to a partial match so "lb" pulls WLB/SLB/LILB and "cb" pulls
    // LCB/RCB, without needing an entry per scheme.
    if (!rows.length) {
        rows = collectRows(chart, function (label) {
            return normalize(label).indexOf(view) > -1;
        });
    }

    if (!rows.length) {
        return "No \"" + view + '" spot on the ' + teamName + " depth chart.\n" + USAGE;
    }

    var header = teamName + ' ' + view.toUpperCase() + ' Depth' + season + '\n';

    // A lone position reads better stacked than crammed onto one line.
    if (rows.length === 1) {
        var players = rows[0].players.slice(0, POSITION_DEPTH);
        var lines = [];
        for (var i = 0; i < players.length; i++) {
            lines.push((i + 1) + '. ' + playerName(players[i]));
        }
        return truncate(header + lines.join('\n'));
    }

    return truncate(header + renderRows(rows, POSITION_DEPTH));
}

// Every position across all three units only fits in one message at starter
// depth; /depth <team> off|def|st goes deeper on a single unit.
function renderAll(chart) {
    var sections = [];
    var units = ['offense', 'defense', 'special'];

    for (var i = 0; i < units.length; i++) {
        var rows = collectRows(chart, null, units[i]);
        if (rows.length) {
            sections.push(unitName(units[i]) + '\n' + renderStarters(rows));
        }
    }

    return sections.join('\n');
}

function renderStarters(rows) {
    var lines = [];

    for (var i = 0; i < rows.length; i++) {
        lines.push(rows[i].label + ': ' + playerName(rows[i].players[0]));
    }

    return lines.join('\n');
}

function collectRows(chart, matchLabel, unit) {
    var collected = [];

    for (var i = 0; i < chart.dethTeamGroups.length; i++) {
        var group = chart.dethTeamGroups[i];

        if (unit && classify(group) !== unit) {
            continue;
        }

        for (var j = 0; j < group.rows.length; j++) {
            var label = group.rows[j][0];
            var players = group.rows[j].slice(1);

            if (!players.length || (matchLabel && !matchLabel(label))) {
                continue;
            }

            collected.push({ label: label, players: players });
        }
    }

    return numberDuplicates(collected);
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

function isSkillPosition(label) {
    return SKILL_POSITIONS.indexOf(label) > -1;
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

function unitName(unit) {
    if (unit === 'offense') {
        return 'Offense';
    }
    if (unit === 'defense') {
        return 'Defense';
    }
    return 'Special Teams';
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
