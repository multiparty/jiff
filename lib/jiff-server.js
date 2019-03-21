var client = require('./jiff-client');
var $ = require('jquery-deferred');
var intervals = require('./server/intervals');
var linked_list = require('./server/linkedlist');
var crypto = require('crypto');
var io = require('socket.io');

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
  jiff.logs = options.logs;

  // helpers
  jiff.helpers = {};
  jiff.helpers.random = secureRandom;
  jiff.helpers.mod = mod;
  jiff.helpers.get_party_number = function (party_id) {
    if (typeof(party_id) === 'number') {
      return party_id;
    }
    if (party_id.startsWith('s')) {
      return -1 * parseInt(party_id.substring(1), 10);
    }
    return parseInt(party_id, 10);
  };

  // Maps for managing clients in a computation
  // { computation_id -> [ party1_id, party2_id, ...] } maps computation id to array of
  // registered clients (i.e. clients that emitted 'computation_id' signal and got a party_id)
  jiff.client_map = {};

  // { computation_id -> intervals representing spare ids } maps computation id to an object
  // that manages spare ids.
  jiff.spare_party_ids = {};

  // { computation_id -> max number of parties for that computation }
  jiff.totalparty_map = {};

  // initialize hooks from options
  initialize_hooks(jiff, options);

  // By default, allow allocation of previously allocated IDs, if either of these conditions is true
  // 1. Previous party is disconnected (i.e. no socket is currently open between server and party).
  // 2. The party is connected on the same socket it is trying to initialize on now, this may happen
  //    if a party looses connections then regains it before the server detects it lost connection,
  //    but after the party detected that it did.
  if (jiff.hooks.onInitializeUsedId == null) {
    jiff.hooks.onInitializeUsedId = function (jiff, computation_id, party_id, party_count, msg) {
      var previous_socket_id = jiff.socket_map[computation_id][party_id];
      var previous_socket = jiff.io.sockets.connected[previous_socket_id];
      if (previous_socket != null && previous_socket.connected && previous_socket_id !== msg.socket_id) {
        throw new Error(party_id + ' is already taken');
      }

      return party_id;
    };
  }

  // add functions for applying and keeping track of extensions
  manage_extensions(jiff);
  // add functions for server side computations
  manage_server_computations(jiff);
  // add functions for creating and managing mailboxes for every party
  manage_mailboxes(jiff);

  // Functionality
  jiff.initialize_party = async function (computation_id, party_id, party_count, msg) {
    jiff.hooks.log(jiff, 'initialize with ', computation_id, '-', party_id, ' #', party_count, ' : ', JSON.stringify(msg));

    // First: check that a valid party_count is defined internally or provided in the message for this computation
    if (party_count == null) {
      party_count = jiff.totalparty_map[computation_id];
    }

    // initialize intervals structure to keep track of spare/free party ids
    if (jiff.spare_party_ids[computation_id] == null) {
      jiff.spare_party_ids[computation_id] = jiff.hooks.trackFreeIds(jiff, party_count);
    }

    // validate parameters
    try {
      var hook_result = await jiff.execute_array_hooks('beforeInitialization', [jiff, computation_id, msg, { party_id: party_id, party_count: party_count }], 3);
      party_count = hook_result.party_count;
      party_id = hook_result.party_id;
    } catch (err) {
      return { success: false, error: typeof(err) === 'string' ? err : err.message };
    }

    // if party_id is given, try to reserve it if free.
    // if no party_id is given, generate a new free one.
    if (party_id != null) { // party_id is given, check validity
      if (party_id !== 's1' && !jiff.spare_party_ids[computation_id].is_free(party_id)) {
        // ID is not spare, but maybe it has disconnected and trying to reconnect? maybe a mistaken client? maybe malicious?
        // Cannot handle all possible applications logic, rely on hooks to allow developers to inject case-specific logic.
        try {
          party_id = jiff.hooks.onInitializeUsedId(jiff, computation_id, party_id, party_count, msg);
        } catch (err) {
          return { success: false, error: typeof(err) === 'string' ? err : err.message };
        }
      }
    } else { // generate spare party_id
      party_id = jiff.spare_party_ids[computation_id].create_free(computation_id, msg);
    }

    // reserve id
    if (party_id !== 's1') {
      jiff.spare_party_ids[computation_id].reserve(party_id);
    }

    // party_id is all good
    // Begin initialization
    // make sure the computation meta-info objects are defined for this computation id
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

    var keymap_to_send = jiff.store_public_key(computation_id, party_id, msg);

    var message = { party_id: party_id, party_count: party_count, public_keys: keymap_to_send };
    message = await jiff.execute_array_hooks('afterInitialization', [jiff, computation_id, message], 2);

    return { success: true, message: message };
  };

  // Maps for managing keys
  // { computation_id -> { party_id -> public_key } }
  jiff.key_map = {};

  // { computation_id -> <privateKey> } (for every computation the server has a different key pair)
  jiff.secret_key_map = {};
  jiff.generateServerKeys = function (computation_id) {
    var genkey = jiff.hooks.generateKeyPair(jiff);
    jiff.secret_key_map[computation_id] = genkey.secret_key;
    jiff.key_map[computation_id] = { s1: genkey.public_key };
  };

  jiff.store_public_key = function (computation_id, party_id, msg) {
    // store public key in key_map
    if (jiff.key_map[computation_id] == null) {
      // generate public and secret key for server if they don't exist
      jiff.generateServerKeys(computation_id);
    }

    var tmp = jiff.key_map[computation_id];
    var public_key = jiff.hooks.parseKey(jiff, msg.public_key);
    var changed = false;

    // Change public key only if provided
    if (public_key != null) {
      changed = (public_key !== tmp[party_id]);
      jiff.key_map[computation_id][party_id] = public_key;
    }

    // Gather and format keys
    var keymap_to_send = {};
    for (var key in jiff.key_map[computation_id]) {
      if (jiff.key_map[computation_id].hasOwnProperty(key)) {
        keymap_to_send[key] = jiff.hooks.dumpKey(jiff, jiff.key_map[computation_id][key]);
      }
    }

    if (changed) {
      // Send keys to all clients
      var broadcast_message = JSON.stringify({ public_keys: keymap_to_send });

      // Send the public keys to any server side instance that is supposed to participate in the computation.
      jiff.safe_emit('public_keys', broadcast_message, computation_id, 's1');

      var send_to_parties = jiff.client_map[computation_id];
      for (var i = 0; i < send_to_parties.length; i++) {
        if (send_to_parties[i] !== party_id) {
          var pkey = jiff.key_map[computation_id][send_to_parties[i]];
          var cipher_text = jiff.hooks.encryptSign(jiff, broadcast_message, pkey, jiff.secret_key_map[computation_id]);
          jiff.safe_emit('public_keys', cipher_text, computation_id, send_to_parties[i]);
        }
      }
    }

    return keymap_to_send;
  };

  jiff.share = async function (computation_id, from_id, msg) {
    jiff.hooks.log(jiff, 'share from ' + computation_id + '-' + from_id + ' : ' + JSON.stringify(msg));

    try {
      msg = await jiff.execute_array_hooks('beforeOperation', [jiff, 'share', computation_id, from_id, msg], 4);
    } catch (err) {
      return { success: false, error: typeof(err) === 'string' ? err : err.message };
    }

    var to_id = msg['party_id'];
    msg['party_id'] = from_id;

    msg = await jiff.execute_array_hooks('afterOperation', [jiff, 'share', computation_id, from_id, msg], 4);

    jiff.safe_emit('share', JSON.stringify(msg), computation_id, to_id);

    return { success: true };
  };

  jiff.open = async function (computation_id, from_id, msg) {
    jiff.hooks.log(jiff, 'open from ' + computation_id + '-' + from_id + ' : ' + JSON.stringify(msg));

    try {
      msg = await jiff.execute_array_hooks('beforeOperation', [jiff, 'open', computation_id, from_id, msg], 4);
    } catch (err) {
      return { success: false, error: typeof(err) === 'string' ? err : err.message };
    }

    var to_id = msg['party_id'];
    msg['party_id'] = from_id;

    msg = await jiff.execute_array_hooks('afterOperation', [jiff, 'open', computation_id, from_id, msg], 4);

    jiff.safe_emit('open', JSON.stringify(msg), computation_id, to_id);

    return { success: true };
  };

  jiff.triplet = async function (computation_id, from_id, msg) {
    // decrypt and verify signature
    if (from_id !== 's1') { // TODO: fix in a better way, make sure it is consistent with restAPI and apply to .number too
      try {
        msg = jiff.hooks.decryptSign(jiff, msg, jiff.secret_key_map[computation_id], jiff.key_map[computation_id][from_id]);
      } catch (error) { // invalid signature
        jiff.hooks.log(jiff, 'Error in triplet from ' + computation_id + '-' + from_id + ': ' + error);
        return { success: false, error: 'invalid signature'};
      }

      msg = JSON.parse(msg);
    }

    try {
      msg = await jiff.execute_array_hooks('beforeOperation', [jiff, 'triplet', computation_id, from_id, msg], 4);
    } catch (err) {
      return { success: false, error: typeof(err) === 'string' ? err : err.message };
    }

    // request/generate triplet share.
    var triplet_msg = jiff.request_triplet_share(msg, computation_id, from_id);

    triplet_msg = await jiff.execute_array_hooks('afterOperation', [jiff, 'triplet', computation_id, from_id, triplet_msg], 4);
    triplet_msg = JSON.stringify(triplet_msg);

    // encrypt an sign message then send it.
    if (from_id !== 's1') {
      var pkey = jiff.key_map[computation_id][from_id];
      triplet_msg = jiff.hooks.encryptSign(jiff, triplet_msg, pkey, jiff.secret_key_map[computation_id]);
    }

    return { success: true, message: triplet_msg };
  };

  jiff.number = async function (computation_id, from_id, msg) {
    // decrypt and verify signature.
    if (from_id !== 's1') {
      try {
        msg = jiff.hooks.decryptSign(jiff, msg, jiff.secret_key_map[computation_id], jiff.key_map[computation_id][from_id]);
      } catch (error) { // invalid signature
        jiff.hooks.log(jiff, 'Error in number from ' + computation_id + '-' + from_id + ': ' + error);
        return { success: false, error: 'invalid signature' };
      }

      msg = JSON.parse(msg);
    }

    try {
      msg = await jiff.execute_array_hooks('beforeOperation', [jiff, 'number', computation_id, from_id, msg], 4);
    } catch (err) {
      return { success: false, error: typeof(err) === 'string' ? err : err.message };
    }

    // request/generate number share.
    var number_msg = { numbers: jiff.request_number_share(msg, computation_id, from_id) };

    number_msg = await jiff.execute_array_hooks('afterOperation', [jiff, 'number', computation_id, from_id, number_msg], 4);
    number_msg = JSON.stringify(number_msg);

    // encrypt and sign message then send it.
    if (from_id !== 's1') {
      var pkey = jiff.key_map[computation_id][from_id];
      number_msg = jiff.hooks.encryptSign(jiff, number_msg, pkey, jiff.secret_key_map[computation_id]);
    }

    return { success: true, message: number_msg };
  };

  jiff.custom = async function (computation_id, from_id, msg) {
    jiff.hooks.log(jiff, 'custom from ' + computation_id + '-' + from_id + ' : ' + JSON.stringify(msg));

    try {
      msg = await jiff.execute_array_hooks('beforeOperation', [jiff, 'custom', computation_id, from_id, msg], 4);
    } catch (err) {
      return { success: false, error: typeof(err) === 'string' ? err : err.message };
    }

    //message already parsed
    var receiver = msg['party_id'];
    msg['party_id'] = from_id;

    msg = await jiff.execute_array_hooks('afterOperation', [jiff, 'custom', computation_id, from_id, msg], 4);

    msg = JSON.stringify(msg);
    jiff.safe_emit('custom', msg, computation_id, receiver);

    return { success: true };
  };

  // { computation_id -> number of freed-up parties }
  jiff.freeparty_map = {};
  jiff.free = async function (computation_id, party_id, msg) {
    jiff.hooks.log(jiff, 'free ' + computation_id + '-' + party_id);

    try {
      await jiff.execute_array_hooks('beforeFree', [jiff, computation_id, party_id, msg], -1);
    } catch (err) {
      return { success: false, error: typeof(err) === 'string' ? err : err.message };
    }

    if (jiff.freeparty_map[computation_id] == null) {
      jiff.freeparty_map[computation_id] = 0;
    }
    jiff.freeparty_map[computation_id]++;

    // free up all resources related to the computation
    if (jiff.freeparty_map[computation_id] === jiff.totalparty_map[computation_id]) {
      jiff.hooks.log(jiff, 'free computation ' + computation_id);

      delete jiff.socket_map[computation_id];
      delete jiff.client_map[computation_id];
      delete jiff.spare_party_ids[computation_id];
      delete jiff.totalparty_map[computation_id];
      delete jiff.freeparty_map[computation_id];
      delete jiff.key_map[computation_id];
      delete jiff.secret_key_map[computation_id];
      delete jiff.mailbox[computation_id];
      delete jiff.computation_instances_map[computation_id];
      delete jiff.triplets_map[computation_id];
      delete jiff.numbers_map[computation_id];

      await jiff.execute_array_hooks('afterFree', [jiff, computation_id, party_id, msg], -1);
    }

    return { success: true };
  };

  default_preprocessing(jiff);

  // SOCKETS
  // Import socket.io
  var pingTimeout = options.pingTimeout == null ? 180000 : options.pingTimeout;
  var pingInterval = options.pingInterval == null ? 60000 : options.pingInterval;
  jiff.io = io(http, { pingTimeout: pingTimeout, pingInterval: pingInterval });

  // Maps for managing sockets
  jiff.socket_map = {}; // { computation_id -> { party_id -> socket_id } }
  jiff.party_map = {}; // { socket.id -> party_id }
  jiff.computation_map = {}; // { socket.id -> computation_id }

  // Sockets API
  jiff.io.on('connection', function (socket) {
    jiff.hooks.log(jiff, 'user connected');

    // Receive each user's desired computation
    socket.on('initialization', async function (msg) {
      // START OF SOCKET SPECIFIC SETUP
      msg = JSON.parse(msg);

      // read message
      var computation_id = msg['computation_id'];
      var party_id = msg['party_id'];
      var party_count = msg['party_count'];

      if (party_id === 's1') {
        jiff.io.to(socket.id).emit('error', 'invalid party id');
        return;
      }
      // END OF SOCKET SPECIFIC SETUP

      // COMPUTATION: independent from socket
      msg.socket_id = socket.id; // Hack-ish trick to pass this as a parameter to the default hook.
      var output = await jiff.initialize_party(computation_id, party_id, party_count, msg);
      // END OF COMPUTATION

      // START OF SOCKET SPECIFIC OUTPUT/CLEANUP
      if (output.success) {
        jiff.socket_map[computation_id][output.message.party_id] = socket.id;
        jiff.computation_map[socket.id] = computation_id;
        jiff.party_map[socket.id] = output.message.party_id;

        party_id = output.message.party_id;
        output.message = JSON.stringify(output.message);
        jiff.io.to(socket.id).emit('initialization', output.message);

        // Now that party is connected and has the needed public keys,
        // send the mailbox with pending messages to the party.
        jiff.resend_mailbox(computation_id, party_id);
      } else {
        jiff.io.to(socket.id).emit('error', output.error);
      }
      // END OF SOCKET SPECIFIC OUTPUT/CLEANUP
    });

    socket.on('share', async function (msg, callback) {
      callback(true); // send ack to client

      var json_msg = JSON.parse(msg);
      var computation_id = jiff.computation_map[socket.id];
      var from_id = jiff.party_map[socket.id];

      var output = await jiff.share(computation_id, from_id, json_msg);
      if (!output.success) {
        jiff.emit('error', output.error, computation_id, from_id);
      }
    });

    socket.on('open', async function (msg, callback) {
      callback(true); // send ack to client

      var computation_id = jiff.computation_map[socket.id];
      var from_id = jiff.party_map[socket.id];
      var json_msg = JSON.parse(msg);

      var output = await jiff.open(computation_id, from_id, json_msg);
      if (!output.success) {
        jiff.emit('error', output.error, computation_id, from_id);
      }
    });

    socket.on('custom', async function (msg, callback) {
      callback(true); // send ack to client

      var computation_id = jiff.computation_map[socket.id];
      var from_id = jiff.party_map[socket.id];
      var json_msg = JSON.parse(msg);

      var output = await jiff.custom(computation_id, from_id, json_msg);
      if (!output.success) {
        jiff.emit('error', output.error, computation_id, from_id);
      }
    });

    // triplet_id is like a program counter for triplets, to ensure all
    // parties get matching shares of the same triplet.
    socket.on('triplet', async function (msg, callback) {
      callback(true); // send ack to client

      var computation_id = jiff.computation_map[socket.id];
      var from_id = jiff.party_map[socket.id];
      var res = await jiff.triplet(computation_id, from_id, msg);

      if (res.success) {
        jiff.safe_emit('triplet', res.message, computation_id, from_id);
      } else {
        jiff.emit('error', res.error, computation_id, from_id);
      }
    });

    // number_id is like a program counter for requested shares of numbers, to ensure all
    // parties get matching shares of the same number.
    socket.on('number', async function (msg, callback) {
      callback(true); // send ack to client

      var computation_id = jiff.computation_map[socket.id];
      var from_id = jiff.party_map[socket.id];
      var res = await jiff.number(computation_id, from_id, msg);

      if (res.success) {
        jiff.safe_emit('number', res.message, computation_id, from_id);
      } else {
        jiff.emit('error', res.error, computation_id, from_id);
      }
    });

    socket.on('disconnect', async function () {
      var computation_id = jiff.computation_map[socket.id];
      var from_id = jiff.party_map[socket.id];

      jiff.hooks.log(jiff, 'user disconnected', computation_id, from_id);

      await jiff.execute_array_hooks('onDisconnect', [jiff, computation_id, from_id], -1);
    });

    socket.on('free', async function (msg, callback) {
      callback(true);

      msg = JSON.parse(msg);
      var computation_id = jiff.computation_map[socket.id];
      var from_id = jiff.party_map[socket.id];

      var output = await jiff.free(computation_id, from_id, msg);
      if (!output.success) {
        jiff.emit('error', output.error);
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

function initialize_hooks(jiff, options) {
  if (options.hooks == null) {
    options.hooks = {};
  }

  jiff.hooks = Object.assign({}, options.hooks);

  // default hooks
  if (jiff.hooks.trackFreeIds == null) {
    jiff.hooks.trackFreeIds = function (jiff, party_count) {
      return intervals(1, party_count);
    };
  }

  if (jiff.hooks.log == null) {
    jiff.hooks.log = function (jiff) {
      if (jiff.logs === true) {
        var args = Array.from(arguments).slice(1);
        console.log.apply(console, args);
      }
    };
  }

  // Lifecycle array hooks
  if (jiff.hooks.beforeInitialization == null) {
    jiff.hooks.beforeInitialization = [];
  }
  if (jiff.hooks.afterInitialization == null) {
    jiff.hooks.afterInitialization = [];
  }
  if (jiff.hooks.beforeOperation == null) {
    jiff.hooks.beforeOperation = [];
  }
  if (jiff.hooks.afterOperation == null) {
    jiff.hooks.afterOperation = [];
  }
  if (jiff.hooks.onDisconnect == null) {
    jiff.hooks.onDisconnect = [];
  }
  if (jiff.hooks.beforeFree == null) {
    jiff.hooks.beforeFree = [];
  }
  if (jiff.hooks.afterFree == null) {
    jiff.hooks.afterFree = [];
  }

  // After all other hooks run, syntactically check the parameters
  // This is run after all given hooks to give users a chance to recover
  // from syntactic inconsistencies if they wish to.
  jiff.hooks.beforeInitialization.push(async function (jiff, computation_id, msg, params) {
    var party_count = params.party_count;
    // validate party_count
    if (party_count == null) { // no party count given or saved.
      throw new Error('party count is not specified nor pre-saved');
    } else if (party_count !== 's1' && party_count < 1) { // Too small
      throw new Error('party count is less than 1');
    } else if (party_count !== 's1' && jiff.totalparty_map[computation_id] != null && party_count !== jiff.totalparty_map[computation_id]) {
      // contradicting values
      throw new Error('contradicting party count');
    }

    // validate party_id
    var party_id = params.party_id;
    if (party_id != null) { // party_id is given, check validity
      if (party_id !== 's1' && isNaN(party_id) || party_id <= 0 || party_id > party_count) {
        throw new Error('Invalid party ID: not a valid number');
      }
    } else {
      // party_id is null, must generate a new free id, if the computation is full we have a problem!
      if (jiff.client_map[computation_id] != null && jiff.client_map[computation_id].length === jiff.totalparty_map[computation_id]) {
        throw new Error('Maximum parties capacity reached');
      }
    }

    // All is good
    return params;
  });

  // CRYPTO hooks
  if (jiff.hooks.encryptSign == null) {
    if (options.sodium !== false) {
      jiff.hooks.encryptSign = client.utils.encrypt_and_sign;
    } else {
      jiff.hooks.encryptSign = function (jiff, message, encryption_public_key, signing_private_key) {
        return message;
      }
    }
  }
  if (jiff.hooks.decryptSign == null) {
    if (options.sodium !== false) {
      jiff.hooks.decryptSign = client.utils.decrypt_and_sign;
    } else {
      jiff.hooks.decryptSign = function (jiff, cipher_text, decryption_secret_key, signing_public_key) {
        return cipher_text;
      }
    }
  }
  if (jiff.hooks.generateKeyPair == null) {
    if (options.sodium !== false) {
      jiff.hooks.generateKeyPair = function (jiff) {
        // eslint-disable-next-line no-undef
        var key = jiff.sodium.crypto_box_keypair(); // this party's public and secret key
        return { public_key: key.publicKey, secret_key: key.privateKey }
      };
    } else {
      jiff.hooks.generateKeyPair = function (jiff) {
        return { public_key: '', secret_key: '' }
      }
    }
  }
  if (jiff.hooks.parseKey == null) {
    if (options.sodium !== false) {
      jiff.hooks.parseKey = function (jiff, keyString) {
        return new Uint8Array(JSON.parse(keyString));
      };
    } else {
      jiff.hooks.parseKey = function (jiff, keyString) {
        return '';
      }
    }
  }
  if (jiff.hooks.dumpKey == null) {
    if (options.sodium !== false) {
      jiff.hooks.dumpKey = function (jiff, key) {
        return '[' + key.toString() + ']';
      };
    } else {
      jiff.hooks.dumpKey = function (jiff, key) {
        return '';
      }
    }
  }

  // computing hooks
  function generateTriplet(jiff, computation_id, Zp) {
    var a = jiff.helpers.random(Zp);
    var b = jiff.helpers.random(Zp);
    var c = (a * b) % Zp;
    return { a: a, b: b, c: c };
  }

  function generateNumber(jiff, computation_id, params) {
    var bit = params.bit;
    var nonzero = params.nonzero;
    var max = params.max;
    if (max == null) {
      max = params.Zp;
    }

    var number = jiff.helpers.random(max);

    if (params.number != null) {
      number = params.number;
    } else if (bit === true && nonzero === true) {
      number = 1;
    } else if (bit === true) {
      number = number % 2;
    } else if (nonzero === true && number === 0) {
      number = jiff.helpers.random(max - 1) + 1;
    }

    return number;
  }
  if (jiff.hooks.generateTriplet == null) {
    jiff.hooks.generateTriplet = generateTriplet;
  }
  if (jiff.hooks.generateNumber == null) {
    jiff.hooks.generateNumber = generateNumber;
  }
  if (jiff.hooks.computeShares == null) {
    jiff.hooks.computeShares = client.sharing_schemes.shamir_share;
  }

  // executing array hooks
  jiff.execute_array_hooks = async function (hook_name, params, acc_index) {
    var arr = jiff.hooks[hook_name];
    arr = (arr == null ? [] : arr);

    for (var i = 0; i < arr.length; i++) {
      var result = await arr[i].apply(jiff, params);
      if (acc_index > -1) {
        params[acc_index] = result;
      }
    }
    if (acc_index > -1) {
      return params[acc_index];
    }
  };
}

// Server side computations
function manage_server_computations(jiff) {
  // Maps for managing server side computations
  // { computation_id -> computation_instance }
  jiff.computation_instances_map = {};

  // this provides a way for users to specify what part(s) of computation to run on server
  jiff.compute = function (computation_id, options) {
    if (jiff.computation_instances_map[computation_id] != null) {
      return jiff.computation_instances_map[computation_id];
    }

    // Create instance
    jiff.computation_instances_map[computation_id] = create_computation_instance(jiff, computation_id, options);
    return jiff.computation_instances_map[computation_id];
  };
}

function manage_mailboxes(jiff) {
  // Maps clients to their mailboxes
  // { computation_id -> { party_id -> [ message1, message2, ... ] } }
  // Every party has a mailbox of messages that are not yet sent to it (in order).
  // Note: the array of messages is a linked list.
  jiff.mailbox = {};

  // Hooks
  if (jiff.hooks.put_in_mailbox == null) {
    jiff.hooks.put_in_mailbox = function (jiff, label, msg, computation_id, to_id) {
      var computation_mailbox = jiff.mailbox[computation_id];
      if (computation_mailbox[to_id] == null) {
        computation_mailbox[to_id] = linked_list();
      }

      // add message to mailbox, return pointer
      return computation_mailbox[to_id].add({label: label, msg: msg});
    };
  }

  if (jiff.hooks.get_mailbox == null) {
    jiff.hooks.get_mailbox = function (jiff, computation_id, party_id) {
      var computation_mailbox = jiff.mailbox[computation_id];
      if (computation_mailbox == null) {
        return [];
      }
      if (computation_mailbox[party_id] == null) {
        computation_mailbox[party_id] = linked_list();
      }

      var result = [];
      var current_node = computation_mailbox[party_id].head;
      while (current_node != null) {
        var ptr = current_node;
        var object = current_node.object;
        result.push({ id: ptr, label: object.label, msg: object.msg });

        current_node = current_node.next;
      }

      return result;
    };
  }

  if (jiff.hooks.remove_from_mailbox == null) {
    jiff.hooks.remove_from_mailbox = function (jiff, computation_id, party_id, mailbox_pointer) {
      jiff.mailbox[computation_id][party_id].remove(mailbox_pointer);
    };
  }

  if (jiff.hooks.slice_mailbox == null) {
    jiff.hooks.slice_mailbox = function (jiff, computation_id, party_id, mailbox_pointer) {
      jiff.mailbox[computation_id][party_id].slice(mailbox_pointer);
    };
  }

  // Infrastructure - do not modify unless you know what you are doing
  jiff.emit = function (label, msg, computation_id, to_id, callback) {
    if (to_id === 's1') {
      if (jiff.computation_instances_map[computation_id] == null) {
        return;
      }

      jiff.computation_instances_map[computation_id].socket.receive(label, msg, callback);
    }

    // get the appropriate socket for the receiving party
    var socket_to_use = jiff.socket_map[computation_id][to_id]; // id of socket to use
    if (socket_to_use == null) {
      return;
    }

    // send message if the socket still *appears* to be connected
    var socket = jiff.io.sockets.connected[socket_to_use];
    if (socket != null && socket.connected) {
      if (callback == null) {
        socket.emit(label, msg);
      } else {
        // emit the message, if an acknowledgment is received, remove it from mailbox
        socket.emit(label, msg, function (status) {
          if (status) {
            callback();
          }
        });
      }
    }
  };

  jiff.safe_emit = async function (label, msg, computation_id, to_id) {
    try {
      // store message in mailbox so that it can be resent in case of failure.
      var store_id = await jiff.hooks.put_in_mailbox(jiff, label, msg, computation_id, to_id);
      jiff.emit(label, msg, computation_id, to_id, function () {
        jiff.hooks.remove_from_mailbox(jiff, computation_id, to_id, store_id);
      });
    } catch (error) {
      jiff.emit('error', typeof(error) === 'string' ? error : error.message, computation_id, to_id);
    }
  };

  // Used to resend saved messages in the mailbox to the party when it reconnects.
  jiff.resend_mailbox = async function (computation_id, party_id) {
    try {
      var mailbox = await jiff.hooks.get_mailbox(jiff, computation_id, party_id);

      for (var i = 0; i < mailbox.length; i++) {
        var letter = mailbox[i];
        var store_id = letter.id;
        var label = letter.label;
        var msg = letter.msg;

        var callback = function (store_id_scoped) {
          return function () {
            jiff.hooks.remove_from_mailbox(jiff, computation_id, party_id, store_id_scoped);
          };
        };
        jiff.emit(label, msg, computation_id, party_id, callback(store_id));
      }
    } catch (error) {
      jiff.emit('error', typeof(error) === 'string' ? error : error.message, computation_id, party_id);
    }
  };
}

// Mimic Sockets API for internal use between server and server computation instance
function InternalSocket(jiff, computation_id) {
  this.jiff = jiff;
  this.computation_id = computation_id;
  this.callbacks = {};
}
InternalSocket.prototype.connect = function () {
  this.receive('connect');
};
InternalSocket.prototype.on = function (tag, callback) {
  this.callbacks[tag] = callback;
};
InternalSocket.prototype.receive = function (tag, param, callback) {
  // from server into the computation instance
  this.callbacks[tag](param, callback);
};
InternalSocket.prototype.emit = async function (label, msg) {
  // from inside the computation instance to the outside world
  var from_id = 's1', output;
  msg = JSON.parse(msg);

  // Label could be any of: [ initialization, share, open, triplet, number, custom, free ]
  if (label === 'initialization') {
    output = await this.jiff.initialize_party(this.computation_id, msg['party_id'], msg['party_count'], msg);
    if (output.success) {
      this.receive('initialization', JSON.stringify(output.message));
      this.jiff.resend_mailbox(this.computation_id, output.message.party_id);
    } else {
      this.receive('error', output.error);
    }
  } else {
    output = await this.jiff[label](this.computation_id, from_id, msg);
    if (!output.success) {
      this.receive('error', output.error);
    } else if (label === 'triplet' || label === 'number') {
      this.jiff.safe_emit(label, output.message, this.computation_id, from_id);
    }
  }
};

// Create a computation id that provides an identical API to that of clients for the given computation.
function create_computation_instance(jiff, computation_id, options) {
  // Make sure the server has key pair for this computation
  if (jiff.secret_key_map[computation_id] == null) {
    jiff.generateServerKeys(computation_id);
  }

  // One more party needs to call free now, the server computation instance!
  if (jiff.freeparty_map[computation_id] == null) {
    jiff.freeparty_map[computation_id] = 0;
  }
  jiff.freeparty_map[computation_id]--;

  // Computation instance options
  var baseOptions = {
    autoConnect: false,
    party_id: 's1',
    secret_key: jiff.secret_key_map[computation_id],
    public_key: jiff.key_map[computation_id]['s1'],
    __internal_socket: new InternalSocket(jiff, computation_id)
  };
  options = Object.assign({}, options, baseOptions);

  // Create instance
  return client.make_jiff('<server_instance>', computation_id, options);
}

// possible fallback for when pre-processing elements are depleted, actual fallback
// is configurable by clients.
function default_preprocessing(jiff) {
  // Maps to store things
  jiff.triplets_map = {}; // { computation_id -> { triplet_id -> { party_id -> [triplet shares for this party] } } }
  jiff.numbers_map = {}; // { computation_id -> { number_id -> { party_id -> number share for this party } } }

  // Helpers for creating triplets/numbers and sharing them.
  jiff.request_triplet_share = function (msg, computation_id, from_id) {
    // parse message
    var triplet_id = msg.triplet_id;
    var receivers = msg.receivers;
    var threshold = msg.threshold;
    var Zp = msg.Zp;

    jiff.hooks.log(jiff, 'triplet ' + triplet_id + ' from ' + computation_id + '-' + from_id + ':: ' + JSON.stringify(msg));

    if (jiff.triplets_map[computation_id] == null) {
      jiff.triplets_map[computation_id] = {};
    }

    var all_triplets = jiff.triplets_map[computation_id];
    if (all_triplets[triplet_id] == null) { // Generate Triplet.
      var triplet = jiff.hooks.generateTriplet(jiff, computation_id, Zp);
      var a = triplet.a;
      var b = triplet.b;
      var c = triplet.c;

      var a_shares = jiff.hooks.computeShares(jiff, a, receivers, threshold, Zp);
      var b_shares = jiff.hooks.computeShares(jiff, b, receivers, threshold, Zp);
      var c_shares = jiff.hooks.computeShares(jiff, c, receivers, threshold, Zp);

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

    var result = all_triplets[triplet_id][from_id];
    delete all_triplets[triplet_id][from_id];
    if (Object.keys(all_triplets[triplet_id]).length === 0) {
      delete all_triplets[triplet_id];
    }

    return {triplet: result, triplet_id: triplet_id};
  };


  jiff.request_number_share = function (msg, computation_id, from_id) {
    // parse message/request
    var base_number_id = msg.number_id;
    var receivers = msg.receivers;
    var threshold = msg.threshold;
    var Zp = msg.Zp;
    var count = msg.count;
    if (count == null) {
      count = 1;
    }

    jiff.hooks.log(jiff, 'number ' + base_number_id + ' from ' + computation_id + '-' + from_id + ':: ' + JSON.stringify(msg));

    if (jiff.numbers_map[computation_id] == null) {
      jiff.numbers_map[computation_id] = {};
    }

    var result = [];
    var all_numbers = jiff.numbers_map[computation_id];
    for (var i = 0; i < count; i++) {
      var number_id = base_number_id + ':' + i;
      if (all_numbers[number_id] == null) { // Generate shares for number.
        var number = jiff.hooks.generateNumber(jiff, computation_id, msg);
        all_numbers[number_id] = jiff.hooks.computeShares(jiff, number, receivers, threshold, Zp);
      }
      result.push({number_id: number_id, number: all_numbers[number_id][from_id]});
    }

    return result;
  };
}
