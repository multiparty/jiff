var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var socket_map = {};
var party_map = {};
var key_map = {};
var nclient = 0;
var total_parties = 3;

io.on('connection', function(socket){

  console.log('user connected');
  nclient++;
  socket_map[nclient] = socket.id;
  party_map[socket.id] = nclient;

  // Receive each user's public key
  socket.on('public_key', function(msg){
    var party_id = party_map[socket.id];

    key_map[party_id] = msg;
    console.log('receive public key: ' + msg);

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

  //Let each user know his/her ID once connected
  io.to(socket.id).emit('init', nclient);


  socket.on('disconnect', function(){
    console.log('user disconnected');
    party_map[socket.id] = null;
    socket_map[nclient] = null;
  });

  socket.on('share', function(msg){
    console.log('share from ' + party_map[socket.id] + ' : ' + msg);

    var json_msg = JSON.parse(msg);
    var index = json_msg["party_id"];
    json_msg["party_id"] = party_map[socket.id];

    io.to(socket_map[index]).emit('share', JSON.stringify(json_msg));
  });

  socket.on('open', function(msg){
    console.log('open from ' + party_map[socket.id] + ' : ' + msg);

    var json_msg = JSON.parse(msg);
    var index = json_msg["party_id"];
    json_msg["party_id"] = party_map[socket.id];

    io.to(socket_map[index]).emit('open', JSON.stringify(json_msg));
  });

});

http.listen(3000, function(){
  console.log('listening on *:3000');
});
