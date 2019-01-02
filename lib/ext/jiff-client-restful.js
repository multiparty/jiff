/**
 * This defines a library extension for relying on restAPIs as opposed to sockets for communication.
 *
 * @namespace jiff_restAPI
 * @version 1.0
 */
(function (exports, node) {
  /**
   * The name of this extension: 'restAPI'
   * @type {string}
   * @memberOf jiff_restAPI
   */
  exports.name = 'restAPI';

  // Send an HTTP request
  var send;
  if (node) {
    send = function (label, from_id, computation_id, msg) {};
  } else {
    send = function (label, from_id, computation_id, msg) {};
  }

  // Take the jiff-client base instance and options for this extension, and use them
  // to construct an instance for this extension.
  exports.make_jiff = function (base_instance, options) {
    var jiff = base_instance;
    if (options.__internal_socket != null) {
      // internal server computation instance is not rest nor sockets, ignore.
      return jiff;
    }

    // Parse options
    if (options == null) {
      options = {};
    }

    if (options.routes == null) {
      options.routes = {};
    }

    // restAPI properties and functions
    jiff.restful = {};

    // Override jiff connection
    jiff.connect = function () {
      var ready_connect = function () {
        var msg = {
          computation_id: jiff.computation_id,
          party_id: jiff.id,
          party_count: jiff.party_count
        };

        msg = jiff.execute_array_hooks('beforeOperation', [jiff, 'initialization', msg], 2);
        msg = JSON.stringify(msg);

        // Send the computation id to the server to receive proper
        // identification
        jiff.socket.emit('initialization', msg);
      };

      if (jiff.sodium_ready == null) {
        ready_connect();
      } else {
        jiff.sodium_ready.then(ready_connect);
      }
    };

    return jiff;
  };
}((typeof exports === 'undefined' ? this.jiff_bignumber = {} : exports), typeof exports !== 'undefined'));
