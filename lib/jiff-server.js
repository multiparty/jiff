module.exports = {
  make_jiff: function(http, Zp) {
    var io = require('socket.io')(http);
    var cryptico = require('cryptico');
    var client = require('./jiff-client');
    
    var jiff = {};
    // The modulos to be used in secret sharing and operations on shares.
    if(Zp == null) {
      Zp = client.gZp;
    }

    // map of maps [computation id][party id] = socket id
    var socket_map = {};
    jiff.socket_map = socket_map;
    
    // socket.id -> party_id
    var party_map = {};
    jiff.party_map = party_map;
    
    // socket.id -> computation_id
    var computation_map = {};
    jiff.computation_map = computation_map;

    // current number of parties per computation
    var client_map = {};
    jiff.client_map = client_map;
    
    // max number of parties per computation
    var totalparty_map = {};
    jiff.totalparty_map = totalparty_map;

    // public key map
    var key_map = {};
    jiff.key_map = key_map;
    
    // computation id -> secret key (for every computation the server has a different key pair).
    var secret_key_map = {};
    jiff.secret_key_map = secret_key_map;
    
    // computation_id -> { triplet_id -> { party_id -> [triplet shares for this party] } }
    var triplets_map = {};
    jiff.triplets_map = triplets_map;
    
    // computation_id -> { number_id -> { party_id -> number share for this party } }    
    var numbers_map = {};
    jiff.numbers_map = numbers_map;

    io.on('connection', function(socket) {
      console.log('user connected');

      // Receive each user's desired computation
      socket.on('computation_id', function(msg) {
        msg = JSON.parse(msg);
        
        // read message
        var computation_id = msg['computation_id'];
        var party_id = msg['party_id'];
        var party_count = msg['party_count'];
        
        if(client_map[computation_id] == null) client_map[computation_id] = 0;
        if(socket_map[computation_id] == null) socket_map[computation_id] = {};
        
        if(party_id == null) party_id = ++(client_map[computation_id]);
        if(party_count == null) party_count = totalparty_map[computation_id];
        
        // no party count given or saved.
        if(party_count == null) {
          io.to(socket.id).emit('error', "party count is not specified nor pre-saved");
        }
        
        // given party count contradicts the count that is already saved.
        else if(totalparty_map[computation_id] != null && party_count != totalparty_map[computation_id]) {
          io.to(socket.id).emit('error', "contradicting party count");
        }
        
        // given party id is already claimed by someone else.
        else if(socket_map[computation_id][party_id] != null) {
          io.to(socket.id).emit('error', party_id + " is already taken");
        }
        
        else if(isNaN(party_id) || party_id <= 0) {
          io.to(socket.id).emit('error', "Invalid party ID");      
        }
        
        else if(party_id > party_count) {
          io.to(socket.id).emit('error', "Maximum parties capacity reached");
        }
        
        else {      
          totalparty_map[computation_id] = party_count;
          socket_map[computation_id][party_id] = socket.id;
          computation_map[socket.id] = computation_id;
          party_map[socket.id] = party_id;

          io.to(socket.id).emit('init', JSON.stringify({ party_id: party_id, party_count: party_count }));
        }
      });

      // Receive each user's public key
      socket.on('public_key', function(msg) {
        var party_id = party_map[socket.id];
        var computation_id = computation_map[socket.id];

        // store public key in key_map
        var tmp = key_map[computation_id];
        if(tmp == null) {
          // public and secret key for server
          secret_key_map[computation_id] = cryptico.generateRSAKey(client.random_string(client.passphrase_size), client.RSA_bits);
          tmp = { "s1": cryptico.publicKeyString(secret_key_map[computation_id]) };
        }
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
        try {
          var computation_id = computation_map[socket.id];
          var party_id = party_map[socket.id];

          party_map[socket.id] = null;
          computation_map[socket.id] = null;
          socket_map[computation_id][party_id] = null;
          key_map[computation_id][party_id] = null;
        } catch(ex) { }
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
      socket.on('triplet', function(msg) {
        var computation_id = computation_map[socket.id];
        var from_id = party_map[socket.id];
        
        // decrypt and verify signature
        try {
          msg = client.decrypt_and_sign(msg, secret_key_map[computation_id], key_map[computation_id][from_id], true);
        } catch(error) { // invalid signature
          console.log('triplet ' + triplet_id + ' from ' + computation_id + "-" + from_id + ' Zp ' + Zp + " : " + error);
          io.to(socket_map[computation_id][from_id]).emit('error', 'invalid signature');
          return;
        }
        
        // parse message      
        msg = JSON.parse(msg);
        var triplet_id = msg.triplet_id;
        var Zp = msg.Zp;
        
        console.log('triplet ' + triplet_id + ' from ' + computation_id + "-" + from_id + ' Zp ' + Zp);
        
        if(triplets_map[computation_id] == null) 
          triplets_map[computation_id] = {};
          
        var all_triplets = triplets_map[computation_id];  
        if(all_triplets[triplet_id] == null) { // Generate Triplet.
          var a = Math.floor(Math.random() * Zp);
          var b = Math.floor(Math.random() * Zp);
          var c = client.mod(a * b, Zp);
          
          var all_parties_list = [];
          for(var i = 1; i <= totalparty_map[computation_id]; i++) all_parties_list.push(i);
          
          var a_shares = client.jiff_compute_shares(a, totalparty_map[computation_id], all_parties_list, Zp);
          var b_shares = client.jiff_compute_shares(b, totalparty_map[computation_id], all_parties_list, Zp);
          var c_shares = client.jiff_compute_shares(c, totalparty_map[computation_id], all_parties_list, Zp);
          
          var triplet_shares = {};
          for(var i = 1; i <= totalparty_map[computation_id]; i++) {
            // Encrypt and store shares
            var pkey = key_map[computation_id][i];
            var a = client.encrypt_and_sign(a_shares[i], pkey, secret_key_map[computation_id]);
            var b = client.encrypt_and_sign(b_shares[i], pkey, secret_key_map[computation_id]);
            var c = client.encrypt_and_sign(c_shares[i], pkey, secret_key_map[computation_id]);
            
            triplet_shares[i] = { a: a, b: b, c: c };
          }
          
          all_triplets[triplet_id] = triplet_shares;
        }
        
        var triplet_msg = { triplet: all_triplets[triplet_id][from_id], triplet_id: triplet_id };
        io.to(socket_map[computation_id][from_id]).emit('triplet', JSON.stringify(triplet_msg));
      });
      
      // Triplet count is like a program counter for triplets, to ensure all 
      // parties get matching shares of the same triplet.
      socket.on('number', function(msg) {
        var computation_id = computation_map[socket.id];
        var from_id = party_map[socket.id];
        
        // decrypt and verify signature
        try {
          msg = client.decrypt_and_sign(msg, secret_key_map[computation_id], key_map[computation_id][from_id], true);
        } catch(error) { // invalid signature
          console.log('Error in triplet from ' + computation_id + "-" + from_id + ": " + error);
          io.to(socket_map[computation_id][from_id]).emit('error', 'invalid signature');
          return;
        }
        
        // parse message
        msg = JSON.parse(msg);
        var number_id = msg.number_id;
        var Zp = msg.Zp;
        var bit = msg.bit;
        var nonzero = msg.nonzero;
        var max = msg.max;
        if(max == null) max = Zp;
                
        console.log('number ' + number_id + ' from ' + computation_id + "-" + from_id + ' Options ' + JSON.stringify(msg));
        
        if(numbers_map[computation_id] == null) 
          numbers_map[computation_id] = {};
          
        var all_numbers = numbers_map[computation_id];  
        if(all_numbers[number_id] == null) { // Generate shares for number.
          var number = Math.floor(Math.random() * max);
          
          if(msg.number != null) number = msg.number;
          else if(bit === true && nonzero === true) number = 1;
          else if(bit == true) number = number % 2;
          else if(nonzero == true && number == 0) number = Math.floor(Math.random() * (max-1)) + 1;
          
          // Compute shares
          var all_parties_list = [];
          for(var i = 1; i <= totalparty_map[computation_id]; i++) all_parties_list.push(i);
          var shares = client.jiff_compute_shares(number, totalparty_map[computation_id], all_parties_list, Zp);
          
          // Encrypt and store shares
          for(var i = 1; i <= totalparty_map[computation_id]; i++) {
            var pkey = key_map[computation_id][i];
            shares[i] = client.encrypt_and_sign(shares[i], pkey, secret_key_map[computation_id]);
          }
          all_numbers[number_id] = shares;
        }
        
        var number_msg = { number: all_numbers[number_id][from_id], number_id: number_id };
        io.to(socket_map[computation_id][from_id]).emit('number', JSON.stringify(number_msg));
      });
    });
    
    return jiff;
  }
};
