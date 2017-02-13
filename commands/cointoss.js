exports.run = function(message, cb){
 cb((Math.floor(Math.random() * 2) == 0) ? 'Heads.' : 'Tails.');
}