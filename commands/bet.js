var admin = require("firebase-admin");
var serviceAccount = require("../firebaseKey.json");
var reAmount = /\$?[0-9]+(\.[0-9][0-9])?/

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://gentle-keyword-90702.firebaseio.com"
});

// Get a reference to the database service
//var database = admin.database();

exports.run = function(message, cb, user_id, name){
  
  
  // Check for dollar amount
  var dollars = reAmount.exec(message)
  console.log(dollars);

  if(dollars){
    admin.database().ref('bets/' + user_id).set({
      amount: dollars[0].slice(1),
      message: message,
      name: name
    });
    cb('Done.')
  }else{
    cb('Please include a dollar amount starting with a $ sign.')
  }
}