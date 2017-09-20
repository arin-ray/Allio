var request = require('request')

var rePlayer = /\"[a-zA-Z.']* [a-zA-Z.']*\"/i;
var reMatchup = /(vs.|at)\s*[A-Z]*/

const MAX_RANKINGS = 15;

exports.run = function(message, cb){
    var URL = "";
    var result = ''
    var m = message.split(' ')[0].toLowerCase();
    var playerCount = 0;

    if(m == 'qb'){
        URL = 'https://www.fantasypros.com/nfl/rankings/qb.php'
    }else if(m == 'wr' || m == 'rb'|| m == 'te'){
        URL = 'https://www.fantasypros.com/nfl/rankings/half-point-ppr-'+m+'.php'
    }

    request(URL,function( error, response, body ){

        var lines = body.split('\n');
        for(var i = 0;i < lines.length;i++){
            //code here using lines[i] which will give you each line
            if (lines[i].indexOf('fp-player-name=') > -1){
                playerCount++;
                var player = lines[i].match(rePlayer);
                console.log(lines[i])
                console.log(lines[i+1])
                var vs = reMatchup.exec(lines[i+1]);
                console.log(vs)
                var a = playerCount+') '+player+' '+vs[0];
                a = a.replace(/\"/g,'');
                result += a + '\n'
                if(playerCount >=MAX_RANKINGS){
                    break;
                }
            }
        }
        cb(result);
    });

}