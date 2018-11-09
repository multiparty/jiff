var client = require('./jiff-client');
var $ = require('jquery-deferred');
var intervals = require('./server/intervals');
var linked_list = require('./server/linkedlist');
var crypto = require('crypto');

// Secure randomness via rejection sampling.
function secureRandom(max) {
  // Use rejection sampling to get random value within bounds
  // Generate random Uint8 values of 1 byte larger than the max parameter
  // Reject if random is larger than quotient * max (remainder would cause biased distribution), then try again

  // Values up to 2^53 should be supported, but log2(2^49) === log2(2^49+1), so we lack the precision to easily
  // determine how many bytes are required
  if (max > 562949953421312) {
    throw new RangeError('Max value should be smaller than or equal to 2^49');
  }

  var bitsNeeded = Math.ceil(Math.log(max)/Math.log(2));
  var bytesNeeded = Math.ceil(bitsNeeded / 8);
  var maxValue = Math.pow(256, bytesNeeded);

  // Keep trying until we find a random value within bounds
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
}
function mod(x, y) {
  if (x < 0) {
    return (x % y) + y;
  }
  return x % y;
}

// Create a server instance that can be used to manage all the computations and run server side code.
exports.make_jiff = function (http, options) {
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

  // helpers
  jiff.helpers = {};
  jiff.helpers.random = secureRandom;
  jiff.helpers.mod = mod;
  jiff.helpers.get_party_number = function (party_id, party_count) {
    if (typeof(party_id) === 'number') {
      return party_id;
    }
    if (party_id.startsWith('s')) {
      return party_count + parseInt(party_id.substring(1), 10);
    }
    return parseInt(party_id, 10);
  };

  // add functions for applying and keeping track of extensions
  manage_extensions(jiff);
  // add functions for server side computations
  manage_server_computations(jiff);
  // add functions for creating and managing mailboxes for every party
  manage_mailboxes(jiff);

  // Maps for managing clients in a computation
  // { computation_id -> [ party1_id, party2_id, ...] } maps computation id to array of
  // registered clients (i.e. clients that emitted 'computation_id' signal and got a party_id)
  jiff.client_map = {};

  // { computation_id -> intervals representing spare ids } maps computation id to an object
  // that manages spare ids.
  jiff.spare_party_ids = {};

  // { computation_id -> max number of parties for that computation }
  jiff.totalparty_map = {};

  // Functionality
  jiff.initializeParty = function (computation_id, party_id, party_count, socket) {
    // First: check that a valid party_count is defined internally or provided in the message for this computation
    if (party_count == null) {
      party_count = jiff.totalparty_map[computation_id];
    }

    if (party_count == null) { // no party count given or saved.
      return { label: 'error', msg: 'party count is not specified nor pre-saved' };
    } else if (party_count < 1) { // Too small
      return { label: 'error', msg: 'party count is less than 1' };
    } else if (jiff.totalparty_map[computation_id] != null && party_count !== jiff.totalparty_map[computation_id]) {
      // contradicting values
      return { label: 'error', msg: 'contradicting party count' };
    }
    // party_count is all good

    // Second: check if the given party_id is ok, or generate a new one if none is given
    if (party_id != null) { // party_id is given, check validity
      // given party id is already claimed by someone else.
      if (isNaN(party_id) || party_id <= 0 || party_id > party_count) {
        return { label: 'error', msg: 'Invalid party ID' };
      } else if (jiff.spare_party_ids[computation_id] != null && jiff.spare_party_ids[computation_id].remove(party_id) === false) { // remove party_id if spare
        // TODO: for future: think about not spare IDs being used by rest API and not just sockets
        // ID is not spare, but maybe it has disconnected and trying to reconnect!
        var previous_socket_id = jiff.socket_map[computation_id][party_id];
        var previous_socket = jiff.io.sockets.connected[previous_socket_id];
        if (previous_socket != null && previous_socket.connected && previous_socket !== socket) {
          return { label: 'error', msg: party_id + ' is already taken' };
        }
      }
    } else { // generate spare party_id
      if (jiff.spare_party_ids[computation_id] != null) {
        party_id = jiff.spare_party_ids[computation_id].first();
      } else {
        party_id = 1;
      }

      if (party_id == null) { // first() could not find a spare id!
        return { label: 'error', msg: 'Maximum parties capacity reached' };
      }
    }
    // party_id is all good
    // Begin initialization
    // make sure the computation meta-info objects are defined for this computation id
    if (jiff.spare_party_ids[computation_id] == null) {
      jiff.spare_party_ids[computation_id] = intervals(2, party_count);
    } // 1 already taken
    if (jiff.client_map[computation_id] == null) {
      jiff.client_map[computation_id] = [];
    }
    if (jiff.socket_map[computation_id] == null) {
      jiff.socket_map[computation_id] = {};
    }
    if (jiff.totalparty_map[computation_id] == null) {
      jiff.totalparty_map[computation_id] = party_count;
    }
    if (jiff.mailbox[computation_id] == null) {
      jiff.mailbox[computation_id] = {};
    }
    jiff.client_map[computation_id].push(party_id);

    // Create a deferred for a computation instance (just in case it was needed in the future)
    if (jiff.computation_instances_deferred[computation_id] == null) {
      jiff.computation_instances_deferred[computation_id] = $.Deferred();
    }

    // initialize any server side computation instance
    jiff.computation_instances_deferred[computation_id].then(function () {
      if (!jiff.computation_instances_map[computation_id].__initialized) {
        jiff.computation_instances_map[computation_id].socket.receive('init', JSON.stringify({
          party_id: 's1',
          party_count: party_count
        }));
        jiff.computation_instances_map[computation_id].__initialized = true;
      }
    });

    return { label: 'init', msg: { party_id: party_id, party_count: party_count } };
  };

  // Maps for managing keys
  // { computation_id -> { party_id -> public_key } }
  jiff.key_map = {};

  // { computation_id -> <privateKey> } (for every computation the server has a different key pair)
  jiff.secret_key_map = {};

  jiff.public_key = function (computation_id, party_id, msg) {
    // store public key in key_map
    var tmp = jiff.key_map[computation_id];
    if (tmp == null) { // generate public and secret key for server if they dont exist
      var genkey = jiff.sodium.crypto_box_keypair();
      jiff.secret_key_map[computation_id] = genkey.privateKey;
      tmp = {s1: genkey.publicKey};
    }

    tmp[party_id] = new Uint8Array(JSON.parse(msg));
    jiff.key_map[computation_id] = tmp;

    // add the server public/secret key to any server side computation instance if needed
    jiff.computation_instances_deferred[computation_id].then(function () {
      jiff.computation_instances_map[computation_id].secret_key = jiff.secret_key_map[computation_id];
      jiff.computation_instances_map[computation_id].public_key = jiff.key_map[computation_id]['s1'];
    });

    // Gather and format keys
    var keymap_to_send = {};
    for (var key in jiff.key_map[computation_id]) {
      if (jiff.key_map[computation_id].hasOwnProperty(key)) {
        keymap_to_send[key] = '[' + jiff.key_map[computation_id][key].toString() + ']';
      }
    }

    // Send keys to all clients
    keymap_to_send = JSON.stringify(keymap_to_send);

    var send_to_parties = jiff.client_map[computation_id];
    for (var i = 0; i < send_to_parties.length; i++) {
      var socket_to_use = jiff.socket_map[computation_id][send_to_parties[i]];
      if (socket_to_use != null) {
        jiff.io.to(socket_to_use).emit('public_key', keymap_to_send);
      }
    }

    // Send the public keys to any server side instance that is supposed to participate in the computation.
    jiff.computation_instances_deferred[computation_id].then(function () {
      jiff.computation_instances_map[computation_id].socket.receive('public_key', keymap_to_send);
    });

    // Now that party is connected and has the needed public keys,
    // send the mailbox with pending messages to the party.
    if (party_id !== 's1') {
      jiff.resend_mailbox(computation_id, party_id);
    }

    return keymap_to_send;
  };

  jiff.share = function (computation_id, from_id, msg) {
    if (jiff.logs) {
      console.log('share from ' + computation_id + '-' + from_id + ' : ' + JSON.stringify(msg));
    }

    var to_id = msg['party_id'];
    msg['party_id'] = from_id;

    if (to_id === 's1') {
      jiff.computation_instances_deferred[computation_id].then(function () {
        jiff.computation_instances_map[computation_id].socket.receive('share', JSON.stringify(msg));
      });
    } else {
      jiff.safe_emit('share', JSON.stringify(msg), computation_id, to_id);
    }
  };

  jiff.open = function (computation_id, from_id, msg) {
    if (jiff.logs) {
      console.log('open from ' + computation_id + '-' + from_id + ' : ' + JSON.stringify(msg));
    }

    var to_id = msg['party_id'];
    msg['party_id'] = from_id;

    if (to_id === 's1' ) {
      jiff.computation_instances_deferred[computation_id].then(function () {
        jiff.computation_instances_map[computation_id].socket.receive('open', JSON.stringify(msg))
      });
    } else {
      jiff.safe_emit('open', JSON.stringify(msg), computation_id, to_id);
    }
  };

  jiff.triplet = function (computation_id, from_id, msg) {
    // decrypt and verify signature
    try {
      msg = client.utils.decrypt_and_sign(msg, jiff.secret_key_map[computation_id], jiff.key_map[computation_id][from_id], 'triplet');
    } catch (error) { // invalid signature
      console.log('Error in triplet from ' + computation_id + '-' + from_id + ': ' + error);
      return { label: 'error', message: 'invalid signature'};
    }

    // request/generate triplet share.
    var triplet_msg = jiff.request_triplet_share(msg, computation_id, from_id);

    // encrypt an sign message then send it.
    var pkey = jiff.key_map[computation_id][from_id];
    triplet_msg = client.utils.encrypt_and_sign(triplet_msg, pkey, jiff.secret_key_map[computation_id], 'triplet');

    return { label: 'triplet', message: triplet_msg };
  };

  jiff.number = function (computation_id, from_id, msg) {
    // decrypt and verify signature.
    try {
      msg = client.utils.decrypt_and_sign(msg, jiff.secret_key_map[computation_id], jiff.key_map[computation_id][from_id], 'number');
    } catch (error) { // invalid signature
      console.log('Error in number from ' + computation_id + '-' + from_id + ': ' + error);
      return { label: 'error', message: 'invalid signature' };
    }

    // request/generate number share.
    var number_msg = jiff.request_number_share(msg, computation_id, from_id);

    // encrypt and sign message then send it.
    var pkey = jiff.key_map[computation_id][from_id];
    number_msg = client.utils.encrypt_and_sign(number_msg, pkey, jiff.secret_key_map[computation_id], 'number');

    return { label: 'number', message: number_msg };
  };

  jiff.custom = function (computation_id, from_id, msg) {
    if (jiff.logs) {
      console.log('custom from ' + computation_id + '-' + from_id + ' : ' + msg);
    }

    //message already parsed
    var receiver = msg['receiver'];
    msg['party_id'] = from_id;
    delete msg['receiver'];

    msg = JSON.stringify(msg);
    if (receiver === 's1') {
      jiff.computation_instances_deferred[computation_id].then(function () {
        jiff.computation_instances_map[computation_id].socket.receive('custom', msg)
      });
    } else {
      jiff.safe_emit('custom', msg, computation_id, receiver);
    }
  };

  jiff.free = function (computation_id) {
    delete jiff.socket_map[computation_id];
    delete jiff.client_map[computation_id];
    delete jiff.spare_party_ids[computation_id];
    delete jiff.totalparty_map[computation_id];
    delete jiff.freeparty_map[computation_id];
    delete jiff.key_map[computation_id];
    delete jiff.secret_key_map[computation_id];
    delete jiff.mailbox[computation_id];
    delete jiff.computation_instances_deferred[computation_id];
    delete jiff.computation_instances_map[computation_id];
    delete jiff.triplets_map[computation_id];
    delete jiff.numbers_map[computation_id];
  };

  default_preprocessing(jiff);

  // SOCKETS
  // Import socket.io
  var pingTimeout = options.pingTimeout == null ? 180000 : options.pingTimeout;
  var pingInterval = options.pingInterval == null ? 60000 : options.pingInterval;
  jiff.io = require('socket.io')(http, { pingTimeout: pingTimeout, pingInterval: pingInterval });

  // Maps for managing sockets
  jiff.socket_map = {}; // { computation_id -> { party_id -> socket_id } }
  jiff.party_map = {}; // { socket.id -> party_id }
  jiff.computation_map = {}; // { socket.id -> computation_id }

  // Sockets API
  jiff.io.on('connection', function (socket) {
    console.log('user connected');

    // Receive each user's desired computation
    socket.on('computation_id', function (msg) {
      // START OF SOCKET SPECIFIC SETUP
      msg = JSON.parse(msg);

      // read message
      var computation_id = msg['computation_id'];
      var party_id = msg['party_id'];
      var party_count = msg['party_count'];
      // END OF SOCKET SPECIFIC SETUP

      // COMPUTATION: independent from socket
      var output = jiff.initializeParty(computation_id, party_id, party_count, socket);
      // END OF COMPUTATION

      // START OF SOCKET SPECIFIC OUTPUT/CLEANUP
      if (output.label === 'init') {
        jiff.socket_map[computation_id][output.msg.party_id] = socket.id;
        jiff.computation_map[socket.id] = computation_id;
        jiff.party_map[socket.id] = output.msg.party_id;
        output.msg = JSON.stringify(output.msg);
      }

      jiff.io.to(socket.id).emit(output.label, output.msg);
      // END OF SOCKET SPECIFIC OUTPUT/CLEANUP
    });

    // Receive each user's public key
    socket.on('public_key', function (msg) {
      var party_id = jiff.party_map[socket.id];
      var computation_id = jiff.computation_map[socket.id];

      jiff.public_key(computation_id, party_id, msg);
    });

    socket.on('share', function (msg, callback) {
      callback(true); // send ack to client
      var json_msg = JSON.parse(msg);
      var computation_id = jiff.computation_map[socket.id];
      var from_id = jiff.party_map[socket.id];

      jiff.share(computation_id, from_id, json_msg);
    });

    socket.on('open', function (msg, callback) {
      callback(true); // send ack to client

      var computation_id = jiff.computation_map[socket.id];
      var from_id = jiff.party_map[socket.id];
      var json_msg = JSON.parse(msg);

      jiff.open(computation_id, from_id, json_msg);
    });

    socket.on('custom', function (msg, callback) {
      callback(true); // send ack to client

      var computation_id = jiff.computation_map[socket.id];
      var from_id = jiff.party_map[socket.id];
      var json_msg = JSON.parse(msg);

      jiff.custom(computation_id, from_id, json_msg);
    });

    // triplet_id is like a program counter for triplets, to ensure all
    // parties get matching shares of the same triplet.
    socket.on('triplet', function (msg, callback) {
      callback(true); // send ack to client

      var computation_id = jiff.computation_map[socket.id];
      var from_id = jiff.party_map[socket.id];
      var res = jiff.triplet(computation_id, from_id, msg);

      jiff.safe_emit(res.label, res.message, computation_id, from_id);
    });

    // number_id is like a program counter for requested shares of numbers, to ensure all
    // parties get matching shares of the same number.
    socket.on('number', function (msg, callback) {
      callback(true); // send ack to client

      var computation_id = jiff.computation_map[socket.id];
      var from_id = jiff.party_map[socket.id];
      var res = jiff.number(computation_id, from_id, msg);

      jiff.safe_emit(res.label, res.message, computation_id, from_id);
    });

    socket.on('disconnect', function () {
      console.log('user disconnected');
    });

    // { computation_id -> number of freed-up parties }
    jiff.freeparty_map = {};

    socket.on('free', function (_, callback) {
      callback(true);

      var party_id = jiff.party_map[socket.id];
      var computation_id = jiff.computation_map[socket.id];

      if (jiff.logs) {
        console.log('free ' + computation_id + '-' + party_id);
      }

      if (jiff.freeparty_map[computation_id] == null) {
        jiff.freeparty_map[computation_id] = 0;
      }
      jiff.freeparty_map[computation_id]++;

      // free up all resources related to the computation
      if (jiff.freeparty_map[computation_id] === jiff.totalparty_map[computation_id]) {
        if (jiff.logs) {
          console.log('free computation ' + computation_id);
        }

        jiff.free(computation_id);
      }
    });
  });

  return jiff;
};

