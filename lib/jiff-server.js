/**
 * JIFF Server.
 *
 * Exposes the constructor for the {@link module:jiff-server~JIFFServer} class.
 *
 *
 * In node.js, this can be accessed via:
 * <pre><code>
 *   const JIFFServer = require('jiffServer');
 *   const jiffServerInstance = new JIFFServer(hostname, computationId, options);
 *
 * </code></pre>
 *
 * @module jiff-server
 * @alias jiff-server
 */
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
/**
 * Creates a new jiff server instance.
 * @class
 * @name JIFFServer
 * @param {!object} http - http server library.
 * @param {?object} [options={}] - javascript object with additional options.
 *                           all parameters are optional, However, private and public key must either be both provided or neither of them provided.
 <pre>
 {
   "logs": boolean, if true, all incoming messages will be logged to the console,
   "secret_key": Uint8Array to be used with libsodium-wrappers [(check Library Specs)]{@link https://download.libsodium.org/doc/public-key_cryptography/authenticated_encryption.html},
   "public_key": Uint8Array to be used with libsodium-wrappers [(check Library Specs)]{@link https://download.libsodium.org/doc/public-key_cryptography/authenticated_encryption.html},
   "hooks": { 'check out <a href="hooks.html">hooks documentation</a>' },
   "socketOptions": an object, passed directly to socket.io constructor,
   "sodium": boolean, if false messages between server and clients will not be encrypted (useful for debugging),
 }
 </pre>
 *
 * @example
 * var express = require('express');
 * var app = express();
 * var http = require('http').Server(app);
 * //Serve static files
 * //Configure App
 * app.use('/demos', express.static(path.join(__dirname, '..', '..', 'demos')));
 * app.use('/dist', express.static(path.join(__dirname, '..', '..', 'dist')));

 * var JIFFServer = require('../../lib/jiff-server.js');
 * new JIFFServer(http, { logs: true });

 * // Serve static files.
 * http.listen(8080, function () {
 *  console.log('listening on *:8080');
 * });
 */
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
  this.computation_instances_deferred = {};

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

    if (this.computation_instances_deferred[computation_id] == null) {
      this.computation_instances_deferred[computation_id] = $.Deferred();
    }
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
  delete this.computation_instances_deferred[computation_id];
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
