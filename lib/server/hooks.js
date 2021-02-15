var shamir_share = require('../client/protocols/shamir/share.js');

var intervals = require('./datastructures/intervals.js');
var mailbox = require('./mailbox.js');

// constructor
function ServerHooks(jiffServer) {
  this.jiff = jiffServer;

  // avoid sharing aliases to the same array
  for (hook in ServerHooks.prototype) {
    if (ServerHooks.prototype.hasOwnProperty(hook) && typeof(ServerHooks.prototype[hook].length) === 'number' && ServerHooks.prototype[hook].slice) {
      this[hook] = ServerHooks.prototype[hook].slice();
    }
  }

  // fill in hooks from options
  var optionHooks = jiffServer.options.hooks || {};
  for (var hook in optionHooks) {
    if (hook === 'beforeInitialization') {
      this[hook] = optionHooks[hook].concat(this[hook]);
    } else if (optionHooks.hasOwnProperty(hook)) {
      this[hook] = optionHooks[hook];
    }
  }
}

// default hooks
ServerHooks.prototype.log = function (jiff) {
  if (jiff.options.logs) {
    var args = Array.from(arguments).slice(1);
    console.log.apply(console, args);
  }
};

// Lifecycle array hooks
ServerHooks.prototype.beforeInitialization = [function (jiff, computation_id, msg, params) {
  var party_count = params.party_count;
  // validate party_count
  if (party_count == null) { // no party count given or saved.
    throw new Error('party count is not specified nor pre-saved');
  } else if (party_count < 1) { // Too small
    throw new Error('party count is less than 1');
  } else if (jiff.computationMaps.maxCount[computation_id] != null && party_count !== jiff.computationMaps.maxCount[computation_id]) {
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
    if (jiff.computationMaps.clientIds[computation_id] != null && jiff.computationMaps.clientIds[computation_id].length === jiff.computationMaps.maxCount[computation_id]) {
      throw new Error('Maximum parties capacity reached');
    }
  }

  // All is good
  return params;
}];

ServerHooks.prototype.afterInitialization = [];
ServerHooks.prototype.beforeOperation = [];
ServerHooks.prototype.afterOperation = [];
ServerHooks.prototype.onDisconnect = [];
ServerHooks.prototype.beforeFree = [];
ServerHooks.prototype.afterFree = [];

// other lifecycle array hooks
ServerHooks.prototype.trackFreeIds = function (jiff, party_count) {
  return intervals(1, party_count);
};

ServerHooks.prototype.onInitializeUsedId = function (jiff, computation_id, party_id, party_count, msg) {
  // By default, allow allocation of previously allocated IDs, if either of these conditions is true:
  // 1. Previous party is disconnected (i.e. no socket is currently open between server and party).
  // 2. The party is connected on the same socket it is trying to initialize on now, this may happen
  //    if a party looses connections then regains it before the server detects it lost connection,
  //    but after the party detected that it did.
  var previous_socket_id = jiff.socketMaps.socketId[computation_id][party_id];
  var previous_socket = jiff.io.sockets.connected[previous_socket_id];
  if (previous_socket != null && previous_socket.connected && previous_socket_id !== msg.socket_id) {
    throw new Error(party_id + ' is already taken');
  }

  return party_id;
};

// Computing hooks
ServerHooks.prototype.computeShares = shamir_share.jiff_compute_shares;

// Crypto hooks
ServerHooks.prototype.generateKeyPair = function (jiff) {
  if (jiff.sodium) {
    var key = jiff.sodium.crypto_box_keypair(); // this party's public and secret key
    return {public_key: key.publicKey, secret_key: key.privateKey}
  } else {
    return {public_key: '', secret_key: ''}
  }
};

ServerHooks.prototype.parseKey = function (jiff, keyString) {
  if (jiff.sodium) {
    return new Uint8Array(JSON.parse(keyString));
  } else {
    return '';
  }
};

ServerHooks.prototype.dumpKey = function (jiff, key) {
  if (jiff.sodium) {
    return '[' + key.toString() + ']';
  } else {
    return '';
  }
};

// Mailbox Hooks
ServerHooks.prototype.putInMailbox = mailbox.hooks.putInMailbox;
ServerHooks.prototype.getFromMailbox = mailbox.hooks.getFromMailbox;
ServerHooks.prototype.removeFromMailbox = mailbox.hooks.removeFromMailbox;
ServerHooks.prototype.sliceMailbox = mailbox.hooks.sliceMailbox;

// Executor
ServerHooks.prototype.execute_array_hooks = function (hook_name, params, acc_index) {
  var arr = this[hook_name];
  arr = (arr == null ? [] : arr);

  for (var i = 0; i < arr.length; i++) {
    var result = arr[i].apply(this.jiff, params);
    if (acc_index > -1) {
      params[acc_index] = result;
    }
  }
  if (acc_index > -1) {
    return params[acc_index];
  }
};

module.exports = ServerHooks;