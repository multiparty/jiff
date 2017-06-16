var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var socket_map = {'1':{},'2':{},'3':{}};
var party_map = {};
var computation_map = {};
var client_map = {'1':0, '2':0, '3':0};//total number of parties per computation
var totalparty_map = {'1':3, '2':3, '3':3};//max number of parties per computation
var key_map = {};
var total_parties = 3;

io.on('connection', function(socket){

  console.log('user connected');

  // Receive each user's desired computation
  socket.on('computation_id', function(msg){
    client_map[msg]++;
    computation_map[socket.id] = msg;
    socket_map[msg][client_map[msg]] = socket.id;
    party_map[socket.id] = client_map[msg];
    io.to(socket.id).emit('init', party_map[socket.id]);
  });

  // Receive each user's public key
  socket.on('public_key', function(msg){
    var party_id = party_map[socket.id];

    key_map[party_id] = msg;

    var full = true;
    for(var i=1; i <= total_parties; i++){

      if(key_map[i] == null){
        full = false;
        break;
      }
    }

    if(full){
      io.emit('public_key', JSON.stringify(key_map));
    }
  });


  socket.on('disconnect', function(){
    console.log('user disconnected');
    party_map[socket.id] = null;
    socket_map[computation_map[socket.id]][party_map[socket.id]] = null;
  });

  socket.on('share', function(msg){
    console.log('share from ' + party_map[socket.id] + ' : ' + msg);

    var json_msg = JSON.parse(msg);
    var index = json_msg["party_id"];
    json_msg["party_id"] = party_map[socket.id];

    io.to(socket_map[computation_map[socket.id]][index]).emit('share', JSON.stringify(json_msg));
  });

  socket.on('open', function(msg){
    console.log('open from ' + party_map[socket.id] + ' : ' + msg);

    var json_msg = JSON.parse(msg);
    var index = json_msg["party_id"];
    json_msg["party_id"] = party_map[socket.id];

    io.to(socket_map[computation_map[socket.id]][index]).emit('open', JSON.stringify(json_msg));
  });

});

http.listen(3000, function(){
  console.log('listening on *:3000');
});
