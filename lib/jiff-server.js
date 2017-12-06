var cryptico = require('cryptico');
var client = require('./jiff-client');
var $ = require('jquery-deferred');

module.exports = {
  // Create a server instance that can be used to manage all the computations and run server side code.
  make_jiff: function(http, options) {
    // the jiff (server) instance to make.
    var jiff = {};

    // parse options
    if(options == null) options = {};
    jiff.logs = options.logs !== false;

    // Import socket.io
    var io = require('socket.io')(http);
    jiff.io = io;

    // { computation_id -> { party_id -> socket_id } }
    var socket_map = {};
    jiff.socket_map = socket_map;

    // { socket.id -> party_id }
    var party_map = {};
    jiff.party_map = party_map;

    // { socket.id -> computation_id }
    var computation_map = {};
    jiff.computation_map = computation_map;

    // { computation_id -> current number of parties in that computation }
    var client_map = {};
    jiff.client_map = client_map;

    // { computation_id -> max number of parties for that computation }
    var totalparty_map = {};
    jiff.totalparty_map = totalparty_map;

    // { computation_id -> { party_id -> public_key } }
    var key_map = {};
    jiff.key_map = key_map;

    // { computation_id -> secret key (for every computation the server has a different key pair) }
    var secret_key_map = {};
    jiff.secret_key_map = secret_key_map;

    // { computation_id -> { triplet_id -> { party_id -> [triplet shares for this party] } } }
    var triplets_map = {};
    jiff.triplets_map = triplets_map;

    // { computation_id -> { number_id -> { party_id -> number share for this party } } }
    var numbers_map = {};
    jiff.numbers_map = numbers_map;

    // { computation_id -> computation_instance }
    var computation_instances_map = {};
    jiff.computation_instances_map = computation_instances_map;

    // { computation_id -> deferred that will be resolve when computation is ready to start }
    var start_computation_deferred = {};
    jiff.start_computation_deferred = start_computation_deferred;

    // { computation_id -> a deferreds map used by that computation server side code }
    var computation_deferreds = {};
    jiff.computation_deferreds = computation_deferreds;

    // { computation_id -> a deferreds map used by that computation server side code }
    var computation_shares = {};
    jiff.computation_shares = computation_shares;

    var establish_server_side_connections = options.establish_server_side_connections !== false;
    var server_side_jiff_instances = {'1':[]};
    jiff.server_side_jiff_instances = server_side_jiff_instances;

    // this provides a way for users to specify what part(s) of computation to run on server
    jiff.compute = function(computation_id, computation_callback) {
      // Schedule this computation to be executed when all parties connect and server sends the start signal.
      if(start_computation_deferred[computation_id] == null) start_computation_deferred[computation_id] = $.Deferred();
      if(computation_deferreds[computation_id] == null) computation_deferreds[computation_id] = {};
      if(computation_shares[computation_id] == null) computation_shares[computation_id] = {};

      start_computation_deferred[computation_id].promise().then(function() {
          computation_callback(computation_instances_map[computation_id]);
        }
      );
    }

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

        if(computation_deferreds[computation_id] == null) computation_deferreds[computation_id] = {};
        if(computation_shares[computation_id] == null) computation_shares[computation_id] = {};

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

        // if this flag is turned on, establish jiff instances server-side
        // to enable instant connections
        if (establish_server_side_connections == true) {
          console.log("connect server side");

          // calculate how many server-side clients we need
          var server_side_clients = totalparty_map[computation_id] - client_map[computation_id]
          
          if (server_side_clients > 0){
            console.log("creating " + server_side_clients + " server-side clients");
            server_side_jiff_instances[computation_id] = [];
            for (var i = 0; i < server_side_clients; i++){
              var jiff_instance = jiff.make_jiff("http://localhost:3000", computation_id, {"computation_id":computation_id,"party_count":msg.party_count});
              server_side_jiff_instances[computation_id].push(jiff_instance);
            }
          }
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
          // This computation is ready and about to start, create a computation instance for it so that
          // server side computations for it may be defined and executed.
          computation_instances_map[computation_id] = module.exports.create_computation_instance(jiff, computation_id);

          io.emit('public_key', JSON.stringify(key_map[computation_id]));

          // Execute/resolve up any server side computation that should be executed in this computation
          if(start_computation_deferred[computation_id] == null) start_computation_deferred[computation_id] = $.Deferred();
          start_computation_deferred[computation_id].resolve();
        }
      });

      socket.on('disconnect', function() {
        console.log('user disconnected');
      });

      socket.on('share', function(msg) {
        var computation_id = computation_map[socket.id];
        var from_id = party_map[socket.id];

        if(jiff.logs)
          console.log('share from ' + computation_id + "-" + from_id + ' : ' + msg);

        var json_msg = JSON.parse(msg);
        var to_id = json_msg["party_id"];
        json_msg["party_id"] = from_id;

        if(to_id == 's1')
          client.receive_share(computation_instances_map[computation_id], from_id, json_msg['share'], json_msg['op_id']);
        else
          io.to(socket_map[computation_id][to_id]).emit('share', JSON.stringify(json_msg));
      });

      socket.on('open', function(msg) {
        var computation_id = computation_map[socket.id];
        var from_id = party_map[socket.id];

        if(jiff.logs)
          console.log('open from ' + computation_id + "-" + from_id + ' : ' + msg);

        var json_msg = JSON.parse(msg);
        var to_id = json_msg["party_id"];
        json_msg["party_id"] = from_id;

        if(to_id == 's1')
          client.receive_open(computation_instances_map[computation_id], from_id, json_msg['share'], json_msg['op_id'], json_msg['Zp']);
        else
          io.to(socket_map[computation_id][to_id]).emit('open', JSON.stringify(json_msg));
      });

      // triplet_id is like a program counter for triplets, to ensure all
      // parties get matching shares of the same triplet.
      socket.on('triplet', function(msg) {
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

        // request/generate triplet share.
        var triplet_msg = JSON.stringify(jiff.request_triplet_share(msg, computation_id, from_id));

        // encrypt an sign message then send it.
        var pkey = key_map[computation_id][from_id];
        triplet_msg = client.encrypt_and_sign(triplet_msg, pkey, secret_key_map[computation_id], true);

        io.to(socket_map[computation_id][from_id]).emit('triplet', triplet_msg);
      });

      // number_id is like a program counter for requested shares of numbers, to ensure all
      // parties get matching shares of the same number.
      socket.on('number', function(msg) {
        var computation_id = computation_map[socket.id];
        var from_id = party_map[socket.id];

        // decrypt and verify signature.
        try {
          msg = client.decrypt_and_sign(msg, secret_key_map[computation_id], key_map[computation_id][from_id], true);
        } catch(error) { // invalid signature
          console.log('Error in number from ' + computation_id + "-" + from_id + ": " + error);
          io.to(socket_map[computation_id][from_id]).emit('error', 'invalid signature');
          return;
        }

        // request/generate number share.
        var number_msg = JSON.stringify(jiff.request_number_share(msg, computation_id, from_id));

        // encrypt and sign message then send it.
        var pkey = key_map[computation_id][from_id];
        number_msg = client.encrypt_and_sign(number_msg, pkey, secret_key_map[computation_id], true);

        io.to(socket_map[computation_id][from_id]).emit('number', number_msg);
      });
    });

    // Reusable functions/code for generating/requesting numbers and triplets shares.
    jiff.request_triplet_share = function(msg, computation_id, from_id) {
      // parse message
      msg = JSON.parse(msg);
      var triplet_id = msg.triplet_id;
      var receivers = msg.receivers;
      var threshold = msg.threshold;
      var Zp = msg.Zp;

      if(jiff.logs)
        console.log('triplet ' + triplet_id + ' from ' + computation_id + "-" + from_id + ":: " + JSON.stringify(msg));

      if(triplets_map[computation_id] == null)
        triplets_map[computation_id] = {};

      var all_triplets = triplets_map[computation_id];
      if(all_triplets[triplet_id] == null) { // Generate Triplet.
        var a = Math.floor(Math.random() * Zp);
        var b = Math.floor(Math.random() * Zp);
        var c = client.mod(a * b, Zp);

        var a_shares = client.jiff_compute_shares(a, totalparty_map[computation_id], receivers, threshold, Zp);
        var b_shares = client.jiff_compute_shares(b, totalparty_map[computation_id], receivers, threshold, Zp);
        var c_shares = client.jiff_compute_shares(c, totalparty_map[computation_id], receivers, threshold, Zp);

        var triplet_shares = {};
        for(var i = 0; i < receivers.length; i++) {
          var pid = receivers[i];
          var a = a_shares[pid];
          var b = b_shares[pid];
          var c = c_shares[pid];

          triplet_shares[pid] = { a: a, b: b, c: c };
        }

        all_triplets[triplet_id] = triplet_shares;
      }

      return { triplet: all_triplets[triplet_id][from_id], triplet_id: triplet_id };
    }

    jiff.request_number_share = function(msg, computation_id, from_id) {
      // parse message/request
      msg = JSON.parse(msg);
      var number_id = msg.number_id;
      var receivers = msg.receivers;
      var threshold = msg.threshold;
      var Zp = msg.Zp;
      var bit = msg.bit;
      var nonzero = msg.nonzero;
      var max = msg.max;
      if(max == null) max = Zp;

      if(jiff.logs)
        console.log('number ' + number_id + ' from ' + computation_id + "-" + from_id + ":: " + JSON.stringify(msg));

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
        all_numbers[number_id] = client.jiff_compute_shares(number, totalparty_map[computation_id], receivers, threshold, Zp);
      }

      return { number: all_numbers[number_id][from_id], number_id: number_id };
    };

    return jiff;
  },

  // Create a computation id that provides an identical API to that of clients for the given computation.
  create_computation_instance: function(jiff, computation_id) {
    // Ensure computation exists and is ready
    if(jiff.totalparty_map[computation_id] == null) throw "Cannot Create computation instance. Computation " + computation_id + " does not exist!";

    // Computation attributes similar to client.
    var computation_instance = {};
    computation_instance.server = jiff;
    computation_instance.computation_id = computation_id;
    computation_instance.ready = true;
    computation_instance.id = "s1";
    computation_instance.secret_key = jiff.secret_key_map[computation_id];
    computation_instance.public_key = jiff.key_map[computation_id][computation_instance.id];
    computation_instance.keymap = jiff.key_map[computation_id];
    computation_instance.party_count = jiff.totalparty_map[computation_id];
    computation_instance.server_count = 1;

    // Counters similar to client
    computation_instance.share_op_count = {};
    computation_instance.open_op_count = {};
    computation_instance.triplet_op_count = {};
    computation_instance.number_op_count = {};
    computation_instance.share_obj_count = 0;

    // Store a map from a sharing id (which share operation) to the
    // corresponding deferred and shares array (Similar to client).
    computation_instance.deferreds = jiff.computation_deferreds[computation_id];
    computation_instance.shares = jiff.computation_shares[computation_id];

    // Identical API to client.
    computation_instance.share = function(secret, threshold, receivers_list, senders_list, Zp) {
      return client.jiff_share(computation_instance, secret, threshold, receivers_list, senders_list, Zp);
    };
    computation_instance.open = function(share, parties) {
      return client.jiff_open(computation_instance, share, parties);
    };
    computation_instance.open_all = function(shares, parties) {
      return client.jiff_open_all(computation_instance, shares, parties);
    };
    computation_instance.generate_and_share_random = function(threshold, receivers_list, senders_list, Zp) {
      return client.jiff_share_all_number(computation_instance, Math.floor(Math.random() * Zp), threshold, receivers_list, senders_list, Zp);
    };
    computation_instance.generate_and_share_zero = function(threshold, receivers_list, senders_list, Zp) {
      return client.jiff_share_all_number(computation_instance, 0, threshold, receivers_list, senders_list, Zp);
    };
    computation_instance.coerce_to_share = function(number, holders, Zp) {
      return client.jiff_coerce_to_share(computation_instance, number, holders, Zp);
    };
    computation_instance.triplet = function(receivers_list, threshold, Zp) {
      return client.jiff_triplet(computation_instance, receivers_list, threshold, Zp);
    };
    computation_instance.server_generate_and_share = function(options, receivers_list, threshold, Zp) {
      return client.jiff_server_share_number(computation_instance, options, receivers_list, threshold, Zp)
    };

    // Mimic Sockets API:
    // share / open
    computation_instance.socket = {
      emit: function(label, msg) {
        if(label == 'share' || label == 'open') {
          // parse message to figure out who to send to
          var json_msg = JSON.parse(msg);
          var from_id = computation_instance.id;

          // modify message
          var to_id = json_msg["party_id"];
          json_msg["party_id"] = from_id;

          // send message through the appropriate socket
          var socket_to_use = jiff.socket_map[computation_id][to_id]
          jiff.io.to(socket_to_use).emit(label, JSON.stringify(json_msg));
        }
      }
    };

    // triplet(s) requests
    computation_instance.triplets_socket = {
      emit: function(label, msg) {
        if(label == 'triplet') {
          // Use server code to retrieve/compute share
          var result = jiff.request_triplet_share(msg, computation_id, computation_instance.id);

          // receive result into client code
          client.receive_triplet(computation_instance, result.triplet_id, result.triplet);
          // Dont forget to encrypt if number_sockets needs to be used indeed (for future).
        }
      }
    };

    // number(s) requests
    computation_instance.numbers_socket = {
      emit: function(label, msg) {
        if(label == 'number') {
          // Use server code to retrieve/compute share
          var result = jiff.request_number_share(msg, computation_id, computation_instance.id);

          // receive result into client code
          client.receive_server_share_number(computation_instance, result.number_id, result.number);
          // Dont forget to encrypt if number_sockets needs to be used indeed (for future).
        }
      }
    };

    return computation_instance;
  }
};
