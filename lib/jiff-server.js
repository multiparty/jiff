var client = require('./jiff-client');
var $ = require('jquery-deferred');
var intervals = require('./server/intervals');
var linked_list = require('./server/linkedlist');
var crypto = require('crypto');

module.exports = {
  // Create a server instance that can be used to manage all the computations and run server side code.
  make_jiff: function (http, options) {
    // the jiff (server) instance to make.
    var jiff = {};

    // require sodium instance
    jiff.sodium = require('libsodium-wrappers');
    jiff.sodium_promise = jiff.sodium.ready;

    // parse options
    if (options == null) {
      options = {};
    }
    jiff.logs = options.logs !== false;

    // hooks: TODO

    // helpers
    jiff.helpers = {};
    jiff.helpers.random = function (max) {
      // Use rejection sampling to get random value with normal distribution
      // Generate random Uint8 values of 1 byte larger than the max parameter
      // Reject if random is larger than quotient * max (remainder would cause biased distribution), then try again

      // Values up to 2^53 should be supported, but log2(2^49) === log2(2^49+1), so we lack the precision to easily
      // determine how many bytes are required
      if (max > 562949953421312) {
        throw new RangeError('Max value should be smaller than or equal to 2^49');
      }

      var bitsNeeded = Math.ceil(Math.log2(max));
      var bytesNeeded = Math.ceil(bitsNeeded / 8);
      var maxValue = Math.pow(256, bytesNeeded);

      // Keep trying until we find a random value within a normal distribution
      while (true) { // eslint-disable-line
        var randomBytes = crypto.randomBytes(bytesNeeded);
        var randomValue = 0;

        for (var i = 0; i < bytesNeeded; i++) {
          randomValue = randomValue * 256 + randomBytes.readUInt8(i);
        }

        // randomValue should be smaller than largest multiple of max within maxBytes
        if (randomValue < maxValue - maxValue % max) {
          return randomValue % max;
        }
      }
    };

    // Import socket.io
    var io = require('socket.io')(http, { pingTimeout: 180000, pingInterval: 60000 });
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

    // { computation_id -> [ party1_id, party2_id, ...] } maps computation id to array of
    // registered clients (i.e. clients that emitted 'computation_id' signal and got a party_id)
    var client_map = {};
    jiff.client_map = client_map;

    // { computation_id -> intervals representing spare ids } maps computation id to an object
    // that manages spare ids.
    var spare_party_ids = {};
    jiff.spare_party_ids = spare_party_ids;

    // { computation_id -> max number of parties for that computation }
    var totalparty_map = {};
    jiff.totalparty_map = totalparty_map;

    // { computation_id -> { party_id -> public_key } }
    var key_map = {};
    jiff.key_map = key_map;

    // { computation_id -> <privateKey> } (for every computation the server has a different key pair)
    var secret_key_map = {};
    jiff.secret_key_map = secret_key_map;

    // { computation_id -> { party_id -> [ message1, message2, ... ] } }
    // Every party has a mailbox of messages that are not yet sent to it (in order).
    var mailbox = {};
    jiff.mailbox = mailbox;

    // { computation_id -> { triplet_id -> { party_id -> [triplet shares for this party] } } }
    var triplets_map = {};
    jiff.triplets_map = triplets_map;

    // { computation_id -> { number_id -> { party_id -> number share for this party } } }
    var numbers_map = {};
    jiff.numbers_map = numbers_map;

    // { computation_id -> computation_instance }
    var computation_instances_map = {};
    jiff.computation_instances_map = computation_instances_map;

    // { computation_id -> computation_instance_deferred: this will be resolved when instance is ready }
    var computation_instances_deferred = {};
    jiff.computation_instances_deferred = computation_instances_deferred;

    // this provides a way for users to specify what part(s) of computation to run on server
    jiff.compute = function (computation_id, options) {
      if (computation_instances_deferred[computation_id] == null) {
        computation_instances_deferred[computation_id] = $.Deferred();
      }
      if (mailbox[computation_id] == null) {
        mailbox[computation_id] = {};
      }
      computation_instances_map[computation_id] = create_computation_instance(jiff, computation_id, options);
      computation_instances_deferred[computation_id].resolve();
      return computation_instances_map[computation_id];
    };

    jiff.safe_emit = function (label, msg, computation_id, to_id) {
      var computation_mailbox = mailbox[computation_id];
      if (computation_mailbox[to_id] == null) {
        computation_mailbox[to_id] = linked_list();
      }

      // add message to mailbox
      var mailbox_pointer = computation_mailbox[to_id].add({label: label, msg: msg});

      // get the appropriate socket for the receiving party
      var socket_to_use = socket_map[computation_id][to_id]; // id of socket to use
      var socket = io.sockets.connected[socket_to_use];

      // send message if the socket still *appears* to be connected
      if (socket != null && socket.connected) {
        // emit the message, if an acknowledgment is received, remove it from mailbox
        socket.emit(label, msg, function (status) {
          if (status) {
            computation_mailbox[to_id].remove(mailbox_pointer);
          }
        });
      }
    };

    // Used to resend saved messages in the mailbox to the party when it reconnects.
    jiff.resend_mailbox = function (computation_id, party_id) {
      var computation_mailbox = mailbox[computation_id];
      if (computation_mailbox[party_id] == null) {
        computation_mailbox[party_id] = linked_list();
      }

      // Create a new mailbox, since the current mailbox will be resent and
      // will contain new backups.
      var old_mailbox = computation_mailbox[party_id];
      computation_mailbox[party_id] = linked_list();

      // loop over all stored messages and emit them
      var current_node = old_mailbox.head;
      while (current_node != null) {
        var label = current_node.object.label;
        var msg = current_node.object.msg;
        // this emit could potentially fail, use safe emit instead.
        jiff.safe_emit(label, msg, computation_id, party_id);

        current_node = current_node.next;
      }
    };

    io.on('connection', function (socket) {
      console.log('user connected');

      // Receive each user's desired computation
      socket.on('computation_id', function (msg) {
        msg = JSON.parse(msg);

        // read message
        var computation_id = msg['computation_id'];
        var party_id = msg['party_id'];
        var party_count = msg['party_count'];

        // First: check that a valid party_count is defined internally or provided in the message for this computation
        if (party_count == null) {
          party_count = totalparty_map[computation_id];
        }

        if (party_count == null) { // no party count given or saved.
          io.to(socket.id).emit('error', 'party count is not specified nor pre-saved');
          return;
        } else if (party_count < 1) { // Too small
          io.to(socket.id).emit('error', 'party count is less than 1');
          return;
        } else if (totalparty_map[computation_id] != null && party_count !== totalparty_map[computation_id]) {
          // contradicting values
          io.to(socket.id).emit('error', 'contradicting party count');
          return;
        }
        // party_count is all good

        // Second: check if the given party_id is ok, or generate a new one if none is given
        if (party_id != null) { // party_id is given, check validity
          // given party id is already claimed by someone else.
          if (isNaN(party_id) || party_id <= 0 || party_id > party_count) {
            io.to(socket.id).emit('error', 'Invalid party ID');
            return;
          } else if (spare_party_ids[computation_id] != null && spare_party_ids[computation_id].remove(party_id) === false) { // remove party_id if spare
            // ID is not spare, but maybe it has disconnected and trying to reconnect!
            var previous_socket_id = socket_map[computation_id][party_id];
            var previous_socket = io.sockets.connected[previous_socket_id];
            if (previous_socket != null && previous_socket.connected) {
              io.to(socket.id).emit('error', party_id + ' is already taken');
              return;
            }
          }
        } else { // generate spare party_id
          if (spare_party_ids[computation_id] != null) {
            party_id = spare_party_ids[computation_id].first();
          } else {
            party_id = 1;
          }

          if (party_id == null) { // first() could not find a spare id!
            io.to(socket.id).emit('error', 'Maximum parties capacity reached');
            return;
          }
        }
        // party_id is all good

        // Begin initialization

        // make sure the computation meta-info objects are defined for this computation id
        if (spare_party_ids[computation_id] == null) {
          spare_party_ids[computation_id] = intervals(2, party_count);
        } // 1 already taken
        if (client_map[computation_id] == null) {
          client_map[computation_id] = [];
        }
        if (socket_map[computation_id] == null) {
          socket_map[computation_id] = {};
        }
        if (totalparty_map[computation_id] == null) {
          totalparty_map[computation_id] = party_count;
        }
        if (mailbox[computation_id] == null) {
          mailbox[computation_id] = {};
        }
        if (triplets_map[computation_id] == null) {
          triplets_map[computation_id] = {};
        }
        if (numbers_map[computation_id] == null) {
          numbers_map[computation_id] = {};
        }
        socket_map[computation_id][party_id] = socket.id;
        computation_map[socket.id] = computation_id;
        party_map[socket.id] = party_id;
        client_map[computation_id].push(party_id);

        // Create a deferred for a computation instance (just in case it was needed in the future)
        if (computation_instances_deferred[computation_id] == null) {
          computation_instances_deferred[computation_id] = $.Deferred();
        }

        io.to(socket.id).emit('init', JSON.stringify({party_id: party_id, party_count: party_count}));

        // initialize any server side computation instance
        computation_instances_deferred[computation_id].then(function () {
          if (!computation_instances_map[computation_id].__initialized) {
            computation_instances_map[computation_id].socket.receive('init', JSON.stringify({
              party_id: 's1',
              party_count: party_count
            }));
            computation_instances_map[computation_id].__initialized = true;
          }
        });
      });

      // Receive each user's public key
      socket.on('public_key', function (msg) {
        jiff.sodium_promise.then(function () {
          var party_id = party_map[socket.id];
          var computation_id = computation_map[socket.id];

          // store public key in key_map
          var tmp = key_map[computation_id];
          if (tmp == null) { // generate public and secret key for server if they dont exist
            var genkey = jiff.sodium.crypto_box_keypair();
            secret_key_map[computation_id] = genkey.privateKey;
            tmp = {s1: genkey.publicKey};
          }

          tmp[party_id] = new Uint8Array(JSON.parse(msg));
          key_map[computation_id] = tmp;

          // add the server public/secret key to any server side computation instance if needed
          computation_instances_deferred[computation_id].then(function () {
            computation_instances_map[computation_id].secret_key = secret_key_map[computation_id];
            computation_instances_map[computation_id].public_key = key_map[computation_id]['s1'];
          });

          // Gather and format keys
          var keymap_to_send = {};
          for (var key in key_map[computation_id]) {
            if (key_map[computation_id].hasOwnProperty(key)) {
              keymap_to_send[key] = '[' + key_map[computation_id][key].toString() + ']';
            }
          }

          // Send keys to all clients
          keymap_to_send = JSON.stringify(keymap_to_send);
          var send_to_parties = client_map[computation_id];
          for (var i = 0; i < send_to_parties.length; i++) {
            var socket_to_use = jiff.socket_map[computation_id][send_to_parties[i]];
            io.to(socket_to_use).emit('public_key', keymap_to_send);
          }

          // Send the public keys to any server side instance that is supposed to participate in the computation.
          computation_instances_deferred[computation_id].then(function () {
            computation_instances_map[computation_id].socket.receive('public_key', keymap_to_send);
          });

          // Now that party is connected and has the needed public keys,
          // send the mailbox with pending messages to the party.
          if (party_id !== 's1') {
            jiff.resend_mailbox(computation_id, party_id);
          }
        });
      });

      socket.on('disconnect', function () {
        console.log('user disconnected');
      });

      socket.on('share', function (msg, callback) {
        callback(true); // send ack to client

        var computation_id = computation_map[socket.id];
        var from_id = party_map[socket.id];

        if (jiff.logs) {
          console.log('share from ' + computation_id + '-' + from_id + ' : ' + msg);
        }

        var json_msg = JSON.parse(msg);
        var to_id = json_msg['party_id'];
        json_msg['party_id'] = from_id;

        if (to_id === 's1') {
          computation_instances_deferred[computation_id].then(function () {
            computation_instances_map[computation_id].socket.receive('share', JSON.stringify(json_msg));
          });
        } else {
          jiff.safe_emit('share', JSON.stringify(json_msg), computation_id, to_id);
        }
      });

      socket.on('open', function (msg, callback) {
        callback(true); // send ack to client

        var computation_id = computation_map[socket.id];
        var from_id = party_map[socket.id];

        if (jiff.logs) {
          console.log('open from ' + computation_id + '-' + from_id + ' : ' + msg);
        }

        var json_msg = JSON.parse(msg);
        var to_id = json_msg['party_id'];
        json_msg['party_id'] = from_id;

        if (to_id === 's1') {
          computation_instances_deferred[computation_id].then(function () {
            computation_instances_map[computation_id].socket.receive('open', JSON.stringify(json_msg))
          });
        } else {
          jiff.safe_emit('open', JSON.stringify(json_msg), computation_id, to_id);
        }
      });

      socket.on('custom', function (msg, callback) {
        callback(true); // send ack to client

        var computation_id = computation_map[socket.id];
        var from_id = party_map[socket.id];

        if (jiff.logs) {
          console.log('custom from ' + computation_id + '-' + from_id + ' : ' + msg);
        }

        var json_msg = JSON.parse(msg);
        var receiver = json_msg['receiver'];
        json_msg['party_id'] = from_id;
        delete json_msg['receiver'];

        msg = JSON.stringify(json_msg);
        if (receiver === 's1') {
          computation_instances_deferred[computation_id].then(function () {
            computation_instances_map[computation_id].socket.receive('custom', msg)
          });
        } else {
          jiff.safe_emit('custom', msg, computation_id, receiver);
        }
      });

      // triplet_id is like a program counter for triplets, to ensure all
      // parties get matching shares of the same triplet.
      socket.on('triplet', function (msg, callback) {
        callback(true); // send ack to client

        var computation_id = computation_map[socket.id];
        var from_id = party_map[socket.id];

        // decrypt and verify signature
        try {
          msg = client.utils.decrypt_and_sign(msg, secret_key_map[computation_id], key_map[computation_id][from_id], 'triplet');
        } catch (error) { // invalid signature
          console.log('Error in triplet from ' + computation_id + '-' + from_id + ': ' + error);
          io.to(socket_map[computation_id][from_id]).emit('error', 'invalid signature');
          return;
        }

        // request/generate triplet share.
        var triplet_msg = jiff.request_triplet_share(msg, computation_id, from_id);

        // encrypt an sign message then send it.
        var pkey = key_map[computation_id][from_id];
        triplet_msg = client.utils.encrypt_and_sign(triplet_msg, pkey, secret_key_map[computation_id], 'triplet');

        jiff.safe_emit('triplet', triplet_msg, computation_id, from_id);
      });

      // number_id is like a program counter for requested shares of numbers, to ensure all
      // parties get matching shares of the same number.
      socket.on('number', function (msg, callback) {
        callback(true); // send ack to client

        var computation_id = computation_map[socket.id];
        var from_id = party_map[socket.id];

        // decrypt and verify signature.
        try {
          msg = client.utils.decrypt_and_sign(msg, secret_key_map[computation_id], key_map[computation_id][from_id], 'number');
        } catch (error) { // invalid signature
          console.log('Error in number from ' + computation_id + '-' + from_id + ': ' + error);
          io.to(socket_map[computation_id][from_id]).emit('error', 'invalid signature');
          return;
        }

        // request/generate number share.
        var number_msg = jiff.request_number_share(msg, computation_id, from_id);

        // encrypt and sign message then send it.
        var pkey = key_map[computation_id][from_id];
        number_msg = client.utils.encrypt_and_sign(number_msg, pkey, secret_key_map[computation_id], 'number');

        jiff.safe_emit('number', number_msg, computation_id, from_id);
      });
    });

    // Reusable functions/code for generating/requesting numbers and triplets shares.
    jiff.request_triplet_share = function (msg, computation_id, from_id) {
      // parse message
      msg = JSON.parse(msg);

      var triplet_id = msg.triplet_id;
      var receivers = msg.receivers;
      var threshold = msg.threshold;
      var Zp = msg.Zp;
      var a, b, c;

      if (jiff.logs) {
        console.log('triplet ' + triplet_id + ' from ' + computation_id + '-' + from_id + ':: ' + JSON.stringify(msg));
      }

      if (triplets_map[computation_id] == null) {
        triplets_map[computation_id] = {};
      }

      var all_triplets = triplets_map[computation_id];
      if (all_triplets[triplet_id] == null) { // Generate Triplet.
        a = jiff.helpers.random(Zp);
        b = jiff.helpers.random(Zp);
        c = (a * b) % Zp;

        var jiff_client_imitation = {
          party_count: totalparty_map[computation_id],
          helpers: {
            random: jiff.helpers.random,
            mod: function (x, y) {
              if (x < 0) {
                return (x % y) + y;
              }
              return x % y;
            },
            get_party_number: function (party_id) {
              if (typeof(party_id) === 'number') {
                return party_id;
              }
              if (party_id.startsWith('s')) {
                return jiff_client_imitation.party_count + parseInt(party_id.substring(1), 10);
              }
              return parseInt(party_id, 10);
            }
          }
        };

        var a_shares = client.sharing_schemes.shamir_share(jiff_client_imitation, a, receivers, threshold, Zp);
        var b_shares = client.sharing_schemes.shamir_share(jiff_client_imitation, b, receivers, threshold, Zp);
        var c_shares = client.sharing_schemes.shamir_share(jiff_client_imitation, c, receivers, threshold, Zp);

        var triplet_shares = {};
        for (var i = 0; i < receivers.length; i++) {
          var pid = receivers[i];
          a = a_shares[pid];
          b = b_shares[pid];
          c = c_shares[pid];

          triplet_shares[pid] = {a: a, b: b, c: c};
        }

        all_triplets[triplet_id] = triplet_shares;
      }

      return JSON.stringify({triplet: all_triplets[triplet_id][from_id], triplet_id: triplet_id});
    };

    jiff.request_number_share = function (msg, computation_id, from_id) {
      // parse message/request
      msg = JSON.parse(msg);

      var base_number_id = msg.number_id;
      var receivers = msg.receivers;
      var threshold = msg.threshold;
      var Zp = msg.Zp;
      var count = msg.count;
      if (count == null) {
        count = 1;
      }

      var bit = msg.bit;
      var nonzero = msg.nonzero;
      var max = msg.max;
      if (max == null) {
        max = Zp;
      }

      if (jiff.logs) {
        console.log('number ' + base_number_id + ' from ' + computation_id + '-' + from_id + ':: ' + JSON.stringify(msg));
      }

      if (numbers_map[computation_id] == null) {
        numbers_map[computation_id] = {};
      }

      var result = [];
      var all_numbers = numbers_map[computation_id];
      for (var i = 0; i < count; i++) {
        var number_id = base_number_id + ':' + i;
        if (all_numbers[number_id] == null) { // Generate shares for number.
          var number = jiff.helpers.random(max);

          if (msg.number != null) {
            number = msg.number;
          } else if (bit === true && nonzero === true) {
            number = 1;
          } else if (bit === true) {
            number = number % 2;
          } else if (nonzero === true && number === 0) {
            number = jiff.helpers.random(max - 1) + 1;
          }

          // Compute shares
          var jiff_client_imitation = {
            party_count: totalparty_map[computation_id],
            helpers: {
              random: jiff.helpers.random,
              mod: function (x, y) {
                if (x < 0) {
                  return (x % y) + y;
                }
                return x % y;
              },
              get_party_number: function (party_id) {
                if (typeof(party_id) === 'number') {
                  return party_id;
                }
                if (party_id.startsWith('s')) {
                  return totalparty_map[computation_id] + parseInt(party_id.substring(1), 10);
                }
                return parseInt(party_id, 10);
              }
            }
          };
          all_numbers[number_id] = client.sharing_schemes.shamir_share(jiff_client_imitation, number, receivers, threshold, Zp);
        }
        result.push({number_id: number_id, number: all_numbers[number_id][from_id]});
      }

      return JSON.stringify(result);
    };

    return jiff;
  }
};

