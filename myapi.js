var http = require('http');
var express = require('express');
var path    = require("path");
var MongoClient = require("mongodb").MongoClient;

var url = "mongodb://localhost:27017/smart_home";

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
  MongoClient.connect(url, function(err, db){
    if(err){
      console.log("Error: "+err);
    } else {
      var collection = db.collection("room");

      collection.find().toArray(function(err, docs){
        if(!err)
        {
          db.close();
          res.header('Access-Control-Allow-Origin', '*');
          res.status(200).send(docs);
        }
      });
    }
  });
});

app.get("/api/:roomtype/:led", function(req, res){
  var room = req.params.roomtype;
  var led = req.params.led;

  MongoClient.connect(url, function(err, db){
    if(err){
      console.log("Error: "+ err);
    } else {
      var collection = db.collection("room");

      collection.find({"room": room}).toArray(function(err, docs){
        if(!err){
          db.close();
          var options = {
            host: docs[0].ip,
            path: '/'+led
          };

          http.request(options, function(response){
            var str = '';

            //another chunk of data has been recieved, so append it to `str`
            response.on('data', function (chunk) {
              str += chunk;
            });

            //the whole response has been recieved, so we just print it out here
            response.on('end', function () {
              res.header('Access-Control-Allow-Origin', '*');
              res.status(200).send(str);
            });
          }).end();
        }
      });
    }
  });
})

//Post information
app.post('/api/register', function(req, res) {
  var ip_address = req.body.ip;
  var type_of_room = req.body.room;
  var led1 = req.body.led1;
  var led2 = req.body.led2;

  var obj = {
    _id: type_of_room,
    ip: ip_address,
    room: type_of_room,
    led: {
      led_1: led1,
      led_2: led2
    }
  }

  // Connect to the db
  MongoClient.connect(url, function(err, db) {
    if(err) {
      console.log("Error: "+ err);
    } else {
      var collection = db.collection("room");

      collection.update({"_id": type_of_room}, {$set:{ip:ip_address,led:{led_1: led1,led_2:led2}}}, {upsert:true});

      db.close();
      res.send(obj);
    }
  });
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

app.listen(3000);
console.log('App Server is listening on port 3000');