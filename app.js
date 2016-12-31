"use strict";
const config = require('./stantonConfig.json');

const express = require('express');
const async = require('async');
const cfenv = require('cfenv');
const NewsAPI = require('newsapi');
const newsapi = new NewsAPI(config.NEWS_API_KEY);
const bodyParser = require('body-parser');
const jsonParser = bodyParser.json();
const request = require('request');
const insultgenerator = require('insultgenerator');
const watson = require('watson-developer-cloud');
const bot = require('fancy-groupme-bot');
const joke = require('jokesearch');
const groupMeBotID = config.GROUPME_BOT_ID;
const yahooFinance = require('yahoo-finance');
const amazon = require('amazon-product-api');
const amazonConfig = require('./amznConfig.json');
const amazonClient = amazon.createClient(amazonConfig);
const googl = require('goo.gl');
googl.setKey(config.GOOGLE_URL_KEY);






// Initialize watson conversation API
const conversation = watson.conversation({
  username: config.WATSON_USERNAME,
  password: config.WATSON_PASSWORD,
  version: 'v1',
  version_date: '2016-07-01'
});
const app = express();
const appEnv = cfenv.getAppEnv();
const PAGE_TOKEN = config.PAGE_TOKEN;
const VALIDATION_TOKEN = config.VALIDATION_TOKEN;
const DEFAULT_GREETING = config.DEFAULT_GREETING;
const CURRENT_PLANS = config.CURRENT_PLANS;

const WHO_IS_BRINGING_WHAT = { };
const CURRENT_STASH = {
  beers: 0,
  bottles: {
    vodka: 2,
    rum: 0,
    whiskey: 0,
    wine: 1,
    tequila: 0,
    mixers: 2,
    gin: 0
  }
}

const WHAT_TO_BRING = config.WHAT_TO_BRING;
    
// start server on the specified port and binding host
app.listen(appEnv.port, '0.0.0.0', function() {
  // print a message when the server starts listening
  console.log("Server starting on " + appEnv.url);
});

// serve the files out of ./public
app.use(express.static(__dirname + '/public'));

// Facebook webhook
app.get('/webhook', function(req, res) {
  if (req.query['hub.mode'] === 'subscribe' &&
      req.query['hub.verify_token'] === VALIDATION_TOKEN) {
    console.log("Validating webhook");
    res.status(200).send(req.query['hub.challenge']);
  } else {
    console.error("Failed validation. Make sure the validation tokens match.");
    res.sendStatus(403);          
  }  
})

// Facebook webhook
app.post('/webhook', jsonParser, function (req, res) {
  var data = req.body;
  console.log('Incoming FB message')

  // Make sure this is a page subscription
  if (data.object == 'page') {
    // Iterate over each entry
    // There may be multiple if batched
    data.entry.forEach(function(pageEntry) {
      var pageID = pageEntry.id;
      var timeOfEvent = pageEntry.time;

      // Iterate over each messaging event
      pageEntry.messaging.forEach(function(messagingEvent) {
        if (messagingEvent.optin) {
          //receivedAuthentication(messagingEvent);
        } else if (messagingEvent.message) {
          receivedMessage(messagingEvent);
        } else if (messagingEvent.delivery) {
          //receivedDeliveryConfirmation(messagingEvent);
        } else if (messagingEvent.postback) {
          //receivedPostback(messagingEvent);
        } else {
          console.log("Webhook received unknown messagingEvent: ", messagingEvent);
        }
      });
    });

    // Assume all went well.
    // Must send back a 200, within 20 seconds, to let fb know we've 
    // successfully received the callback. Otherwise, the request will time out.
    res.sendStatus(200);
  }
});

