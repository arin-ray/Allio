const allioConfig = require('../allioConfig.json');
const stantonConfig = require('../stantonConfig.json');
const NewsAPI = require('newsapi');
const newsapi = new NewsAPI(stantonConfig.NEWS_API_KEY);
const async = require('async');
const request = require('request');
const NO_NEWS = ['arin', 'a-ray', 'aray', 'a~ray']
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
]
var CALLBACK_FIRED = false;

function mapNews(source, cb) {
    newsapi.articles({
        source: source,
    }).then(articlesResponse => {
        if (articlesResponse.status == 'ok') {
            cb(null, articlesResponse.articles);
        } else {
            cb(null, [])
        }
    });
}

exports.run = function (newsQuery, cb) {
    var sources = allioConfig.NEWS_SOURCES;
    var newsDict = [];
    newsQuery = newsQuery.toLowerCase();
    console.log("Looking for news:"+newsQuery)
    if (newsQuery.trim() != "") {
        //Check for buzzwords
        for (var i = 0; i < NO_NEWS.length; i++) {
            if (newsQuery.toLowerCase().indexOf(NO_NEWS[i]) > -1) {
                CALLBACK_FIRED = true;
                cb("Arin (also known as rapper A~Ray) will be dropping his FIRE mixtape Back Where It All Started this year. Sign up here: http://arinray.me/rap")
            }
        }


        if (!CALLBACK_FIRED) {

            console.log('Mapping news query to sources: ' + newsQuery)
            async.map(sources, mapNews, function (err, results) {
                console.log('Map Results')

                //console.log(results)
                for (var i = 0; i < results.length; i++) {
                    // console.log(results[i])
                    for (var j = 0; j < results[i].length; j++) {
                        //console.log(results[i][j]);
                        if (results[i][j].description != null) {
                            if (results[i][j].title.toLowerCase().indexOf(newsQuery) > -1
                                || results[i][j].description.toLowerCase().indexOf(newsQuery) > -1) {

                                newsDict.push({ news: results[i][j].description, url: results[i][j].url });
                            }
                        }
                    }
                }
                //console.log("Checking for news")
                //console.log(newsDict);
                if (newsDict.length == 0) {
                    // Hit fantasy news API
                    request("http://www.fantasylabs.com/api/players/news/1/?showAll=true", function (error, response, body) {
                        if(error){
                            cb('Error fetching news.');
                        }else{
                            var b = JSON.parse(body);
                            var res;
                            var found = false;
                            for(var i=0;i<b.length;i++){
                                //console.log(b[i].PlayerName);
                                if(b[i].PlayerName.toLowerCase().indexOf(newsQuery) > -1){
                                    //cb()
                                    res = b[i].Title + '\n'+b[i].News;
                                    found = true;
                                    cb(res);
                                    break;
                                }
                            }
                            // Last Source
                            if (!found) {
                                request({
                                    headers: {
                                      'x-api-key': 'eTMcJIVFE84VH6CBJ5aLV6uLULsVdNUa9Hu6Iu6S'
                                    },
                                    uri: 'https://api.fantasypros.com/public/v2/json/NFL/news?limit=100',
                                    method: 'GET'
                                  }, function (err, res, body) {
                                        if(err){
                                            console.log(err)
                                        }else{
                                            var items = JSON.parse(body).items
                                            //console.log(JSON.parse(body))
                                            for(var i=0;i<items.length;i++){
                                                if(items[i].title.toLowerCase().indexOf(newsQuery) > -1){
                                                    res = items[i].title + '\n'+items[i].desc;
                                                    found = true;
                                                    cb(res);
                                                    break;
                                                }                                               //console.log(items[i].title)
                                            }
                                            
                                            if(!found){
                                                cb('No news found for '+newsQuery+'. '+TRY_INSTEAD[Math.floor(Math.random() * TRY_INSTEAD.length)])
                                            }
                                        }
                                  });
                            }
                            
                        }

                    });

                } else {
                    var random_news = newsDict[Math.floor(Math.random() * newsDict.length)];
                    cb(random_news.news + "\n" + random_news.url);
                }
            });
        }
    }
}
