const yahooFinance = require('yahoo-finance');
const GREAT_BUYS = ['Pandora','Apple','Google','Gold ','Amazon','Alphabet']

exports.run = function(symbol, cb){
  yahooFinance.snapshot({
    symbol: symbol,
    fields: ['n', 'p2','l1','m3'],
  }, 
  function (err, snapshot) {
    console.log('Stock Snapshot');
    console.log(snapshot);
    if(snapshot.name == null ){
      cb("Please enter a valid ticker symbol.")
    }else{
      var message = snapshot.name+'\n';
      if(snapshot.changeInPercent > 0){
  message += "Up "+(snapshot.changeInPercent*100).toFixed(2)+"% today to $"+(snapshot.lastTradePriceOnly).toFixed(2)+"📈"
      }else{
  message += "Down "+(snapshot.changeInPercent*100).toFixed(2)+"% today to $"+(snapshot.lastTradePriceOnly).toFixed(2)+"📉"
      }
      if(snapshot['50DayMovingAverage']){
        message+='\n50 Day Avg: $'+snapshot['50DayMovingAverage']
      }

      // Check for great buy
      for(var i=0;i<GREAT_BUYS.length;i++){
        if(message.indexOf(GREAT_BUYS[i]) > -1){
            message += '\nWhat a great buy!'
        }
      }
      cb(message);
    }
 });
 
}