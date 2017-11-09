const request = require('request');

exports.run = function(message, cb){

var names = message.toLowerCase().split(' ');
var firstName = names[0];
var lastName = names[1];

if( !firstName || !lastName ){
    cb('Please provide First and Last name!');
}
var playerUrl = "http://api.suredbits.com/nfl/v0/players/"+lastName+'/'+firstName
var baseUrl = "http://api.suredbits.com/nfl/v0/stats/"
var statsUrl = baseUrl + lastName + '/' + firstName;

request(playerUrl,function( error, response, body ){
    body = JSON.parse(body)
    if(body.length === 0){
        // No player found
        cb('No stats found, did you spell the name right?')
    }else{
        // Get position
        if(body[0].position === 'QB'){
            request(statsUrl, function(error, response, body ){
                body = JSON.parse(body)
                var passingStats = parsePassingStats(body[0]);
                console.log(passingStats)
                cb(passingStats)
            })
        }else if(body[0].position === 'WR'){
            request(statsUrl, function(error, response, body ){
                body = JSON.parse(body)
                var flexStats = parseFlexStats(body[0]);
                cb(flexStats)
            })
        }else if(body[0].position === 'RB'){
            request(statsUrl, function(error, response, body ){
                body = JSON.parse(body)
                var flexStats = parseFlexStats(body[0]);
                if(lastName == 'gillislee'){
                    flexStats+='Slick Gilly baby!'
                }
                cb(flexStats)
            })
        }else if(body[0].position === 'TE'){
            request(statsUrl, function(error, response, body ){
                body = JSON.parse(body)
                var flexStats = parseFlexStats(body[0]);
                cb(flexStats)
            })
        }else{
            cb('Position not yet supported.')
        }     
    }
});

}

function parsePassingStats(stats){
  //  console.log(stats)
    var result = "Passing Yards: "+stats.passing.passingYds+'\n' + 
                 "Completed/Attempted: "+stats.passing.cmp+'/'+stats.passing.att+ ' ('+((stats.passing.cmp/stats.passing.att)*100).toFixed(2)+'%)\n' +
                 "TDs/INTs: "+stats.passing.passingTds+'/'+stats.passing.passingInt+'\n';

    // Check for rushing
    if(stats.rushing.rushingYds !== 0){

        result += "Rushing Yards: "+stats.rushing.rushingYds+'\n' +
                  "Rushing TDs: "+stats.rushing.tds + '\n' + 
                  "Rushing Attempts: "+ stats.rushing.attempt + '\n' +
                  "YPC: "+(stats.rushing.rushingYds/stats.rushing.attempt).toFixed(2) + '\n';                  
    }
    return result;
}

function parseFlexStats(stats){
  //  console.log(stats)
    var result = "";
    // Check for rushing
    if(stats.rushing.rushingYds !== 0){
        result += "Rushing Yards: "+stats.rushing.rushingYds+'\n' +
                  "Rushing TDs: "+stats.rushing.tds + '\n' + 
                  "Carries: "+ stats.rushing.attempt + '\n' +
                  "YPC: "+(stats.rushing.rushingYds/stats.rushing.attempt).toFixed(2) + '\n';                  
                  
    }
    // Check for receiving
    if(stats.receiving.receivingYds !== 0){
        result += "Rec Yards: "+stats.receiving.receivingYds+'\n' +
                  "Rec TDs: "+stats.receiving.tds + '\n' + 
                  "Catches/Targets: "+stats.receiving.rec + '/' +stats.receiving.target+ '\n';
    }
    return result;
}