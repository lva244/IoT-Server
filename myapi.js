var http = require('http');
var express = require('express');
var path    = require("path");
var firebase = require("firebase");
var querystring = require('querystring');

var fromArduino = false;

var myInterval_dust;
var dust_state;
var myInterval_gas;
var alert;

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
}).then(function(result){
  getRooms();
  checkOnline();
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
  dust_state = req.body.dust_state;
  console.log("Dust value: "+dust_state+"\r\n");

   var obj = {
    dust_state: dust_state
  }

  if(dust_state.trim()=="Not good")
  {
    console.log("Not good");
    //clearTimeout(myInterval_dust);
    myInterval_dust = setTimeout(function(){ 
      console.log(dust_state);
      if(dust_state=="Not good")
      {
        postMethod("SmartHome", "Độ bụi: Độ bụi đang không được tốt lắm, bạn nên mang theo khẩu trang và trang bị khi ra ngoài");
        clearTimeout(myInterval_dust);
      } else {
        clearTimeout(myInterval_dust);
      }
    }, 60000);
  } else if (dust_state.trim()=="Bad") {
    console.log("Bad");
    myInterval_dust = setTimeout(function(){ 
      console.log(dust_state);
      if(dust_state=="Bad")
      {
        postMethod("SmartHome", "Độ bụi: Độ bụi trong không khí đang rất xấu, bạn không nên ra ngoài");
        clearTimeout(myInterval_dust);
      } else {
        clearTimeout(myInterval_dust);
      }
    }, 60000);
  }

  firebase.database().ref("note/dust").set(obj);

  res.status(200).send(dust_state);
});

app.get("/api/:mac_address/:led/:state", function(req, res){
  fromArduino = true;
  var mac_address = req.params.mac_address;
  var led = req.params.led;
  var state = req.params.state;

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

  console.log(mac_address);

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
    },
    state: "on",
    icon: icon,
    sdoCheck: "no"
  }



  firebase.database().ref("rooms/"+mac_address).set(obj);

  res.status(200).send("OK");
});

app.post('/api/gas', function(req, res) {
  alert = (req.body.gas_state);

  if(alert.length<=13)
  {
    var obj = {
      gas_state: alert
    }

    firebase.database().ref("note/gas").set(obj);
  }

  if(alert=="Not safe")
  {
    console.log(alert);
    clearTimeout(myInterval_gas);
    myInterval_gas = setTimeout(function(){ 
      console.log(alert);
      if(alert=="Not safe")
      {
        postMethod("SmartHome", "Nồng độ gas: Nồng độ gas hiện đang cao, bạn nên kiểm tra phòng bếp để đảm bảo an toàn, nhớ mang theo dụng cụ phòng khí độc");
        clearTimeout(myInterval_gas);
      } else {
        clearTimeout(myInterval_gas);
        console.log("Clear");
      }
    }, 60000);
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

var postMethod = function(title, message){  
  // Build the post string from an object
  var post_data = JSON.stringify({
      "tokens": ["dH_rZXgjUCg:APA91bF8lfVH-52vBupqPpbBlTd69Df9FFzGLdJc5N7mSwabe62AbrTTduP2tpJL-TmuVX4LbOqwCM58JpXwlMi6XP0lU8lAgxvF_f5fFNWMNvSZoPaLFQXVIvbKfyjofOEfBipdcgVy"],
      "profile": "smarthome",
      "notification": {
        "title": title,
          "message": message
      }
  });

  // An object of options to indicate where to post to
  var post_options = {
      host: 'api.ionic.io',
      port: '80',
      path: '/push/notifications',
      method: 'POST',
      headers: {
          'Content-Type': 'application/json',
          'Authorization': "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJjMTdiMzFlMC1mMDg2LTQ1NTAtOGRjZS0wOTA3NDlhM2UzMTEifQ.mkSEfIKiTtPYGFTiGu0FtItqm994HOrM7QUBugHu8r4"
      }
  };

  // Set up the request
  var post_req = http.request(post_options, function(res) {
      res.setEncoding('utf8');
      res.on('data', function (chunk) {
          console.log('Response: ' + chunk);
      });
  });

  // post the data
  post_req.write(post_data);
  post_req.end();
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
              humidity: arr_temp_hum[1],
              date: date.toString()
            };
            
            if (arr_temp_hum[1] > 80)
            {
              postMethod("SmartHome", "Độ ẩm của bạn hiện đang rất cao ("+arr_temp_hum[1]+"%), bạn nên thực hiện một số biện pháp để giảm độ ẩm");
            }
            else if(arr_temp_hum[1] > 60)
            {
              postMethod("SmartHome", "Độ ẩm của bạn là "+arr_temp_hum[1]+"% hiện đang cao hơn bình thường");
            }  

            if (arr_temp_hum[0] > 45)
            {
              postMethod("SmartHome", "Nguy hiểm! Nhiệt độ của bạn hiện tại là "+ arr_temp_hum[1] +"°C, hãy lập tức kiểm tra nhà bạn và mang theo dụng cụ chữa cháy");    
            }
            else if(arr_temp_hum[0] > 39)
            {
              postMethod("SmartHome", "Nhiệt độ của bạn hiện tại là "+ arr_temp_hum[1] +"°C, đây là nhiệt độ khá cao, bạn nên kiểm tra lại để đề phòng có cháy nổ");
            } else if (arr_temp_hum[0] > 33)
            {
              postMethod("SmartHome", "Nhiệt độ của bạn hiện đang là "+ arr_temp_hum[1] +"°C bạn nên giảm nhiệt độ máy lạnh để cân bằng nhiệt độ trong nhà");
            }

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

//setInterval(function(){ getTempAndHum(); }, 2 * 60000);
app.listen(3000);
console.log('App Server is listening on port 3000');