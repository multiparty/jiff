var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);

// The modulos to be used in secret sharing and operations on shares.
var Zp = 1031;

var socket_map = {'1':{},'2':{},'3':{}};// map of maps [computation id][party id] = socket id

var party_map = {};// socket.id -> party_id
var computation_map = {}; // socket.id -> computation_id

var client_map = {'1': 0};//total number of parties per computation
var totalparty_map = {'1': 3};//max number of parties per computation

var key_map = {};// public key map
var triplets_map = {};

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
  
  // Triplet count is like a program counter for triplets, to ensure all 
  // parties get matching shares of the same triplet.
  socket.on('triplet', function(triplet_count) {
    var computation_id = computation_map[socket.id];
    var from_id = party_map[socket.id];
    
    console.log('triplet ' + triplet_count + ' from ' + computation_id + "-" + from_id);
    
    if(triplets_map[computation_id] == null) 
      triplets_map[computation_id] = {};
      
    var all_triplets = triplets_map[computation_id];  
    if(all_triplets[triplet_count] == null) { // Generate Triplet.
      var a = Math.floor(Math.random() * Zp);
      var b = Math.floor(Math.random() * Zp);
      var c = mod(a * b, Zp);
      
      var a_shares = jiff_compute_shares(a, totalparty_map[computation_id]);
      var b_shares = jiff_compute_shares(b, totalparty_map[computation_id]);
      var c_shares = jiff_compute_shares(c, totalparty_map[computation_id]);
      
      var triplet_shares = {};
      for(var i = 1; i <= totalparty_map[computation_id]; i++)
        triplet_shares[i] = { a: a_shares[i], b: b_shares[i], c: c_shares[i] };
      
      all_triplets[triplet_count] = triplet_shares;
    }
    
    var triplet_msg = { triplet: all_triplets[triplet_count][from_id], count: triplet_count };
    io.to(socket_map[computation_id][from_id]).emit('triplet', JSON.stringify(triplet_msg));
  });
});

http.listen(3000, function(){
  console.log('listening on *:3000');
});

// Mod instead of javascript's remainder (%)
function mod(x, y) {
  if (x < 0) {
      return ((x%y)+y)%y;
    }

  return x%y;
}

/*
 * Compute the shares of the secret (as many shares as parties) using
 * a polynomial of degree: ceil(parties/2) - 1 (honest majority).
 *   secret:        the secret to share.
 *   party_count:   the number of parties.
 *   return:        a map between party number (from 1 to parties) and its
 *                  share, this means that (party number, share) is a
 *                  point from the polynomial.
 *
 */
function jiff_compute_shares(secret, party_count) {
  var shares = {}; // Keeps the shares

  // Each player's random polynomial f must have
  // degree t = ceil(n/2)-1, where n is the number of players
  // var t = Math.floor((party_count-1)/ 2);
  var t = party_count-1;
  var polynomial = Array(t+1); // stores the coefficients

  // Each players's random polynomial f must be constructed
  // such that f(0) = secret
  polynomial[0] = secret;

  // Compute the random polynomial f's coefficients
  for(var i = 1; i <= t; i++) polynomial[i] = Math.floor(Math.random() * Zp);

  // Compute each players share such that share[i] = f(i)
  for(var i = 1; i <= party_count; i++) {
    shares[i] = polynomial[0];
    power = i;

    for(var j = 1; j < polynomial.length; j++) {
      shares[i] = mod((shares[i] + polynomial[j] * power), Zp);
      power = power * i;
    }
  }

  return shares;
}
