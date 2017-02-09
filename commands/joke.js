const joke = require('jokesearch');

exports.answer = function(cb){
    joke.getJoke(function(joke){
        cb( joke);
    });
}