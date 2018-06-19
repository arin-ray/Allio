var request = require('request')

var rePlayer = /\"[a-zA-Z.' -]*\"/i;
var reMatchup = /(vs.|at)\s*[A-Z]*/

const MAX_RANKINGS = 15;

exports.run = function(message, cb){
    var URL = "";
    var result = ''
    var m = message.split(' ')[0].toLowerCase();
    var playerCount = 0;
    var req = true;
    var ros = false;


    if(m == 'qb'){
        if(message.split(' ').length > 1){     
            if(message.split(' ')[1].toLowerCase() === 'ros'){
                URL = "https://www.fantasypros.com/nfl/rankings/ros-qb.php";
                ros = true;
            }else{
                URL = 'https://www.fantasypros.com/nfl/rankings/qb.php'                            
            }
        }else{
            URL = 'https://www.fantasypros.com/nfl/rankings/qb.php'            
        }
    }else if(m == 'wr' || m == 'rb'|| m == 'te' || m == 'flex'){
        // Check for ROS
        if(message.split(' ').length > 1){
            if(message.split(' ')[1].toLowerCase() === 'ros'){
                URL = "https://www.fantasypros.com/nfl/rankings/ros-half-point-ppr-"+m+".php";
                ros = true;
            }else{
                req = false;
            }
        }else{
            URL = 'https://www.fantasypros.com/nfl/rankings/half-point-ppr-'+m+'.php'            
        }
    }else{
        cb('Ranks not available for: '+m+'. Please enter rb, wr, te, or qb')
        req = false;
    }

    console.log('HITTING URL:'+ URL)
    if(req){
        request(URL,function( error, response, body ){
            console.log(error)
            var lines = body.split('\n');
            for(var i = 0;i < lines.length;i++){
                if (lines[i].indexOf('fp-player-name=') > -1){
                    playerCount++;
                    var player = lines[i].match(rePlayer);
                    // console.log(lines[i])
                    // console.log(lines[i+1])
                    // console.log(lines[i+2])
                    
                    var vs;
                    if(m == 'flex'){
                        vs = reMatchup.exec(lines[i+2]);
                    }else{
                        vs = reMatchup.exec(lines[i+1]);                        
                    }
                    //console.log(vs);
                    var a = playerCount+') '+player;
                    // if we have a matchup string
                    if ( vs ){
                        a+=' '+vs[0];
                    }
                    a = a.replace(/\"/g,'');
                    result += a + '\n'
                    if(playerCount >=MAX_RANKINGS){
                        break;
                    }
                }
            }
            if(ros){
                cb('Rest of Season Rankings\n'+result)
            }else{
                cb('Weekly Rankings\n'+result)
            }
            //cb(result);
        });
    }

}