var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var socket_map = {};
var party_map = {};
var nclient = 0;

io.on('connection', function(socket){

  console.log('user connected');
  nclient++;
  socket_map[nclient] = socket.id;
  party_map[socket.id] = nclient;
  
  //Let each user know his/her ID once connected
  socket.on('init', function(){
      io.to(socket.id).emit('init', JSON.stringify(nclient));
  });

  socket.on('disconnect', function(){
    console.log('user disconnected');
    party_map[socket.id] = null;
    socket_map[nclient] = null;
  });

  socket.on('share', function(msg){
    console.log('share: ' + msg);

    var json_msg = JSON.parse(msg);
    var index = json_msg["party_id"];
    json_msg["party_id"] = party_map[socket.id];

    io.to(socket_map[index]).emit('share', JSON.stringify(json_msg));
  });

});

http.listen(3000, function(){
  console.log('listening on *:3000');
});