// Server extensions management system
function manage_extensions(jiff) {
  jiff.extensions = [];

  jiff.has_extension = function (name) {
    return jiff.extensions.indexOf(name) > -1;
  };

  jiff.can_apply_extension = function (name) {
    return true;
  };

  jiff.apply_extension = function (ext, options) {
    if (options == null) {
      options = {};
    }

    var name = ext.name;
    var status = jiff.can_apply_extension(name);

    if (status === true) {
      ext.make_jiff(jiff, options);

      jiff.extensions.push(name);
      jiff.extension_applied(name, options);
    } else {
      throw status;
    }
  };

  jiff.extension_applied = function (name, options) {};
}

// Server side computations
function manage_server_computations(jiff) {
  // Maps for managing server side computations
  // { computation_id -> computation_instance }
  jiff.computation_instances_map = {};

  // { computation_id -> computation_instance_deferred: this will be resolved when instance is ready }
  jiff.computation_instances_deferred = {};

  // this provides a way for users to specify what part(s) of computation to run on server
  jiff.compute = function (computation_id, options) {
    if (jiff.computation_instances_deferred[computation_id] == null) {
      jiff.computation_instances_deferred[computation_id] = $.Deferred();
    }
    if (jiff.mailbox[computation_id] == null) {
      jiff.mailbox[computation_id] = {};
    }
    jiff.computation_instances_map[computation_id] = create_computation_instance(jiff, computation_id, options);
    jiff.computation_instances_deferred[computation_id].resolve();
    return jiff.computation_instances_map[computation_id];
  };
}

