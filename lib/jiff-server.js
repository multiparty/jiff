var client = require('./jiff-client');
var $ = require('jquery-deferred');

module.exports = {
  // Create a server instance that can be used to manage all the computations and run server side code.
  make_jiff: function(http, options) {
    // the jiff (server) instance to make.
    var jiff = {};

    // require sodium instance
    jiff.sodium = require('libsodium-wrappers');
    jiff.sodium_promise = jiff.sodium.ready;

    // parse options
    if(options == null) options = {};
    jiff.logs = options.logs !== false;

    // hooks: TODO

    // helpers
    jiff.helpers = {};
    jiff.helpers.random = function(max) {
      return Math.floor(Math.random() * max);
    };

    // Import socket.io
    var io = require('socket.io')(http);
    // var io = require('socket.io')(http, { pingTimeout: 360000, pingInterval: 180000 });
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

    // { computation_id -> <privateKey> } (for every computation the server has a different key pair)
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

    // { computation_id -> computation_instance_deferred: resolve when instance is ready }
    var computation_instances_deferred = {};
    jiff.computation_instances_deferred = computation_instances_deferred;

    // { computation_id -> deferred that will be resolve when computation is ready to start }
    var start_computation_deferred = {};
    jiff.start_computation_deferred = start_computation_deferred;

    // this provides a way for users to specify what part(s) of computation to run on server
    jiff.compute = function(computation_id, options) {
      // Schedule this computation to be executed when all parties connect and server sends the start signal.
      if(start_computation_deferred[computation_id] == null) start_computation_deferred[computation_id] = $.Deferred();
      if(computation_instances_deferred[computation_id] == null) computation_instances_deferred[computation_id] = $.Deferred();
      computation_instances_map[computation_id] = create_computation_instance(jiff, computation_id, options);
      return computation_instances_map[computation_id];
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
        jiff.sodium_promise.then(function() {
          var party_id = party_map[socket.id];
          var computation_id = computation_map[socket.id];

          // store public key in key_map
          var tmp = key_map[computation_id];
          if(tmp == null) {
            // public and secret key for server
            var genkey = jiff.sodium.crypto_box_keypair();
            secret_key_map[computation_id] = genkey.privateKey;
            tmp = { "s1": genkey.publicKey };
          }
          tmp[party_id] = new Uint8Array(JSON.parse(msg));
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
            var keymap_to_send = {};
            for(var i in key_map[computation_id])
              if(key_map[computation_id].hasOwnProperty(i))
                keymap_to_send[i] = '['+key_map[computation_id][i].toString()+']';

            // Execute/resolve up any server side computation that should be executed in this computation
            if(start_computation_deferred[computation_id] == null) start_computation_deferred[computation_id] = $.Deferred();
            if(computation_instances_deferred[computation_id] == null) computation_instances_deferred[computation_id] = $.Deferred();
            start_computation_deferred[computation_id].resolve();

            io.emit('public_key', JSON.stringify(keymap_to_send));
          }
        });
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
          computation_instances_deferred[computation_id].then(function() { computation_instances_map[computation_id].socket.receive('share', JSON.stringify(json_msg)) });
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
          computation_instances_deferred[computation_id].then(function() { computation_instances_map[computation_id].socket.receive('open', JSON.stringify(json_msg)) });
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
          msg = client.utils.decrypt_and_sign(msg, secret_key_map[computation_id], key_map[computation_id][from_id], 'triplet');
        } catch(error) { // invalid signature
          console.log('Error in triplet from ' + computation_id + "-" + from_id + ": " + error);
          io.to(socket_map[computation_id][from_id]).emit('error', 'invalid signature');
          return;
        }

        // request/generate triplet share.
        var triplet_msg = jiff.request_triplet_share(msg, computation_id, from_id);

        // encrypt an sign message then send it.
        var pkey = key_map[computation_id][from_id];
        triplet_msg = client.utils.encrypt_and_sign(triplet_msg, pkey, secret_key_map[computation_id], 'triplet');

        io.to(socket_map[computation_id][from_id]).emit('triplet', triplet_msg);
      });

      // number_id is like a program counter for requested shares of numbers, to ensure all
      // parties get matching shares of the same number.
      socket.on('number', function(msg) {
        var computation_id = computation_map[socket.id];
        var from_id = party_map[socket.id];

        // decrypt and verify signature.
        try {
          msg = client.utils.decrypt_and_sign(msg, secret_key_map[computation_id], key_map[computation_id][from_id], 'number');
        } catch(error) { // invalid signature
          console.log('Error in number from ' + computation_id + "-" + from_id + ": " + error);
          io.to(socket_map[computation_id][from_id]).emit('error', 'invalid signature');
          return;
        }

        // request/generate number share.
        var number_msg = jiff.request_number_share(msg, computation_id, from_id);

        // encrypt and sign message then send it.
        var pkey = key_map[computation_id][from_id];
        number_msg = client.utils.encrypt_and_sign(number_msg, pkey, secret_key_map[computation_id], 'number');

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
        var a = jiff.helpers.random(Zp);
        var b = jiff.helpers.random(Zp);
        var c = (a * b) % Zp;

        var jiff_client_imitation = {
          party_count: totalparty_map[computation_id],
          helpers: {
            random: jiff.helpers.random,
            mod: function(x, y) { if(x < 0) return (x % y) + y; return x % y; },
            get_party_number: function(party_id) {
              if (typeof(party_id) == "number") return party_id;
              if (party_id.startsWith("s")) return jiff_client_imitation.party_count + parseInt(party_id.substring(1), 10);
              return parseInt(party_id, 10);
            }
          }
        };

        var a_shares = client.sharing_schemes.shamir_share(jiff_client_imitation, a, receivers, threshold, Zp);
        var b_shares = client.sharing_schemes.shamir_share(jiff_client_imitation, b, receivers, threshold, Zp);
        var c_shares = client.sharing_schemes.shamir_share(jiff_client_imitation, c, receivers, threshold, Zp);

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

      return JSON.stringify({ triplet: all_triplets[triplet_id][from_id], triplet_id: triplet_id });
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
        var number = jiff.helpers.random(max);

        if(msg.number != null) number = msg.number;
        else if(bit === true && nonzero === true) number = 1;
        else if(bit == true) number = number % 2;
        else if(nonzero == true && number == 0) number = jiff.helpers.random(max - 1) + 1;

        // Compute shares
        var jiff_client_imitation = {
          party_count: totalparty_map[computation_id],
          helpers: {
            random: jiff.helpers.random,
            mod: function(x, y) { if(x < 0) return (x % y) + y; return x % y; },
            get_party_number: function(party_id) {
              if (typeof(party_id) == "number") return party_id;
              if (party_id.startsWith("s")) return jiff_client_imitation.party_count + parseInt(party_id.substring(1), 10);
              return parseInt(party_id, 10);
            }
          }
        };
        all_numbers[number_id] = client.sharing_schemes.shamir_share(jiff_client_imitation, number, receivers, threshold, Zp);
      }

      return JSON.stringify({ number: all_numbers[number_id][from_id], number_id: number_id });
    };

    return jiff;
  }
};

