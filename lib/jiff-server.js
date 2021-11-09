var sodium = require('libsodium-wrappers');
var $ = require('jquery-deferred');

var helpers = require('./common/helpers.js');

var compute = require('./server/compute.js');
var Hooks = require('./server/hooks.js');
var extensions = require('./server/extensions.js');
var mailbox = require('./server/mailbox.js');
var socket = require('./server/socket.js');
var handlers = require('./server/handlers.js');
var CryptoProviderHandlers = require('./server/cryptoprovider.js');

// JIFFServer constructor
function JIFFServer(http, options) {
  // options
  options = Object.assign({}, options);
  this.options = options;
  this.http = http;

  // sodium
  if (options.sodium !== false) {
    this.sodium = sodium;
  }

  // maps that store state of computations
  this.computationMaps = {
    clientIds: {}, // { computation_id -> [ party1_id, party2_id, ...] } for only registered/initialized clients
    spareIds: {}, // { computation_id -> <interval object> }
    maxCount: {}, // { computation_id -> <max number of parties allowed> }
    keys: {}, // { computation_id -> { party_id -> <public_key> } }
    secretKeys: {}, // { computation_id -> <privateKey> }
    freeParties: {} // { computation_id -> { id of every free party -> true } }
  };

  // connect socket id, party id and computation id
  this.socketMaps = {
    socketId: {},
    computationId: {},
    partyId: {}
  };

  // Maps clients to their mailboxes
  // { computation_id -> { party_id -> linked_list<[ message1, message2, ... ]> } }
  // Every party has a mailbox of messages that are not yet sent to it (in order).
  // Note: the array of messages is a linked list.
  this.mailbox = {};

  // Properties for extension management
  this.extensions = [];

  // Maps for managing server side computations
  this.computation_instances_map = {};

  // initialize socket
  this.initSocket();
  handlers(this);

  // read and setup hooks
  this.hooks = new Hooks(this);

  // initialize crypto provider handlers
  this.cryptoMap = {}; // { computation_id -> { op_id -> { party_id -> { 'shares': [ numeric shares for this party ], 'values': <any non-secret value(s) for this party> } } } }
  this.cryptoProviderHandlers = new CryptoProviderHandlers(this);
}

// manage state
JIFFServer.prototype.initComputation = function (computation_id, party_id, party_count) {
  if (this.computationMaps.clientIds[computation_id] == null) {
    this.computationMaps.clientIds[computation_id] = [];
    this.computationMaps.maxCount[computation_id] = party_count;
    this.computationMaps.freeParties[computation_id] = {};
    this.computationMaps.keys[computation_id] = {};
    this.socketMaps.socketId[computation_id] = {};
    this.mailbox[computation_id] = {};
    this.cryptoMap[computation_id] = {};
  }

  if (this.computationMaps.clientIds[computation_id].indexOf(party_id) === -1) {
    this.computationMaps.clientIds[computation_id].push(party_id);
  }
};

JIFFServer.prototype.freeComputation = function (computation_id) {
  this.hooks.log(this, 'free computation', computation_id);

  delete this.socketMaps.socketId[computation_id];
  delete this.computationMaps.clientIds[computation_id];
  delete this.computationMaps.spareIds[computation_id];
  delete this.computationMaps.maxCount[computation_id];
  delete this.computationMaps.freeParties[computation_id];
  delete this.computationMaps.keys[computation_id];
  delete this.computationMaps.secretKeys[computation_id];
  delete this.mailbox[computation_id];
  delete this.computation_instances_map[computation_id];
  delete this.cryptoMap[computation_id];
};

JIFFServer.prototype.repr = function () {
  var copy = Object.assign({}, this);
  copy.sodium = '<sodium>';
  copy.http = '<http>';
  copy.io = '<io>';
  return copy;
};

// export constructor
module.exports = JIFFServer;

// fill in prototype
JIFFServer.prototype.helpers = Object.assign({}, helpers);

extensions(JIFFServer);
compute(JIFFServer);

socket(JIFFServer);
mailbox.initPrototype(JIFFServer);