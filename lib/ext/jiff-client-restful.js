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

  // Take the jiff-client base instance and options for this extension, and use them
  // to construct an instance for this extension.
  exports.make_jiff = function (base_instance, options) {
    var jiff = base_instance;
    if (options.__internal_socket != null) {
      // internal server computation instance is not rest nor sockets, ignore.
      return jiff;
    }

    // Stop the socket just in case it got connected somehow (if user forgot to disabled autoConnect)
    jiff.socket.disconnect();

    // Parse options
    if (options == null) {
      options = {};
    }

    if (options.routes == null) {
      options.routes = {};
    }

    // restAPI properties and functions
    jiff.restful = {};
    jiff.restful.__immediate_initialization = false;

    // Helper: execute all listeners for some event with given parameters
    jiff.restful.execute_listeners = function (event, msg) {
      if (event !== 'error') {
        msg = JSON.stringify(msg);
      }

      var listeners = jiff.socket.listeners(event);
      for (var i = 0; i < listeners.length; i++) {
        listeners[i].call(null, msg, function () {});
      }
    };

    // send HTTP requests
    jiff.restful.send = function () {
      if (jiff.socket.mailbox.pending_request != null) {
        return;
      }

      // Construct request body
      var body = { computation_id: jiff.computation_id, from_id: jiff.party_id };
      body = Object.assign(body, jiff.socket.mailbox.current_request);

      // Mark mailbox with a pending request
      jiff.socket.mailbox.pending_request = jiff.socket.mailbox.current_request;
      jiff.socket.mailbox.current_request = { messages: [] };
      jiff.restful.make_request(JSON.stringify(body));
    };
    var request = require('request');
    jiff.restful.make_request = function (body) {
      // TODO: Make request according to either node or browser requests
      var options = {
        url: jiff.hostname + 'poll',
        headers: { 'Content-Type': 'application/json' },
        body: body
      };

      request.post(options, function (error, response, body) {
        jiff.restful.receive(error, body);
      });
    };
    jiff.restful.receive = function (error, body) {
      if (error != null) {
        jiff.mailbox.merge_requests();
        return;
      }

      body = JSON.parse(body);
      if (!body['success']) {
        jiff.restful.execute_listeners('error', body['error']);
        return;
      }

      // No pending requests!
      jiff.socket.mailbox.pending_request = null;

      // handle ack, initialization, and remaining messages
      jiff.socket.mailbox.ack = body['ack'];
      if (body['initialization'] != null) {
        jiff.restful.execute_listeners('initialization', body['initialization']);
      }
      for (var i = 0; i < body['messages'].length; i++) {
        var msg = body['messages'][i];
        jiff.restful.execute_listeners(msg['label'], msg['payload']);
      }
    };

    // Override core socket functionality
    // mailbox has the format of the API immediately, we can use it to determine if a POST request is still in progress.
    jiff.socket.mailbox = {};
    jiff.socket.mailbox.pending_request = null;
    jiff.socket.mailbox.current_request = { messages: [] };
    jiff.socket.mailbox.merge_requests = function () {
      var mailbox = jiff.socket.mailbox;
      if (mailbox.pending_request == null) {
        return;
      }

      if (mailbox.current_request.initialization == null) {
        mailbox.current_request.initialization = mailbox.pending_request.initialization;
      }
      if (mailbox.current_request.ack == null) {
        mailbox.current_request.ack = mailbox.pending_request.ack;
      }
      mailbox.current_request.messages = mailbox.pending_request.messages.concat(mailbox.current_request.messages);
      mailbox.pending_request = null;
    };

    // there is no notion of "connection", connect event resolve immediately, and .connected is always true.
    jiff.socket.connected = true;
    jiff.socket.connect = function () {
      var connectListeners = jiff.socket.listeners('connect');
      for (var i = 1; i < connectListeners.length; i++) {
        connectListeners[i]();
      }
    };

    // Instead of emitting over the socket, we emit through our send function, in addition to batching if needed.
    jiff.socket.emit = function (label, msg) {
      msg = JSON.parse(msg);

      if (label === 'initialization') {
        jiff.socket.mailbox.current_request.initialization = msg;
      }

      if ((jiff.restful.__immediate_initialization && label === 'initialization') || jiff != null) {
        jiff.restful.__immediate_initialization = false;
        jiff.restful.send();
      }
    };
    jiff.socket.safe_emit = jiff.socket.emit;
    jiff.socket.resend_mailbox = function () {};
    jiff.socket.disconnect = function () {
      jiff.execute_array_hooks('beforeOperation', [jiff, 'disconnect', {}], -1);
      // TODO: Cancel poll / flush intervals
      jiff.execute_array_hooks('afterOperation', [jiff, 'disconnect', {}], -1);
    };
    jiff.socket.safe_disconnect = function (free, callback) {
      if (free) {
        jiff.free();
      }
      // TODO: when all outgoing messages are sent, execute callback
    };

    // Override jiff connect and disconnect routines
    var old_jiff_connect = jiff.connect;
    jiff.connect = function (immediate) {
      // TODO: set poll / flush intervals
      jiff.restful.__immediate_initialization = (immediate !== false);
      old_jiff_connect();
    };

    return jiff;
  };
}((typeof exports === 'undefined' ? this.jiff_bignumber = {} : exports), typeof exports !== 'undefined'));
