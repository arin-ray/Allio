const GREAT_BUYS = ['Pandora','Apple','Google','Gold ','Amazon','Alphabet']
const request = require('request');

  



exports.run = function(symbol, cb){
  var stockURL = "https://api.iextrading.com/1.0/stock/" + symbol + "/quote"
  var message = ''
  request(stockURL, function (error, response, body) { 
    console.log(body);
    body = JSON.parse(body)
    if(body === 'Unknown Symbol'){
      cb("Please enter a valid ticker symbol.")
    }else{
      message = body.companyName + '\n';
      if(body.changePercent > 0){
        message += "Up "+(body.changePercent*100).toFixed(2)
        +"% today to $"+(body.latestPrice).toFixed(2)+"📈"
      }else{
        console.log(body.changePercent)
        console.log(body.latestPrice)
        message += "Down "+(body.changePercent*100).toFixed(2)
        +"% today to $"+(body.latestPrice).toFixed(2)+"📉"        
      }
    }
    cb(message)
  })

//   yahooFinance.snapshot({
//     symbol: symbol,
//     fields: ['n', 'p2','l1','m3'],
//   }, 
//   function (err, snapshot) {
//     console.log('Stock Snapshot');
//     console.log(snapshot);
//     if(snapshot.name == null ){
//       cb("Please enter a valid ticker symbol.")
//     }else{
//       var message = snapshot.name+'\n';
//       if(snapshot.changeInPercent > 0){
//   message += "Up "+(snapshot.changeInPercent*100).toFixed(2)+"% today to $"+(snapshot.lastTradePriceOnly).toFixed(2)+"📈"
//       }else{
//   message += "Down "+(snapshot.changeInPercent*100).toFixed(2)+"% today to $"+(snapshot.lastTradePriceOnly).toFixed(2)+"📉"
//       }
//       if(snapshot['50DayMovingAverage']){
//         message+='\n50 Day Avg: $'+snapshot['50DayMovingAverage']
//       }

//       // Check for great buy
//       for(var i=0;i<GREAT_BUYS.length;i++){
//         if(message.indexOf(GREAT_BUYS[i]) > -1){
//             message += '\nWhat a great buy!'
//         }
//       }
//       cb(message);
//     }
//  });
 
}