function manage_mailboxes(jiff) {
  // Maps clients to their mailboxes
  // { computation_id -> { party_id -> [ message1, message2, ... ] } }
  // Every party has a mailbox of messages that are not yet sent to it (in order).
  // Note: the array of messages is a linked list.
  jiff.mailbox = {};

  jiff.put_in_mailbox = function (label, msg, computation_id, to_id) {
    var computation_mailbox = jiff.mailbox[computation_id];
    if (computation_mailbox[to_id] == null) {
      computation_mailbox[to_id] = linked_list();
    }

    // add message to mailbox
    return computation_mailbox[to_id].add({label: label, msg: msg});
  };

  jiff.safe_emit = function (label, msg, computation_id, to_id) {
    // store message in mailbox so that it can be resent in case of failure.
    var mailbox_pointer = jiff.put_in_mailbox(label, msg, computation_id, to_id);

    // get the appropriate socket for the receiving party
    var socket_to_use = jiff.socket_map[computation_id][to_id]; // id of socket to use
    if (socket_to_use == null) {
      return;
    }

    // send message if the socket still *appears* to be connected
    var socket = jiff.io.sockets.connected[socket_to_use];
    if (socket != null && socket.connected) {
      // emit the message, if an acknowledgment is received, remove it from mailbox
      socket.emit(label, msg, function (status) {
        if (status) {
          jiff.mailbox[computation_id][to_id].remove(mailbox_pointer);
        }
      });

    }
  };

  // Used to resend saved messages in the mailbox to the party when it reconnects.
  jiff.resend_mailbox = function (computation_id, party_id) {
    var computation_mailbox = jiff.mailbox[computation_id];
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
}

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
      var json_msg, from_id, to_id, result;

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

        jiff.safe_emit('custom', JSON.stringify(json_msg), computation_id, to_id);
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

// possible fallback for when pre-processing elements are depleted, actual fallback
// is configurable by clients.
function default_preprocessing(jiff) {
  // For use inside share
  function create_jiff_imitation(party_count) {
    return {
      helpers: {
        random: jiff.helpers.random,
        mod: jiff.helpers.mod,
        get_party_number: function (party_id) {
          return jiff.helpers.get_party_number(party_id, party_count);
        }
      }
    };
  }

  // Maps to store things
  jiff.triplets_map = {}; // { computation_id -> { triplet_id -> { party_id -> [triplet shares for this party] } } }
  jiff.numbers_map = {}; // { computation_id -> { number_id -> { party_id -> number share for this party } } }

  // Helpers for creating triplets/numbers and sharing them.
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

    if (jiff.triplets_map[computation_id] == null) {
      jiff.triplets_map[computation_id] = {};
    }

    var all_triplets = jiff.triplets_map[computation_id];
    if (all_triplets[triplet_id] == null) { // Generate Triplet.
      a = jiff.helpers.random(Zp);
      b = jiff.helpers.random(Zp);
      c = (a * b) % Zp;

      var jiff_client_imitation = create_jiff_imitation(jiff.totalparty_map[computation_id]);
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

    if (jiff.numbers_map[computation_id] == null) {
      jiff.numbers_map[computation_id] = {};
    }

    var result = [];
    var all_numbers = jiff.numbers_map[computation_id];
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

        var jiff_client_imitation = create_jiff_imitation(jiff.totalparty_map[computation_id]);
        all_numbers[number_id] = client.sharing_schemes.shamir_share(jiff_client_imitation, number, receivers, threshold, Zp);
      }
      result.push({number_id: number_id, number: all_numbers[number_id][from_id]});
    }

    return JSON.stringify(result);
  };
}