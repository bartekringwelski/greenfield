// configure server
var path = require('path');
var express = require('express');
var bodyParser = require('body-parser');
var port = process.env.PORT || 8000;
var app = express();

// configure database
var morgan = require('morgan');
var mongoose = require('mongoose');
//timestamps
var timestamps = require('mongoose-timestamp');

mongoose.connect('mongodb://localhost/hassle');
// mongoose.connect('mongodb://bartek:hassle1@ds119598.mlab.com:19598/heroku_4800qm90');
var db = mongoose.connection;
var User = require('./userModel.js');
app.use(morgan('dev')); //to log every request to the console

// configure authentication
var session = require('express-session');
var passport = require('passport');
require('./auth.js')(passport);
app.use(session({
  secret: 'squirrel',
  resave: false,
  saveUninitialized: true
}));
app.use(passport.initialize());
app.use(passport.session());

// configure twilio
var twilioService = require('./sms/sms.js');

// server static files
app.use('/', express.static(path.join(__dirname, '../client/login')));
app.use('/app', express.static(path.join(__dirname, '../client')));
app.use('/modules', express.static(path.join(__dirname, '../node_modules')));

// parse requests
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: true
}));

// authentication routes
app.get('/auth/facebook', passport.authenticate('facebook'));
app.get('/auth/facebook/callback', passport.authenticate('facebook', {
  failureRedirect: "/"
}), (req, res) => {
    // PASSPORT WILL ATTACH user TO ALL REQUESTS AFTER AUTHENTICATION
    if (!req.user.goal) {
      // if user has no goal, allow them to create one
      res.redirect('/app/#/create');
    } else {
      // else log user in and redirect to goal status page
      res.redirect('/app/#/status')
    }
});
app.get('/logout', (req, res) => {
  // passport attaches logout method to all requests
  req.logout();
  res.redirect('/');
});

// user info route
app.get('/user', function(req, res) {
  console.log('user: ', req.user);
  res.send(req.user);
});

// new user route
app.post('/create', function(req, res) {
  req.user.responses = Array(90);
  req.user.goalStartDate = Date.now();
  User.create(req.user, function(err, results) {
    if (err) {
      res.send(err);
    }
    res.send(results);
  });
  twilioService.sendWelcome(req.user.phoneNumber);
});

// twilio routes
app.get('/messageToConsole', function(req, res) {
  console.log('user phone numberrrrr', req.query.From);

  var shortPhone = req.query.From.substring(2);

  //figure out phone number of request
  User.find({
    phoneNumber: shortPhone // finds the user in the db
  }, function(err, user) {
    console.log("user", user);
    if (err) {
      console.log(err);
    } else {

      console.log("start date!!!!!", user[0].responses);
      // console.log("day since sign up", user[0].created_at);
      //  var daysSinceGoalCreation = Math.round((Date.now() - user[0].responses.start) / (24 * 60 * 60 * 1000)); // sets index
      //  console.log("days since gola creation", daysSinceGoalCreation);
      var daysSinceGoalCreation = 0; // sets index
      console.log("body of request", req.query.Body);

      user[0].responses[daysSinceGoalCreation] = req.query.Body; // made changes to response array
      // console.log('index of thing', user.responses[daysSinceGoalCreation]);

      console.log('supposted tobe in db, but isnt');
      console.log(user[0].responses);

      console.log(shortPhone);
      console.log(typeof shortPhone);


      User.findOne({
        phoneNumber: shortPhone
      }, function(err, doc) {
        doc.responses = user[0].responses;
        doc.save();
      });

    }
  });

  twilioService.responseMaker(req, res);

});

// twilio routes
app.get('/messageToConsole', function(req, res) {
  twilioService.responseMaker(req, res);
});

// start server
app.listen(port);
console.log('Listening on port ' + port + '...');

// spam routine
exports.spam = function() {
  // query database for all users
  User.find((err, users) => {
    // iterate through and apply periodic goal poll
    users.forEach(user => {
      // if it's their last day, drop their ass
      //twilioService.periodicGoalPoll(user.phoneNumber, "this is a test goal");
    });
    // celebrate completion
    console.log('spammed the shit out of \'em');
  });
};