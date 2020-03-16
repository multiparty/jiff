var $ = require('jquery-deferred');

var client = require('../jiff-client.js');

// Server side computations
module.exports = function (JIFFServer) {
  // this provides a way for users to specify what part(s) of computation to run on server
  JIFFServer.prototype.compute = function (computation_id, options) {
    if (this.computation_instances_deferred[computation_id] == null) {
      this.computation_instances_deferred[computation_id] = $.Deferred();
    }
    this.computation_instances_map[computation_id] = create_computation_instance(this, computation_id, options);
    return this.computation_instances_map[computation_id];
  };
};

// Create a computation id that provides an identical API to that of clients for the given computation.
function create_computation_instance(jiff, computation_id, options) {
  options = Object.assign({}, options);
  options.party_id = 's1';
  options.party_count = jiff.computationMaps.maxCount[computation_id];
  options.secret_key = null;
  options.public_key = null;
  options.__internal_socket = new InternalSocket(jiff, computation_id);

  // Create instance
  var computation_instance = new client('<server_instance>', computation_id, options);

  // Modify instance
  computation_instance.server = jiff;
  return computation_instance;
}

// Create an internal socket that is passed to the jiff client code
// to mimic a socket (but without actual communication)
// the internal socket interfaces between the jiff client (computation instance) code and the jiff server code
function InternalSocket(jiff, computation_id) {
  this.callbacks = {};
  this.jiff = jiff;
  this.computation_id = computation_id;
}

InternalSocket.prototype.__ = function () {};

InternalSocket.prototype.on = function (tag, callback) {
  // sever subscribing in computation instance
  this.callbacks[tag] = callback;
};

InternalSocket.prototype.connect = function () {
  var computation_instance = this.jiff.computation_instances_map[this.computation_id];

  // Call initialization procedure on server (mimicking computation instance)
  var msg = computation_instance.handlers.build_initialization_message();
  var output = this.jiff.handlers.initializeParty(this.computation_id, 's1', computation_instance.party_count, msg, true);

  // Forward server output to instance (mimicking server)
  if (output.success) {
    computation_instance.secret_key = this.jiff.computationMaps.secretKeys[this.computation_id];
    computation_instance.public_key = this.jiff.computationMaps.keys[this.computation_id]['s1'];

    computation_instance.socket.receive('initialization', JSON.stringify(output.message));
    this.jiff.computation_instances_deferred[this.computation_id].resolve();
  } else {
    throw new Error('Cannot initialize computation instance ' + this.computation_id + '. Error: ' + output.error);
  }
};

InternalSocket.prototype.receive = function (tag, param) {
  // from computation instance into server
  this.callbacks[tag](param, this.__);
};

InternalSocket.prototype.emit = function (label, msg) {
  // From server into the computation instance
  var from_id = 's1';
  msg = JSON.parse(msg);

  if (['share', 'open', 'custom', 'crypto_provider'].indexOf(label) > -1) {
    var output = this.jiff.handlers[label](this.computation_id, from_id, msg);
    if (!output.success) {
      var errorMsg = JSON.stringify({label: label, error: output.error});
      this.receive('error', errorMsg);
    }
  }
};