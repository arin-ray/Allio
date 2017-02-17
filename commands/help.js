const allioConfig = require('../allioConfig.json');


exports.run = function(message, cb){
    var helpMsg = "Hey I'm Allio! Here's a list of what I can do:\n"
    var COMMANDS = Object.keys(allioConfig.COMMANDS)
    console.log(allioConfig)
    for(var i=0;i<COMMANDS.length;i++){
        helpMsg += COMMANDS[i]+'\n';
    }
    cb(helpMsg);
}