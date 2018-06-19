"use strict";

const coinTicker = require('coin-ticker');
exports.run = function(message, cb){

        coinTicker('kraken', 'ETH_USD')
        .then(function(tick){
            var m = 'ETH PRICE: $' + tick.last + ' 🤑\n' +
                'LOW (24h): $'+ tick.low + '\n' +
                'HIGH (24h): $'+ tick.high + '\n' +
                'Prices provided by Kraken. 💸';
            cb(m);
        })
    
}