// New FB Message
function receivedMessage(event) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;
  var timeOfMessage = event.timestamp;
  var message = event.message;

  if(!message.is_echo){

    console.log("Received message for user %d and page %d at %d with message:", 
      senderID, recipientID, timeOfMessage);
    console.log(JSON.stringify(message));

    // Check to see if its an Admin
    if( senderID === config.ADMIN_USER_ID){
      console.log('ADMIN SPEAKING');

      for(var i = 0; i<config.ADMIN_KEYWORDS.length;i++){
        if(message.text){
          if(message.text.indexOf(config.ADMIN_KEYWORDS[i]) > -1){
            // Route to appropriate admin option
            adminAction(message.text);
          }
        }
      }
    }

    var messageId = message.mid;

    // You may get a text or attachment but not both
    var messageText = message.text;
    var messageAttachments = message.attachments;

    // If we have a quick_reply message
    if( message.quick_reply){
      // Figure out who it is and update the current stash
      thankUserAndUpdateStash( senderID, message.quick_reply.payload );
    }else if (messageText) {
      // If we receive a text message, check to see if it matches any special
      // keywords and send back the corresponding example. Otherwise, just echo
      // the text we received.
      console.log('Got a regular text message');
      // SEND PLANS
      if( messageText.toLowerCase().trim().indexOf('plan') > -1 ){
        console.log('REQUEST FOR PLANS');
        sendTextMessage(senderID, CURRENT_PLANS+" Say \"What should I bring?\" or \"bring\" to add to our stash. ITS GONNA BE LIT!");

      // SEND POSSIBLE ITEMS TO BRING
      }else if( messageText.toLowerCase().trim().indexOf('bring') > -1 ){
        sendButtonMessage( senderID )
      }else if( messageText.toLowerCase().trim().indexOf('stash') > -1 ){
        sendTextMessage( senderID, getCurrentStash());
      }else if( messageText.toLowerCase().trim().indexOf('joke') > -1 ){
        joke.getJoke(function(joke){
          sendTextMessage( senderID, joke);
        });
      }else{
        console.log('Sending to Watson for analysis');
        watsonAnalyze(senderID, messageText);
      }
    }else if (messageAttachments) {
      //sendTextMessage(senderID, "Message with attachment received");
      sendTextMessage( senderID, config.CONFIRMATION[Math.floor(Math.random() * config.CONFIRMATION.length) ]+'.');
    }
  }
}

function sendTextMessage(recipientId, messageText) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      text: messageText  
    }
  };
  callSendAPI(messageData);
}

function sendButtonMessage(recipientId) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: WHAT_TO_BRING 
  };
  callSendAPI(messageData);
}

function callSendAPI(messageData) {
  request({
    uri: 'https://graph.facebook.com/v2.6/me/messages',
    qs: { access_token: PAGE_TOKEN},
    method: 'POST',
    json: messageData

  }, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      var recipientId = body.recipient_id;
      var messageId = body.message_id;

      console.log("Successfully sent generic message with id %s to recipient %s", 
        messageId, recipientId);
    } else {
      console.error("Unable to send message.");
      console.error(response);
      console.error(error);
    }
  });  
}


// Takes input text from user and returns the response
// of querying Watson's conversational API
function watsonAnalyze( senderID, messageText ){
  conversation.message({
    input: {
      text: messageText
    },
    workspace_id: config.WATSON_WORKSPACE
  }, function(err, response) {
     if (err) {
       console.error(JSON.stringify(err));
       sendTextMessage( senderID, 'Sorry, didnt get that, please try again.')
     } else {
       console.log('Intents and Confidence raitings for: '+messageText);
       console.log(response.intents)
       if(response.intents[0].intent == 'greeting'){
         sendTextMessage( senderID, DEFAULT_GREETING)
       }else if( response.intents[0].intent == 'profanity' && response.intents[0].confidence > .8 ){
         insultgenerator(function(insult){
           sendTextMessage( senderID, insult );
         });
       }else if( response.intents[0].intent == 'confirmation' && response.intents[0].confidence > .75 ){
         sendTextMessage( senderID, config.CONFIRMATION[Math.floor(Math.random() * config.CONFIRMATION.length) ]+'.');
       }else{
//          sendTextMessage( senderID, DEFAULT_GREETING)
         sendTextMessage( senderID, config.CONFIRMATION[Math.floor(Math.random() * config.CONFIRMATION.length) ]+'.');

       }
     }
  });
}

function getCurrentStash( ){
  var stash = "Current stash looks like:\n";
  var bottles = Object.keys(CURRENT_STASH.bottles);
  for( var i=0; i<bottles.length; i++ ){
    if(CURRENT_STASH.bottles[bottles[i]] > 0){
          if(CURRENT_STASH.bottles[bottles[i]] == 1){
            stash+= CURRENT_STASH.bottles[bottles[i]]+" bottle of "+bottles[i]+'\n';
          }else{
            stash+= CURRENT_STASH.bottles[bottles[i]]+" bottles of "+bottles[i]+'\n';
          }
    }
  }

  stash += CURRENT_STASH.beers + " beers\n";
  return stash;
}

function getCurrentPlans( ){
  return (CURRENT_PLANS);
}

