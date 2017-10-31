const insultgenerator = require('insultgenerator');
const DO_NOT_INSULT = ['arin','a-ray','aray','allio']
const request = require('request')
const MASTER = [
        "I can't insult my creator.",
        "Naaah.",
        "Nah we good.",
        "Nope.",
        "Sorry brah",
        "Boss told me not to talk back.",
        "Sorry, not trying to get thrown in Arin's recycle bin.",
        "Maybe if you had a decent fantasy team."
    ]
var re = /^[a-zA-Z '.]+/

var CALLBACK_FIRED = false;
exports.run = function(message, cb){
    console.log('Running Roast Module')
    // Check who is being insulted
    for(var i=0;i<DO_NOT_INSULT.length;i++){
        if(message.toLowerCase().indexOf(DO_NOT_INSULT[i]) > -1){
            CALLBACK_FIRED = true;
            console.log('DO NOT INSULT: '+DO_NOT_INSULT[i]);
            cb( MASTER[Math.floor(Math.random() * MASTER.length) ])
        }
    }

    if(!CALLBACK_FIRED){
        request("http://wholethrower119.com/API/Insults.php",function( error, response, body ){
            
            var lines = body.split('\n');
            var insult = lines[4];
            insult = insult.charAt(0).toLowerCase() + insult.slice(1);
            cb(message.charAt(0).toUpperCase() + message.slice(1)+', '+insult);
        });
    }
}       