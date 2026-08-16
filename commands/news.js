const allioConfig = require('../allioConfig.json');
const stantonConfig = require('../stantonConfig.json');
const request = require('request');

const NO_NEWS = ['arin', 'a-ray', 'aray', 'a~ray'];
const TRY_INSTEAD = [
    'Did you try looking in the trash? 🗑️',
    'Try asking your girl.',
    'Try Googling it.',
    'Did you check Reddit?',
    'There must not be anything going on.',
    'He\'s probably trying to stay low-key.',
    'I last heard he was chilling with Zeke. 👊👊',
    'Sounds like you\'ll be taking another L this week. 📉',
    'Maybe he died? 💀'
];

function pickRandom(list) {
    return list[Math.floor(Math.random() * list.length)];
}

function formatArticle(article) {
    var title = article.title || '';
    var description = article.description || article.content || '';
    var url = article.url || '';
    var source = (article.source && article.source.name) ? article.source.name : '';
    var parts = [];

    if (title) {
        parts.push(title);
    }
    if (description && description !== title) {
        parts.push(description);
    }
    if (source) {
        parts.push(source);
    }
    if (url) {
        parts.push(url);
    }

    return parts.join('\n');
}

function queryMatchesText(query, text) {
    if (!text) {
        return false;
    }
    // Prefer whole-word matches so "apple" does not hit "Rappleyea"
    var escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    var wordMatch = new RegExp('\\b' + escaped + '\\b', 'i');
    if (wordMatch.test(text)) {
        return true;
    }
    // Multi-word queries can still use a plain substring check
    if (query.indexOf(' ') > -1 && text.toLowerCase().indexOf(query) > -1) {
        return true;
    }
    return false;
}

function searchNewsApi(endpoint, qs, cb) {
    request({
        uri: 'https://newsapi.org/v2/' + endpoint,
        qs: qs,
        method: 'GET',
        json: true,
        timeout: 10000
    }, function (err, res, body) {
        if (err || !body || body.status !== 'ok' || !Array.isArray(body.articles)) {
            cb(null, []);
            return;
        }
        cb(null, body.articles.filter(function (article) {
            return article && (article.title || article.description);
        }));
    });
}

function searchGeneralNews(newsQuery, cb) {
    var apiKey = stantonConfig.NEWS_API_KEY;
    var sources = (allioConfig.NEWS_SOURCES || []).filter(function (source, index, list) {
        return list.indexOf(source) === index;
    }).join(',');

    // Keyword search across NewsAPI first for general coverage
    searchNewsApi('everything', {
        q: newsQuery,
        language: 'en',
        sortBy: 'publishedAt',
        pageSize: 20,
        apiKey: apiKey
    }, function (err, everythingArticles) {
        if (everythingArticles && everythingArticles.length) {
            cb(null, everythingArticles);
            return;
        }

        // Top headlines matching the query (broader general news)
        searchNewsApi('top-headlines', {
            q: newsQuery,
            language: 'en',
            pageSize: 20,
            apiKey: apiKey
        }, function (err2, headlineArticles) {
            if (headlineArticles && headlineArticles.length) {
                cb(null, headlineArticles);
                return;
            }

            // Fall back to configured sources' latest headlines, then filter locally
            if (!sources) {
                cb(null, []);
                return;
            }

            searchNewsApi('top-headlines', {
                sources: sources,
                pageSize: 100,
                apiKey: apiKey
            }, function (err3, sourceArticles) {
                var matches = (sourceArticles || []).filter(function (article) {
                    return queryMatchesText(newsQuery, article.title) ||
                        queryMatchesText(newsQuery, article.description) ||
                        queryMatchesText(newsQuery, article.content);
                });
                cb(null, matches);
            });
        });
    });
}

function searchFantasyNews(newsQuery, cb) {
    request('http://www.fantasylabs.com/api/players/news/1/?showAll=true', function (error, response, body) {
        if (!error) {
            try {
                var players = JSON.parse(body);
                for (var i = 0; i < players.length; i++) {
                    if (queryMatchesText(newsQuery, players[i].PlayerName)) {
                        cb(players[i].Title + '\n' + players[i].News);
                        return;
                    }
                }
            } catch (parseErr) {
                // Continue to FantasyPros
            }
        }

        request({
            headers: {
                'x-api-key': 'eTMcJIVFE84VH6CBJ5aLV6uLULsVdNUa9Hu6Iu6S'
            },
            uri: 'https://api.fantasypros.com/public/v2/json/NFL/news?limit=100',
            method: 'GET'
        }, function (err, res, fantasyBody) {
            if (!err) {
                try {
                    var items = JSON.parse(fantasyBody).items || [];
                    for (var i = 0; i < items.length; i++) {
                        if (queryMatchesText(newsQuery, items[i].title) ||
                            queryMatchesText(newsQuery, items[i].desc)) {
                            cb(items[i].title + '\n' + items[i].desc);
                            return;
                        }
                    }
                } catch (parseErr) {
                    // Fall through to no-news response
                }
            }

            cb('No news found for ' + newsQuery + '. ' + pickRandom(TRY_INSTEAD));
        });
    });
}

exports.run = function (newsQuery, cb) {
    newsQuery = (newsQuery || '').toLowerCase().trim();
    console.log('Looking for news:' + newsQuery);

    if (!newsQuery) {
        return;
    }

    for (var i = 0; i < NO_NEWS.length; i++) {
        if (newsQuery.indexOf(NO_NEWS[i]) > -1) {
            cb('Arin (also known as rapper A~Ray) will be dropping his FIRE mixtape Back Where It All Started this year. Sign up here: http://arinray.me/rap');
            return;
        }
    }

    console.log('Searching general news for: ' + newsQuery);
    searchGeneralNews(newsQuery, function (err, articles) {
        if (articles && articles.length) {
            var article = pickRandom(articles);
            cb(formatArticle(article));
            return;
        }

        // Keep fantasy/sports as a secondary fallback for player queries
        console.log('No general news found, checking fantasy sources for: ' + newsQuery);
        searchFantasyNews(newsQuery, cb);
    });
};
