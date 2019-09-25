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
  jiff.helpers.number_to_bits = function (number, length) {
    number = number.toString(2);
    var bits = [];
    for (var i = 0; i < number.length; i++) {
      bits[i] = parseInt(number.charAt(number.length - 1 - i));
    }
    while (length != null && bits.length < length) {
      bits.push(0);
    }
    return bits;
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
  jiff.initialize_party = function (computation_id, party_id, party_count, msg, _s1) {
    jiff.hooks.log(jiff, 'initialize with ', computation_id, '-', party_id, ' #', party_count, ' : ', JSON.stringify(msg) + '::'+_s1);

    if (_s1 !== true && party_id === 's1') {
      return { success: false, error: 'Party id s1 is reserved for server computation instances. This incident will be reported!' };
    }

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
      var hook_result = jiff.execute_array_hooks('beforeInitialization', [jiff, computation_id, msg, { party_id: party_id, party_count: party_count }], 3);
      party_count = hook_result.party_count;
      party_id = hook_result.party_id;
    } catch (err) {
      return { success: false, error: typeof(err) === 'string' ? err : err.message };
    }

    // if party_id is given, try to reserve it if free.
    // if no party_id is given, generate a new free one.
    if (party_id != null) { // party_id is given, check validity
      if (_s1 !== true && !jiff.spare_party_ids[computation_id].is_free(party_id)) {
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
    if (_s1 !== true) {
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
    if (jiff.crypto_provider_map[computation_id] == null) {
      jiff.crypto_provider_map[computation_id] = {};
    }
    jiff.client_map[computation_id].push(party_id);

    // Create a deferred for a computation instance (just in case it was needed in the future)
    if (jiff.computation_instances_deferred[computation_id] == null) {
      jiff.computation_instances_deferred[computation_id] = $.Deferred();
    }

    var keymap_to_send = jiff.store_public_key(computation_id, party_id, msg);
    var message = { party_id: party_id, party_count: party_count, public_keys: keymap_to_send };
    message = jiff.execute_array_hooks('afterInitialization', [jiff, computation_id, message], 2);

    return { success: true, message: message };
  };

  // Maps for managing keys
  // { computation_id -> { party_id -> public_key } }
  jiff.key_map = {};

  // { computation_id -> <privateKey> } (for every computation the server has a different key pair)
  jiff.secret_key_map = {};

  jiff.store_public_key = function (computation_id, party_id, msg) {
    // store public key in key_map
    var tmp = jiff.key_map[computation_id];
    if (tmp == null) { // generate public and secret key for server if they don't exist
      var genkey = jiff.hooks.generateKeyPair(jiff);
      jiff.secret_key_map[computation_id] = genkey.secret_key;
      tmp = {s1: genkey.public_key};
    }

    if (party_id !== 's1') {
      tmp[party_id] = jiff.hooks.parseKey(jiff, msg.public_key);
    }

    jiff.key_map[computation_id] = tmp;

    // Gather and format keys
    var keymap_to_send = {};
    for (var key in jiff.key_map[computation_id]) {
      if (jiff.key_map[computation_id].hasOwnProperty(key)) {
        keymap_to_send[key] = jiff.hooks.dumpKey(jiff, jiff.key_map[computation_id][key]);
      }
    }

    // Send keys to all clients
    var broadcast_message = JSON.stringify({ public_keys: keymap_to_send});

    // Send the public keys to all previously connected parties, except the party that caused this update
    var send_to_parties = jiff.client_map[computation_id];
    for (var i = 0; i < send_to_parties.length; i++) {
      if (send_to_parties[i] !== party_id) {
        jiff.safe_emit('public_keys', broadcast_message, computation_id, send_to_parties[i]);
      }
    }

    return keymap_to_send;
  };

  jiff.share = function (computation_id, from_id, msg) {
    jiff.hooks.log(jiff, 'share from ' + computation_id + '-' + from_id + ' : ' + JSON.stringify(msg));

    try {
      msg = jiff.execute_array_hooks('beforeOperation', [jiff, 'share', computation_id, from_id, msg], 4);
    } catch (err) {
      return { success: false, error: typeof(err) === 'string' ? err : err.message };
    }

    var to_id = msg['party_id'];
    msg['party_id'] = from_id;

    msg = jiff.execute_array_hooks('afterOperation', [jiff, 'share', computation_id, from_id, msg], 4);
    jiff.safe_emit('share', JSON.stringify(msg), computation_id, to_id);

    return { success: true };
  };

  jiff.open = function (computation_id, from_id, msg) {
    jiff.hooks.log(jiff, 'open from ' + computation_id + '-' + from_id + ' : ' + JSON.stringify(msg));

    try {
      msg = jiff.execute_array_hooks('beforeOperation', [jiff, 'open', computation_id, from_id, msg], 4);
    } catch (err) {
      return { success: false, error: typeof(err) === 'string' ? err : err.message };
    }

    var to_id = msg['party_id'];
    msg['party_id'] = from_id;

    msg = jiff.execute_array_hooks('afterOperation', [jiff, 'open', computation_id, from_id, msg], 4);
    jiff.safe_emit('open', JSON.stringify(msg), computation_id, to_id);

    return { success: true };
  };

  jiff.crypto_provider = function (computation_id, from_id, msg) {
    jiff.hooks.log(jiff, 'crypto_provider from ' + computation_id + '-' + from_id + ': ' + JSON.stringify(msg));

    try {
      msg = jiff.execute_array_hooks('beforeOperation', [jiff, 'crypto_provider', computation_id, from_id, msg], 4);
    } catch (err) {
      return { success: false, error: typeof(err) === 'string' ? err : err.message };
    }

    // request/generate triplet share
    var label = msg['label'];
    var params = msg['params'];
    var op_id = msg['op_id'];
    var receivers_list = msg['receivers'];
    var threshold = msg['threshold'];
    var Zp = msg['Zp'];

    // Try to find stored result in map, or compute it if it does not exist!
    var result = jiff.crypto_provider_map[computation_id][op_id];
    if (result == null) {
      var output = jiff.crypto_handlers[label](jiff, computation_id, receivers_list, threshold, Zp, params);

      // Share secrets into plain shares (not secret share objects) and copy values
      var shares = {};
      if (output['secrets'] != null) {
        for (var j = 0; j < receivers_list.length; j++) {
          shares[receivers_list[j]] = [];
        }

        for (var i = 0; i < output['secrets'].length; i++) {
          var oneShare = jiff.hooks.computeShares(jiff, output['secrets'][i], receivers_list, threshold, Zp);
          for (j = 0; j < receivers_list.length; j++) {
            shares[receivers_list[j]].push(oneShare[receivers_list[j]]);
          }
        }
      }

      // Store result in map
      result = { values: output['values'], shares: shares, markers: {} };
      jiff.crypto_provider_map[computation_id][op_id] = result;
    }

    // construct response
    var response = {
      op_id: op_id,
      receivers: receivers_list,
      threshold: threshold,
      Zp: Zp,
      values: result.values,
      shares: result.shares[from_id]  // send only shares allocated to requesting party
    };

    // clean up memory
    result.markers[from_id] = true;
    delete result.shares[from_id];
    if (Object.keys(result.markers).length === receivers_list.length) {
      delete jiff.crypto_provider_map[computation_id][op_id];
    }

    // hook and serialize
    response = jiff.execute_array_hooks('afterOperation', [jiff, 'crypto_provider', computation_id, from_id, response], 4);
    response = JSON.stringify(response);

    // send
    jiff.safe_emit('crypto_provider', response, computation_id, from_id);

    return { success: true };
  };

  jiff.custom = function (computation_id, from_id, msg) {
    jiff.hooks.log(jiff, 'custom from ' + computation_id + '-' + from_id + ' : ' + JSON.stringify(msg));

    try {
      msg = jiff.execute_array_hooks('beforeOperation', [jiff, 'custom', computation_id, from_id, msg], 4);
    } catch (err) {
      return { success: false, error: typeof(err) === 'string' ? err : err.message };
    }

    //message already parsed
    var receiver = msg['party_id'];
    msg['party_id'] = from_id;

    msg = jiff.execute_array_hooks('afterOperation', [jiff, 'custom', computation_id, from_id, msg], 4);
    jiff.safe_emit('custom', JSON.stringify(msg), computation_id, receiver);

    return { success: true };
  };

  // { computation_id -> { id of every free party -> true } }
  jiff.freeparty_map = {};
  jiff.free = function (computation_id, party_id, msg) {
    jiff.hooks.log(jiff, 'free ' + computation_id + '-' + party_id);

    try {
      jiff.execute_array_hooks('beforeFree', [jiff, computation_id, party_id, msg], -1);
    } catch (err) {
      return { success: false, error: typeof(err) === 'string' ? err : err.message };
    }

    if (jiff.freeparty_map[computation_id] == null) {
      jiff.freeparty_map[computation_id] = {};
    }
    jiff.freeparty_map[computation_id][party_id] = true;

    // free up all resources related to the computation
    if (Object.keys(jiff.freeparty_map[computation_id]).length === jiff.totalparty_map[computation_id]) {
      jiff.hooks.log(jiff, 'free computation ' + computation_id);

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
      delete jiff.crypto_provider_map[computation_id];

      jiff.execute_array_hooks('afterFree', [jiff, computation_id, party_id, msg], -1);
    }

    return { success: true };
  };

  // { computation_id -> { op_id -> { party_id -> { 'shares': [ numeric shares for this party ], 'values': <any non-secret value for this party> } } } }
  jiff.crypto_provider_map = {};
  jiff.crypto_handlers = Object.assign({}, default_preprocessing(), options.crypto_handlers);

  // SOCKETS
  var socketOptions = {
    pingTimeout: 5000,
    pingInterval: 25000
  };
  socketOptions = Object.assign(socketOptions, options.socketOptions);
  jiff.io = io(http, socketOptions);

  // Maps for managing sockets
  jiff.socket_map = {}; // { computation_id -> { party_id -> socket_id } }
  jiff.party_map = {}; // { socket.id -> party_id }
  jiff.computation_map = {}; // { socket.id -> computation_id }

  // Sockets API
  jiff.io.on('connection', function (socket) {
    jiff.hooks.log(jiff, 'user connected');

    // Receive each user's desired computation
    socket.on('initialization', function (msg) {
      // START OF SOCKET SPECIFIC SETUP
      msg = JSON.parse(msg);

      // read message
      var computation_id = msg['computation_id'];
      var party_id = msg['party_id'];
      var party_count = msg['party_count'];
      // END OF SOCKET SPECIFIC SETUP

      // COMPUTATION: independent from socket
      msg.socket_id = socket.id; // Hack-ish trick to pass this as a parameter to the default hook.
      var output = jiff.initialize_party(computation_id, party_id, party_count, msg, false);
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
        jiff.io.to(socket.id).emit('error', JSON.stringify({label: 'initialization', error: output.error}));
      }
      // END OF SOCKET SPECIFIC OUTPUT/CLEANUP
    });

    socket.on('share', function (msg, callback) {
      callback(true); // send ack to client

      var json_msg = JSON.parse(msg);
      var computation_id = jiff.computation_map[socket.id];
      var from_id = jiff.party_map[socket.id];

      var output = jiff.share(computation_id, from_id, json_msg);
      if (!output.success) {
        var errorMsg = JSON.stringify({label: 'share', error: output.error});
        jiff.emit('error', errorMsg, computation_id, from_id);
      }
    });

    socket.on('open', function (msg, callback) {
      callback(true); // send ack to client

      var computation_id = jiff.computation_map[socket.id];
      var from_id = jiff.party_map[socket.id];
      var json_msg = JSON.parse(msg);

      var output = jiff.open(computation_id, from_id, json_msg);
      if (!output.success) {
        var errorMsg = JSON.stringify({label: 'open', error: output.error});
        jiff.emit('error', errorMsg, computation_id, from_id);
      }
    });

    socket.on('custom', function (msg, callback) {
      callback(true); // send ack to client

      var computation_id = jiff.computation_map[socket.id];
      var from_id = jiff.party_map[socket.id];
      var json_msg = JSON.parse(msg);

      var output = jiff.custom(computation_id, from_id, json_msg);
      if (!output.success) {
        var errorMsg = JSON.stringify({label: 'custom', error: output.error});
        jiff.emit('error', errorMsg, computation_id, from_id);
      }
    });

    socket.on('crypto_provider', function (msg, callback) {
      callback(true); // send ack to client

      msg = JSON.parse(msg);
      var computation_id = jiff.computation_map[socket.id];
      var from_id = jiff.party_map[socket.id];

      var res = jiff.crypto_provider(computation_id, from_id, msg);
      if (!res.success) {
        var errorMsg = JSON.stringify({label: 'crypto_provider', error: res.error});
        jiff.emit('error', errorMsg, computation_id, from_id);
      }
    });

    socket.on('disconnect', function (reason) {
      var computation_id = jiff.computation_map[socket.id];
      var from_id = jiff.party_map[socket.id];

      jiff.hooks.log(jiff, 'user disconnected', computation_id, from_id, 'Reason:', reason);

      delete jiff.computation_map[socket.id];
      delete jiff.party_map[socket.id];

      jiff.execute_array_hooks('onDisconnect', [jiff, computation_id, from_id], -1);
    });

    socket.on('free', function (msg, callback) {
      callback(true);

      msg = JSON.parse(msg);
      var computation_id = jiff.computation_map[socket.id];
      var from_id = jiff.party_map[socket.id];

      var output = jiff.free(computation_id, from_id, msg);
      if (!output.success) {
        var errorMsg = JSON.stringify({label: 'free', error: output.error});
        jiff.emit('error', errorMsg, computation_id, from_id);
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
  jiff.hooks.beforeInitialization.push(function (jiff, computation_id, msg, params) {
    var party_count = params.party_count;
    // validate party_count
    if (party_count == null) { // no party count given or saved.
      throw new Error('party count is not specified nor pre-saved');
    } else if (party_count < 1) { // Too small
      throw new Error('party count is less than 1');
    } else if (jiff.totalparty_map[computation_id] != null && party_count !== jiff.totalparty_map[computation_id]) {
      // contradicting values
      throw new Error('contradicting party count');
    }

    // validate party_id
    var party_id = params.party_id;
    if (party_id != null) { // party_id is given, check validity
      if (party_id !== 's1') {
        if (isNaN(party_id) || party_id <= 0 || party_id > party_count) {
          throw new Error('Invalid party ID: not a valid number');
        }
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
  if (jiff.hooks.computeShares == null) {
    jiff.hooks.computeShares = client.sharing_schemes.shamir_share;
  }

  // executing array hooks
  jiff.execute_array_hooks = function (hook_name, params, acc_index) {
    var arr = jiff.hooks[hook_name];
    arr = (arr == null ? [] : arr);

    for (var i = 0; i < arr.length; i++) {
      var result = arr[i].apply(jiff, params);
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

  // { computation_id -> computation_instance_deferred: this will be resolved when instance is ready }
  jiff.computation_instances_deferred = {};

  // this provides a way for users to specify what part(s) of computation to run on server
  jiff.compute = function (computation_id, options) {
    if (jiff.computation_instances_deferred[computation_id] == null) {
      jiff.computation_instances_deferred[computation_id] = $.Deferred();
    }
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
      if (jiff.mailbox[computation_id] != null && jiff.mailbox[computation_id][party_id] != null) {
        jiff.mailbox[computation_id][party_id].remove(mailbox_pointer);
      }
    };
  }

  if (jiff.hooks.slice_mailbox == null) {
    jiff.hooks.slice_mailbox = function (jiff, computation_id, party_id, mailbox_pointer) {
      if (jiff.mailbox[computation_id] != null && jiff.mailbox[computation_id][party_id] != null) {
        jiff.mailbox[computation_id][party_id].slice(mailbox_pointer);
      }
    };
  }

  // Infrastructure - do not modify unless you know what you are doing
  jiff.emit = function (label, msg, computation_id, to_id, callback) {
    if (jiff.socket_map[computation_id] == null) {
      return;
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

  jiff.safe_emit = function (label, msg, computation_id, to_id) {
    if (to_id === 's1' ) {
      jiff.computation_instances_deferred[computation_id].then(function () {
        jiff.computation_instances_map[computation_id].socket.receive(label, msg);
      });
      return;
    }

    // store message in mailbox so that it can be resent in case of failure.
    var store_id = jiff.hooks.put_in_mailbox(jiff, label, msg, computation_id, to_id);
    jiff.emit(label, msg, computation_id, to_id, function () {
      jiff.hooks.remove_from_mailbox(jiff, computation_id, to_id, store_id);
    });
  };

  // Used to resend saved messages in the mailbox to the party when it reconnects.
  jiff.resend_mailbox = function (computation_id, party_id) {
    var mailbox = jiff.hooks.get_mailbox(jiff, computation_id, party_id);
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
  };
}

// Create a computation id that provides an identical API to that of clients for the given computation.
function create_computation_instance(jiff, computation_id, options) {
  options = Object.assign({}, options);
  options.party_id = 's1';
  options.secret_key = null;
  options.public_key = null;

  // Mimic Sockets API:
  options.__internal_socket = {
    callbacks: {},
    on: function (tag, callback) {
      options.__internal_socket.callbacks[tag] = callback;
    },
    receive: function (tag, param) {
      options.__internal_socket.callbacks[tag](param, function (_) {
      });
    }, // from server into the computation instance
    emit: function (label, msg) { // from inside the computation instance to the outside world
      var computation_instance = jiff.computation_instances_map[computation_id];
      msg = JSON.parse(msg);

      var from_id = 's1';
      try {
        msg = jiff.execute_array_hooks('beforeOperation', [jiff, label, computation_id, from_id, msg], 4);
      } catch (err) {
        var errorMsg = typeof(err) === 'string' ? err : err.message;
        errorMsg = JSON.stringify({label: label, error: errorMsg});
        options.__internal_socket.receive('error', errorMsg);
      }

      var to_id;
      if (label === 'share' || label === 'open') {
        // parse message to figure out who to send to
        // msg = JSON.parse(msg);

        // modify message
        to_id = msg['party_id'];
        msg['party_id'] = from_id;

        msg = jiff.execute_array_hooks('afterOperation', [jiff, label, computation_id, from_id, msg], 4);

        // send message through the appropriate socket
        jiff.safe_emit(label, JSON.stringify(msg), computation_id, to_id);
      }

      if (label === 'triplet') {
        // Use server code to retrieve/compute share
        msg = jiff.request_triplet_share(msg, computation_id, computation_instance.id);

        msg = jiff.execute_array_hooks('afterOperation', [jiff, label, computation_id, from_id, msg], 4);
        msg = JSON.stringify(msg);

        // receive result into client code
        options.__internal_socket.receive('triplet', msg);
        // Don't forget to encrypt if triplet_sockets needs to be used indeed (for future).
      }

      if (label === 'number') {
        // Use server code to retrieve/compute share
        msg = { numbers: jiff.request_number_share(msg, computation_id, computation_instance.id) };

        msg = jiff.execute_array_hooks('afterOperation', [jiff, label, computation_id, from_id, msg], 4);
        msg = JSON.stringify(msg);

        // receive result into client code
        options.__internal_socket.receive('number', msg);
        // Don't forget to encrypt if number_sockets needs to be used indeed (for future).
      }

      if (label === 'custom') {
        // modify message
        to_id = msg['party_id'];
        msg['party_id'] = from_id;

        msg = jiff.execute_array_hooks('afterOperation', [jiff, label, computation_id, from_id, msg], 4);
        msg = JSON.stringify(msg);

        jiff.safe_emit('custom', msg, computation_id, to_id);
      }
    },
    connect: function () {
      var computation_instance = jiff.computation_instances_map[computation_id];
      jiff.initialization_counter++;

      // Call initialization procedure on server (mimicking computation instance)
      var msg = computation_instance.build_initialization_message();
      var output = jiff.initialize_party(computation_id, 's1', options.party_count, msg, true);

      // Forward server output to instance (mimicking server)
      if (output.success) {
        computation_instance.secret_key = jiff.secret_key_map[computation_id];
        computation_instance.public_key = jiff.key_map[computation_id]['s1'];

        computation_instance.socket.receive('initialization', JSON.stringify(output.message));
        jiff.computation_instances_deferred[computation_id].resolve();
      } else {
        throw new Error('Cannot initialize computation instance ' + computation_id + '. Error: ' + output.error);
      }
    }
  };

  // Create instance
  var computation_instance = client.make_jiff('<server_instance>', computation_id, options);

  // Modify instance
  computation_instance.server = jiff;
  return computation_instance;
}

// possible fallback for when pre-processing elements are depleted, actual fallback
// is configurable by clients.
function default_preprocessing() {
  return {
    triplet: function (jiff, computation_id, receivers_list, threshold, Zp, params) {
      var a = jiff.helpers.random(Zp);
      var b = jiff.helpers.random(Zp);
      var c = (a * b) % Zp;
      return { secrets: [a, b, c] };
    },
    quotient: function (jiff, computation_id, receivers_list, threshold, Zp, params) {
      var constant = params['constant'];
      var noise = jiff.helpers.random(Zp);
      var quotient = Math.floor(noise / constant);
      return { secrets: [noise, quotient] };
    },
    numbers: function (jiff, computation_id, receivers_list, threshold, Zp, params) {
      var count = params['count'];
      var bit = params['bit'];
      var min = params['min'];
      var max = params['max'];
      var number = params['number'];
      var bitLength = params['bitLength'];

      if (min == null) {
        min = 0;
      }
      if (max == null) {
        max = Zp;
      }
      if (bit === true) {
        max = 2;
      }

      var numbers = [];
      for (var c = 0; c < count; c++) {
        var n = number;
        if (number == null) {
          n = jiff.helpers.random(max - min) + min;
        }

        if (bitLength == null) {
          numbers.push(n);
        } else {
          numbers = numbers.concat(jiff.helpers.number_to_bits(n, bitLength));
        }
      }

      return { secrets: numbers };
    }
  };
}
