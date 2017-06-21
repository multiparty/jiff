var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);

var socket_map = {'1':{},'2':{},'3':{}};// map of maps [computation id][party id] = socket id

var party_map = {};// socket.id -> party_id
var computation_map = {}; // socket.id -> computation_id

var client_map = {'1': 0};//total number of parties per computation
var totalparty_map = {'1': 3};//max number of parties per computation

var key_map = {};// public key map

io.on('connection', function(socket) {
  console.log('user connected');

  // Receive each user's desired computation
  socket.on('computation_id', function(msg) {
    var party_id = ++(client_map[msg]);

    computation_map[socket.id] = msg;
    party_map[socket.id] = party_id;

    socket_map[msg][party_id] = socket.id;
    io.to(socket.id).emit('init', party_id);
  });

  // Receive each user's public key
  socket.on('public_key', function(msg) {
    var party_id = party_map[socket.id];
    var computation_id = computation_map[socket.id];

    // store public key in key_map
    var tmp = key_map[computation_id];
    if(tmp == null) tmp = {};
    tmp[party_id] = msg;
    key_map[computation_id] = tmp;

    // Check if all public keys for this computation are received
    var full = true;
    for(var i = 1; i <= totalparty_map[computation_id]; i++) {
      if(key_map[computation_id][i] == null) {
        full = false;
        break;
      }
    }

    // If everyone sent their public key, emit all the keys to everyone
    if(full) {
      io.emit('public_key', JSON.stringify(key_map[computation_id]));
    }
  });

  socket.on('disconnect', function() {
    console.log('user disconnected');
    var computation_id = computation_map[socket.id];
    var party_id = party_map[socket.id];

    party_map[socket.id] = null;
    computation_map[socket.id] = null;
    socket_map[computation_id][party_id] = null;
    key_map[computation_id][party_id] = null;
  });

  socket.on('share', function(msg) {
    var computation_id = computation_map[socket.id];
    var from_id = party_map[socket.id];

    console.log('share from ' + computation_id + "-" + from_id + ' : ' + msg);

    var json_msg = JSON.parse(msg);
    var to_id = json_msg["party_id"];
    json_msg["party_id"] = from_id;

    io.to(socket_map[computation_id][to_id]).emit('share', JSON.stringify(json_msg));
  });

  socket.on('open', function(msg) {
    var computation_id = computation_map[socket.id];
    var from_id = party_map[socket.id];

    console.log('open from ' + computation_id + "-" + from_id + ' : ' + msg);

    var json_msg = JSON.parse(msg);
    var to_id = json_msg["party_id"];
    json_msg["party_id"] = from_id;

    io.to(socket_map[computation_id][to_id]).emit('open', JSON.stringify(json_msg));
  });

});

http.listen(3000, function(){
  console.log('listening on *:3000');
});
