"use strict";

const coinTicker = require('coin-ticker');
const TRY_INSTEAD = [
    'I asked a hooker if she accepted bitcoin. She told me no because it goes up and down more than she does.',
    'Nah breh shits too high!',
    'Maybe if you win the ship this year...',
    'Nah you crazy bro.',
    'Nah, even we robots know its a bubble.',
    'Only if they put pussy on the blockchain.'
]
exports.run = function(message, cb){

    if(message.trim().toLowerCase() === 'buy'){
        cb(TRY_INSTEAD[Math.floor(Math.random() * TRY_INSTEAD.length)])
    }else{
        coinTicker('kraken', 'BTC_USD')
        .then(function(tick){
            var m = 'BTC PRICE: $' + tick.last + ' 🤑\n' +
                'LOW (24h): $'+ tick.low + '\n' +
                'HIGH (24h): $'+ tick.high + '\n'
                // +'Prices provided by Kraken. 💸';
            cb(m);
        })
    }
}