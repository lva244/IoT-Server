var http = require('http');
var express = require('express');
var path    = require("path");
var firebase = require("firebase");

var fromArduino = false;

var list_room = [];

// Initialize Firebase
var config = {
  apiKey: "AIzaSyAAoCFMy4H5C5jrGA1TRLchrqXmrkhquWU",
  authDomain: "smart-home-42c48.firebaseapp.com",
  databaseURL: "https://smart-home-42c48.firebaseio.com",
  storageBucket: "smart-home-42c48.appspot.com",
};
firebase.initializeApp(config);

firebase.auth().signInWithEmailAndPassword("lvanh24494@gmail.com", "levietanh").catch(function(error) {
  // Handle Errors here.
  var errorCode = error.code;
  var errorMessage = error.message;
  console.log(errorMessage);
  // ...
}).then(function(result){
  getRooms();
  checkOnline();
  console.log(result);
});

var app = express();

var bodyParser = require('body-parser');
app.use(bodyParser.json()); // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies

app.use(express['static'](__dirname));

//Route to index
app.get('/', function(req, res) {
  res.sendFile(path.join(__dirname+'/index.html'));
}); 

process.on('uncaughtException', function (exception) {
 // handle or ignore error
 console.log(exception);
});

app.post("/api/dust", function(req, res){
  var dust_state = req.body.dust_state;
  console.log("Dust value: "+dust_state+"\r\n");

   var obj = {
    dust_state: dust_state
  }

  firebase.database().ref("note/dust").set(obj);

  res.status(200).send(dust_state);
});

app.get("/api/:mac_address/:led/:state", function(req, res){
  fromArduino = true;
  var mac_address = req.params.mac_address;
  var led = req.params.led;
  var state = req.params.state;

  console.log(mac_address+ " " + led + " " + state);

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
  var dht11 = (req.body.dht11) == "true" ? true : false;
  var mq135 = (req.body.mq135) == "true" ? true : false;
  var gp2 = (req.body.gp2) == "true" ? true : false;
  var watt_power = (req.body.watt_power) == "true" ? true : false;

  var icon = "unknown";  
  for (var i =0;i<list_room.length;i++)
  {
    if(mac_address==list_room[i]._id)
    {
      icon = list_room[i].icon;
      type_of_room = list_room[i].room;
      break;
    }
  }

  var obj = {
    _id: mac_address,
    ip: ip_address,
    room: type_of_room,
    led: {
      led_1: led1,
      led_2: led2
    },
    sensor: {
      dht11: dht11,
      mq135: mq135,
      gp2: gp2,
      watt_power: watt_power
    },
    state: "on",
    icon: icon,
    sdoCheck: "no"
  }

  console.log(mac_address);

  firebase.database().ref("rooms/"+mac_address).set(obj);

  res.status(200).send("OK");

});

app.post('/api/gas', function(req, res) {
  var alert = (req.body.gas_state);
  console.log("Gas_state: "+alert+"\r\n");

  if(alert.length<=13)
  {
    var obj = {
      gas_state: alert
    }

    firebase.database().ref("note/gas").set(obj);
  }
  
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
    list_room.push(data.val());
    roomsRef.child(data.key).on("child_changed", function(snapshot){
      if(snapshot.key=="icon")
      {
        for(var i=0;i<list_room.length;i++)
        {
          if(list_room[i]._id==data.key)
          {
            list_room[i].icon = snapshot.val();
            break;
          }
        }
      }

      if(snapshot.key=="room")
      {
        for(var i=0;i<list_room.length;i++)
        {
          if(list_room[i]._id==data.key)
          {
            list_room[i].room = snapshot.val();
            break;
          }
        }
      }
    });
    roomsRef.child(data.key+"/led").on("child_changed", function(snapshot){
      if(!fromArduino)
      {
        var options = {
          host: data.val().ip,
          path: '/'+snapshot.key+"?state="+snapshot.val()
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

//Check online
var checkOnline = function(){
  var checkRef = firebase.database().ref("rooms/");
  checkRef.on("child_added", function(data){
    checkRef.child(data.key).on("child_changed", function(snapshot){
        if(snapshot.val() == "yes" && snapshot.key == "sdoCheck")
        {
          console.log("Check");
          var options = {
            host: data.val().ip,
            path: '/checkOnline'
          };

          console.log(options);

          var request = http.request(options, function(response){
            var str = '';

            //another chunk of data has been recieved, so append it to `str`
            response.on('data', function (chunk) {
              str += chunk;
              var firebaseRef = firebase.database().ref("rooms/"+data.val()._id).update({"state": "on"});
              var firebaseRef = firebase.database().ref("rooms/"+data.val()._id).update({"sdoCheck": "no"});
            });

            //the whole response has been recieved, so we just print it out here
            response.on('end', function () {
            });
          });

          request.on('error', function(err) {
              var updates = {};
              updates['/rooms/' + data.key + "/sdoCheck"] = "no";
              updates['/rooms/' +  data.key + "/state"] = "off";

              firebase.database().ref().update(updates);
          });

          request.end();
        }
    });
  });
}

//Get temperature and humidity from arduino and upload to server
var getTempAndHum = function(){
  var roomsRef = firebase.database().ref("rooms/");

  roomsRef.on("child_added", function(data){
    
    try
    {
      if(data.val().sensor.dht11)
      {
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

            var firebaseRefTemp = firebase.database().ref("temperature");
            firebaseRefTemp.push({
              temperature: arr_temp_hum[0],
              date: date.toString()
            });
            var firebaseRefHum = firebase.database().ref("humidity");
            firebaseRefHum.push({
              humidity: arr_temp_hum[1],
              date: date.toString()
            });
          });
        }).end();
      }
    } catch(e)
    {

    }
  });
}

var getWatt = function(){
  var roomsRef = firebase.database().ref("rooms/");

  roomsRef.on("child_added", function(data){
    try
    {
      if(data.val().sensor.watt_power)
      {
        var options = {
          host: data.val().ip,
          path: '/watt_power'
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
            var arr_watt = str.split(" ");
            var mac_address = arr_watt[1];

            var options_watt = {
              watt_power: arr_watt[0]*220,
              date: date.toString()
            };

            console.log(options_watt);

            var firebaseRefTemp = firebase.database().ref("watt_power");
            firebaseRefTemp.push({
              watt_power: Number(arr_watt[0])*220,
              date: date.toString()
            });
          });
        }).end();
      }
    } catch(e)
    {

    }
  });
}

setInterval(function(){ getTempAndHum(); }, 2 * 60000);
//setInterval(function(){ getWatt(); }, 2 * 60000);
app.listen(3000);
console.log('App Server is listening on port 3000');