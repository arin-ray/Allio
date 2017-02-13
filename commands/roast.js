const insultgenerator = require('insultgenerator');
const DO_NOT_INSULT = ['arin','a-ray','aray','allio']
const MASTER = [
        "I can't insult my creator.",
        "Naaah.",
        "Nah we good.",
        "Nope.",
        "Sorry brah",
        "Daddy told me not to talk back.",
        "Sorry, not trying to get thrown in Arin's recycle bin."
    ]

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
        insultgenerator(function(insult){
            cb( message+", "+insult );
        });
    }
}       