function thankUserAndUpdateStash( senderID, item ){
    request({
      uri: 'https://graph.facebook.com/v2.6/'+senderID,
      qs: { access_token: PAGE_TOKEN,
            fields: 'first_name,last_name,profile_pic,locale,timezone,gender' },
      method: 'GET',
  }, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      var name = (JSON.parse(body)).first_name;
      sendTextMessage( senderID, 'Thanks '+name+'! '+'We\'ll add it to the stash!' )
      updateStash( item );
      updateWhoIsBringingWhat(senderID, name, item);
    } else {
      console.error("Unable to send message.");
      console.error(response);
      console.error(error);
    }
  });  
}

function updateStash( item ){
  if(item == 'beer'){
    CURRENT_STASH.beers += 6;
  }else{
    CURRENT_STASH.bottles[item]++;
  }
}

function updateWhoIsBringingWhat( senderID, name, item ){
  // If user already is in our table
  if( WHO_IS_BRINGING_WHAT[senderID]){
    // If he/she is already bringing one of these..
    if( WHO_IS_BRINGING_WHAT[senderID][item]){
      WHO_IS_BRINGING_WHAT[senderID][item]++;
    }else{
      WHO_IS_BRINGING_WHAT[senderID][item] = 1;
    }
  }else{
    WHO_IS_BRINGING_WHAT[senderID] = {
      name: name
    };

    WHO_IS_BRINGING_WHAT[senderID][item] = 1;
  }
}

function getWhoIsBringingWhat( ){
  return WHO_IS_BRINGING_WHAT;
}

function clearStash(){
  CURRENT_STASH = {
    beers: 6,
    bottles: {
      vodka: 1,
      rum: 0,
      whiskey: 0,
      wine: 1,
      tequila: 0,
      mixers: 2,
      gin: 0
    }
 };

 WHO_IS_BRINGING_WHAT = {};
}

function adminAction(action){
  if(action === 'clearStash'){
    clearStash();
    console.log('ADMIN CLEARED STASH')
    sendTextMessage(config.ADMIN_USER_ID, 'CLEARED STASH');
  }else if(action === 'getList'){
    var keys = Object.keys(WHO_IS_BRINGING_WHAT);
    for(var i = 0;i<keys.length; i++){
      sendTextMessage(config.ADMIN_USER_ID, JSON.stringify(WHO_IS_BRINGING_WHAT[keys[i]]));
    }
  }
}

// Group Me Bot Stuff
app.get('/groupme', jsonParser,function(req, res) {
  var data = req.body;
  console.log('GOT GET REQ FROM GROUP ME');
  console.log(req.body)
  res.writeHead(200);
  res.end("Hey, I'm Cool Guy.");
})

app.post('/groupme', jsonParser,function(req, res) {
  var data = req.body;
  console.log('GOT POST REQ FROM GROUP ME');

  // Check for text
  if(data.text){
    var command = data.text.split(" ");
    if( command[0].toLowerCase() == '/stock' && command.length > 1){
      findStockQuote( command[1] );
    }else if (command[0].toLowerCase() == '/joke'){
        joke.getJoke(function(joke){
          sendGroupMeMessage( joke );
        });
    }else if (command[0].toLowerCase() == '/cointoss' || command[0].toLowerCase() == '/coinflip'){
      sendGroupMeMessage((Math.floor(Math.random() * 2) == 0) ? 'Heads.' : 'Tails.');
    }else if (data.text.toLowerCase().indexOf('suad') > -1){
      sendGroupMeMessage("SUUUUAAAAADDDDD");
    }else if (command[0].toLowerCase() == '/roast' || command[0].toLowerCase() == '/insult' || command[0].toLowerCase() == '/burn'){
      if( command[1].toLowerCase().indexOf('arin') > -1 || command[1].toLowerCase().indexOf('ray') > -1 || command[1].toLowerCase().indexOf('allio') > -1 || command[1].indexOf('Arin') > -1){
        sendGroupMeMessage(config.MASTER[Math.floor(Math.random() * config.MASTER.length) ]);
      }else{
        insultgenerator(function(insult){
          var insult = command[1]+', '+insult.toLowerCase();
            sendGroupMeMessage(insult);
        });
      }
    }else if ( command[0].toLowerCase() == '/news' ){
      var newsQuery = (data.text).substr((data.text).indexOf(" ") + 1);
      if (newsQuery.trim() != ""){
        if(newsQuery.toLowerCase().indexOf('arin') > -1 || newsQuery.toLowerCase().indexOf('aray') > -1 || newsQuery.toLowerCase().indexOf('a-ray') > -1 || newsQuery.toLowerCase().indexOf('a~ray') > -1 ){
          sendGroupMeMessage("Arin (also known as rapper A~Ray) will be dropping his FIRE mixtape Back Where It All Started this year. Sign up here: http://arinray.me/rap")
        }else{
          console.log('Fetching News for:'+newsQuery);
          fetchAndSendNews(newsQuery);
        }
      }
    }else if ( command[0].toLowerCase() == '/shop' ){
      var shopQuery = (data.text).substr((data.text).indexOf(" ") + 1);
        if(shopQuery.toLowerCase().indexOf('arin') > -1 || shopQuery.toLowerCase().indexOf('aray') > -1 || shopQuery.toLowerCase().indexOf('a-ray') > -1 || shopQuery.toLowerCase().indexOf('a~ray') > -1 ){
          sendGroupMeMessage("Shopping for music? Tired of mumble rap? A~Ray (also known as 25 Savage) will be dropping his FIRE mixtape Back Where It All Started this year. Sign up here: http://arinray.me/rap")
        }else{
          console.log('Shopping for:'+shopQuery);
          shopAndSendItem(shopQuery);
        }
    }
  }
});

