const joke = require('jokesearch');
exports.run = function(message, cb){
    joke.getJoke(function(joke){
        cb(joke);
    });
}