// Create a computation id that provides an identical API to that of clients for the given computation.
function create_computation_instance(jiff, computation_id, options) {
  // Mimic Sockets API:
  var internal_socket = {
    callbacks: {},
    on: function (tag, callback) {
      internal_socket.callbacks[tag] = callback;
    },
    receive: function (tag, param) {
      internal_socket.callbacks[tag](param, function (_) {
      });
    }, // from server into the computation instance
    emit: function (label, msg) { // from inside the computation instance to the outside world
      var json_msg,
        from_id,
        to_id,
        result;

      if (label === 'share' || label === 'open') {
        // parse message to figure out who to send to
        json_msg = JSON.parse(msg);
        from_id = 's1';

        // modify message
        to_id = json_msg['party_id'];
        json_msg['party_id'] = from_id;

        // send message through the appropriate socket
        jiff.safe_emit(label, JSON.stringify(json_msg), computation_id, to_id);
      }

      if (label === 'triplet') {
        // Use server code to retrieve/compute share
        result = jiff.request_triplet_share(msg, computation_id, computation_instance.id);

        // receive result into client code
        internal_socket.receive('triplet', result);
        // Don't forget to encrypt if triplet_sockets needs to be used indeed (for future).
      }

      if (label === 'number') {
        // Use server code to retrieve/compute share
        result = jiff.request_number_share(msg, computation_id, computation_instance.id);

        // receive result into client code
        internal_socket.receive('number', result);
        // Don't forget to encrypt if number_sockets needs to be used indeed (for future).
      }

      if (label === 'custom') {
        // parse message to figure out who to send to
        json_msg = JSON.parse(msg);
        from_id = 's1';

        // modify message
        to_id = json_msg['receiver'];
        delete json_msg['receiver'];
        json_msg['party_id'] = from_id;

        jiff.safe_emit('custom', msg, computation_id, to_id);
      }
    }
  };

  // Fix options
  if (options == null) {
    options = {};
  }
  options.party_id = null;
  options.party_count = null;
  options.secret_key = null;
  options.__internal_socket = internal_socket;

  // Create instance
  var computation_instance = client.make_jiff('<server_instance>', computation_id, options);

  // Modify instance
  computation_instance.server = jiff;
  computation_instance.__initialized = false;

  // Fill in any computation properties that the server already knows, unknown properties will be filled in
  // later by the server as they become known (when in 'init' and 'public_key' socket handlers)

  // server secret and public key
  if (jiff.secret_key_map[computation_id] != null) {
    computation_instance.secret_key = jiff.secret_key_map[computation_id];
    computation_instance.public_key = jiff.key_map[computation_id]['s1'];
  }

  // party id and count
  if (jiff.totalparty_map[computation_id] != null) {
    computation_instance.socket.receive('init', JSON.stringify({
      party_id: 's1',
      party_count: jiff.totalparty_map[computation_id]
    }));
  }

  // currently known parties' public keys
  if (jiff.key_map[computation_id] != null) {
    var keymap_to_send = {};
    for (var i in jiff.key_map[computation_id]) {
      if (jiff.key_map[computation_id].hasOwnProperty(i)) {
        keymap_to_send[i] = '[' + jiff.key_map[computation_id][i].toString() + ']';
      }
    }

    computation_instance.socket.receive('public_key', JSON.stringify(keymap_to_send));
  }

  return computation_instance;
}
