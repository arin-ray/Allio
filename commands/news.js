const config = require('../stantonConfig.json');
const NewsAPI = require('newsapi');
const newsapi = new NewsAPI(config.NEWS_API_KEY);
const async = require('async');
const NO_NEWS = ['arin','a-ray','aray','a~ray']
var CALLBACK_FIRED = false;
function mapNews(source, cb){
      newsapi.articles({
        source: source,
      }).then(articlesResponse => {
        if(articlesResponse.status == 'ok'){
            cb(null,  articlesResponse.articles);
        }else{
            cb(null, [])
        }
      });
}

exports.run = function ( newsQuery, cb ){
    var sources = config.NEWS_SOURCES;
    var newsDict = [];
    newsQuery = newsQuery.toLowerCase();

    if(newsQuery.trim() != ""){
        //Check for buzzwords
        for(var i=0;i<NO_NEWS.length;i++){
            if(newsQuery.toLowerCase().indexOf(NO_NEWS[i]) > -1){
                CALLBACK_FIRED = true;
                cb("Arin (also known as rapper A~Ray) will be dropping his FIRE mixtape Back Where It All Started this year. Sign up here: http://arinray.me/rap")
            }
        }
        if(!CALLBACK_FIRED){

            console.log('Mapping news query to sources: '+newsQuery)
                async.map(sources, mapNews, function(err, results) {
                        console.log('Map Results')

            //console.log(results)
                for(var i=0;i<results.length;i++){
                // console.log(results[i])
                    for(var j=0;j<results[i].length;j++){
                    console.log(results[i][j]);
                        if(results[i][j].title.toLowerCase().indexOf(newsQuery) > -1 
                        || results[i][j].description.toLowerCase().indexOf(newsQuery) > -1 ){
                            newsDict.push({news: results[i][j].description, url: results[i][j].url});
                        }
                    }
                }
                if(newsDict.length==0){
                    cb("Sorry no news found for "+newsQuery);
                }else{
                    var random_news = newsDict[Math.floor(Math.random() * newsDict.length) ];
                    cb(random_news.news+"\n"+random_news.url);
                }
            });
        }
    }
}