function sendGroupMeMessage( message ){
  request({
    uri: 'https://api.groupme.com/v3/bots/post',
    method: 'POST',
    json: {
      bot_id : groupMeBotID,
      text : message  
    }
  }, function (error, response, body) {
    if (!error) {
      console.log('Successfully sent GroupMe message');
    } else {
      console.error('Unable to send group message.');
      console.error(error);
    }
  });  
}

function findStockQuote( symbol ){
  yahooFinance.snapshot({
    symbol: symbol,
    fields: ['n', 'p2','l1','m3'],
  }, 
  function (err, snapshot) {
    if(snapshot.name == null){
      sendGroupMeMessage("Please enter a valid ticker symbol.")
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
      if(message.indexOf('Pandora') > -1){
        message += '\nWhat a great buy!'
      }
      sendGroupMeMessage(message);

    }
 });
}
function mapNews(source, cb){
      newsapi.articles({
        source: source,
      }).then(articlesResponse => {
        if(articlesResponse.status == 'ok'){
            cb(null,  articlesResponse.articles);
        }else{
            cb(null, [])
        }
      });
}

function fetchAndSendNews( newsQuery ){
    var sources = config.NEWS_SOURCES;
    var newsDict = [];
    newsQuery = newsQuery.toLowerCase();

    if(newsQuery.trim() != ""){
      console.log('Mapping news query to sources: '+newsQuery)
        async.map(sources, mapNews, function(err, results) {
                  console.log('Map Results')

        //console.log(results)
            for(var i=0;i<results.length;i++){
            // console.log(results[i])
                for(var j=0;j<results[i].length;j++){
                 console.log(results[i][j]);
                    if(results[i][j].title.toLowerCase().indexOf(newsQuery) > -1 
                    || results[i][j].description.toLowerCase().indexOf(newsQuery) > -1 ){
                        newsDict.push({news: results[i][j].description, url: results[i][j].url});
                    }
                }
            }
            if(newsDict.length==0){
                sendGroupMeMessage("Sorry no news found for "+newsQuery);
            }else{
                var random_news = newsDict[Math.floor(Math.random() * newsDict.length) ];
                sendGroupMeMessage(random_news.news+"\n"+random_news.url);
            }
        });
    }
}

function shopAndSendItem( query ){
  amazonClient.itemSearch({
  //director: 'Quentin Tarantino',
  //actor: 'Samuel L. Jackson',
    condition: 'New',
    responseGroup: 'ItemAttributes',
    keywords: query,
  }, function(err, results, response) {
  if (err) {
    console.log(JSON.stringify(err));
    sendGroupMeMessage("Sorry, couldn't find anything for "+ query)
  } else {
   // console.log(results);  // products (Array of Object) 
    if(results.length > 1){
      console.log('Attempting to shorten URL');
      googl.shorten(results[0].DetailPageURL[0])
      .then(function (shortUrl) {
        sendGroupMeMessage('Found a deal for '+query+' on Amazon!\n'+shortUrl);
      })
      .catch(function (err) {
        console.error(err.message);
        sendGroupMeMessage('Found a deal for '+query+' on Amazon!\n'+results[0].DetailPageURL[0]);
      });
    }else{
      sendGroupMeMessage("Sorry, couldn't find anything for "+ query)
    } 
  }
});
}