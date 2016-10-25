var http = require('http');
var express = require('express');
var path    = require("path");
var firebase = require("firebase");

var fromArduino = false;

// Initialize Firebase
var config = {
  apiKey: "AIzaSyAAoCFMy4H5C5jrGA1TRLchrqXmrkhquWU",
  authDomain: "smart-home-42c48.firebaseapp.com",
  databaseURL: "https://smart-home-42c48.firebaseio.com",
  storageBucket: "smart-home-42c48.appspot.com",
};
firebase.initializeApp(config);

var app = express();

var bodyParser = require('body-parser');
app.use(bodyParser.json()); // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies

app.use(express['static'](__dirname));

//Route to index
app.get('/', function(req, res) {
  res.sendFile(path.join(__dirname+'/index.html'));
}); 

app.get('/api/rooms', function(req, res){
  
});

process.on('uncaughtException', function (exception) {
 // handle or ignore error
 console.log(exception);
});

app.get("/api/:mac_address/:led/:state", function(req, res){
  fromArduino = true;
  var mac_address = req.params.mac_address;
  var led = req.params.led;
  var state = req.params.state;

  console.log(mac_address);
  console.log(led);
  console.log(state);

  if(state == "true")
  {
    state = true;
  } else {
    state = false;
  }

  if(led == "led_1")
  {
    var firebaseRef = firebase.database().ref("rooms/"+mac_address+"/led").update({"led_1": state});
  } else if (led == "led_2")
  {
    var firebaseRef = firebase.database().ref("rooms/"+mac_address+"/led").update({"led_2": state});
  }

  res.status(200).send('OK change led');
  fromArduino = false;
});

var rooms = [];

//Post information
app.post('/api/register', function(req, res) {
  var mac_address = req.body.mac_address;
  var ip_address = req.body.ip;
  var type_of_room = req.body.room;
  var led1 = (req.body.led1) == "true" ? true : false;
  var led2 = (req.body.led2) == "true" ? true : false;

  var obj = {
    _id: mac_address,
    ip: ip_address,
    room: type_of_room,
    led: {
      led_1: led1,
      led_2: led2
    },
    state: "on",
    icon: "unknown",
    doCheck: "no"
  }

  firebase.database().ref("rooms/"+mac_address).set(obj);

  res.status(200).send("OK");

});

// Express route for any other unrecognised incoming requests
app.get('*', function(req, res) {
  res.status(404).send('Unrecognised API call');
});

// Express route to handle errors
app.use(function(err, req, res, next) {
  if (req.xhr) {
    res.status(500).send('Oops, Something went wrong!');
  } else {
    next(err);
  }
});

//Get list of rooms in database after boot and listen when have change on led state
var getRooms = function(){
  var roomsRef = firebase.database().ref("rooms/");

  roomsRef.on("child_added", function(data){
    roomsRef.child(data.key+"/led").on("child_changed", function(snapshot){
      if(!fromArduino)
      {
        var options = {
          host: data.val().ip,
          path: '/'+snapshot.key
        };

        console.log(options);

        http.request(options, function(response){
          var str = '';

          //another chunk of data has been recieved, so append it to `str`
          response.on('data', function (chunk) {
            str += chunk;
          });

          //the whole response has been recieved, so we just print it out here
          response.on('end', function () {
          });
        }).end();
      }
    });
  });
}

getRooms();

//Get temperature and humidity from arduino and upload to server
var getTempAndHum = function(){
  var roomsRef = firebase.database().ref("rooms/");

  roomsRef.on("child_added", function(data){
    console.log(data.val());
 
    var options = {
      host: data.val().ip,
      path: '/dht11'
    };

    console.log(options);

    http.request(options, function(response){
      var str = '';

      //another chunk of data has been recieved, so append it to `str`
      response.on('data', function (chunk) {
        str += chunk;
      });

      //the whole response has been recieved, so we just print it out here
      response.on('end', function () {
        var date = new Date();
        var arr_temp_hum = str.split(" ");
        var mac_address = arr_temp_hum[2];
        console.log(mac_address);

        var options_temp = {
          temperature: arr_temp_hum[0],
          date: date.toString()
        };

        var options_hum = {
          temperature: arr_temp_hum[1],
          date: date.toString()
        };

        console.log(options_temp);
        console.log(options_hum);

        var firebaseRefTemp = firebase.database().ref("temperature/"+mac_address);
        firebaseRefTemp.push({
          temperature: arr_temp_hum[0],
          date: date.toString()
        });
        var firebaseRefHum = firebase.database().ref("humidity/"+mac_address);
        firebaseRefHum.push({
          humidity: arr_temp_hum[1],
          date: date.toString()
        });
      });
    }).end();
  });
}

setInterval(function(){ getTempAndHum(); }, 60000);

app.listen(3000);
console.log('App Server is listening on port 3000');