// Create a computation id that provides an identical API to that of clients for the given computation.
function create_computation_instance(jiff, computation_id, options) {
  // Mimic Sockets API:
  var internal_socket = {
    callbacks: {},
    on: function(tag, callback) { internal_socket.callbacks[tag] = callback; },
    receive: function(tag, param) { internal_socket.callbacks[tag](param); },
    emit: function(label, msg) {
      if(label == 'share' || label == 'open') {
        // parse message to figure out who to send to
        var json_msg = JSON.parse(msg);
        var from_id = "s1";

        // modify message
        var to_id = json_msg["party_id"];
        json_msg["party_id"] = from_id;

        // send message through the appropriate socket
        var socket_to_use = jiff.socket_map[computation_id][to_id];
        jiff.io.to(socket_to_use).emit(label, JSON.stringify(json_msg));
      }

      if(label == 'triplet') {
        // Use server code to retrieve/compute share
        var result = jiff.request_triplet_share(msg, computation_id, computation_instance.id);

        // receive result into client code
        internal_socket.receive('triplet', result);
        // Dont forget to encrypt if triplet_sockets needs to be used indeed (for future).
      }

      if(label == 'number') {
        // Use server code to retrieve/compute share
        var result = jiff.request_number_share(msg, computation_id, computation_instance.id);

        // receive result into client code
        internal_socket.receive('number', result);
        // Dont forget to encrypt if number_sockets needs to be used indeed (for future).
      }
    }
  };

  // Fix options
  if(options == null) options = {};
  options.party_id = null;
  options.party_count = null;
  options.__internal_socket = internal_socket;
  var tmp_callback = options.onConnect;
  options.onConnect = function(computation_instance) {
    jiff.computation_instances_deferred[computation_id].resolve();
    if(tmp_callback != null) tmp_callback(computation_instance);
  };

  // Create instance
  var computation_instance = client.make_jiff("<server_instance>", computation_id, options);

  // Modify instance
  computation_instance.server = jiff;
  jiff.start_computation_deferred[computation_id].then(function() {
    computation_instance.secret_key = jiff.secret_key_map[computation_id];
    computation_instance.public_key = jiff.key_map[computation_id]["s1"];

    var keymap_to_send = {};
    for(var i in jiff.key_map[computation_id])
      if(jiff.key_map[computation_id].hasOwnProperty(i))
        keymap_to_send[i] = '['+jiff.key_map[computation_id][i].toString()+']';

    computation_instance.socket.receive('init', JSON.stringify({ party_id: "s1", party_count: jiff.totalparty_map[computation_id] }));
    computation_instance.socket.receive('public_key', JSON.stringify(keymap_to_send));
  });

  return computation_instance;
}

