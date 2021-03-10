/**
 * This defines a library extension for relying on restAPIs as opposed to sockets for communication.
 *
 * @namespace jiff_restAPI
 * @version 1.0
 */
(function (exports, node) {
  var request;
  if (node) {
    request = require('request');
  }

  /**
   * Send POST request using browser native API (XMLHttpRequest).
   * @param {string} hostname - hostname of server: ends with / and does not include the route path, includes port and http/https.
   * @param {string} body - body of POST request.
   * @param {function(error{null|string|number}, response{string})} callback - callback to handle errors and responses.
   */
  function browserPOST(hostname, body, callback) {
    var xhr = new XMLHttpRequest();
    xhr.open('POST', hostname + 'poll');
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.onreadystatechange = function () {
      if (xhr.readyState === 4) {
        var error = xhr.status === 200 ? null : xhr.status;
        callback(error, xhr.responseText);
      }
    };
    xhr.send(body);
  }
  /**
   * Send POST request using node.js request library.
   * @param {string} hostname - hostname of server: ends with / and does not include the route path, includes port and http/https.
   * @param {string} body - body of POST request.
   * @param {function(error{null|string|number}, response{string})} callback - callback to handle errors and responses.
   */
  function nodePOST(hostname, body, callback) {
    var options = {
      url: hostname + 'poll',
      headers: { 'Content-Type': 'application/json' },
      body: body
    };

    request.post(options, function (error, response, body) {
      callback(error, body);
    });
  }

  /**
   * Sends POST request according to the environment.
   */
  var POST = node ? nodePOST : browserPOST;

  /**
   * Helper: executes all listeners attached to jiff's socket to the given event, passing the given msg as parameter.
   * @param {jiff-instance} jiff - the jiff instance to which the socket belongs.
   * @param {string} event - the event name/label (e.g. share, open, ...)
   * @param {string} msg - JSON string representing the message to pass to the listeners.
   */
  function execute_listeners(jiff, event, msg) {
    var listeners = jiff.socket.listeners(event);
    for (var i = 0; i < listeners.length; i++) {
      listeners[i].call(null, msg, function () {});
    }
  }

  /**
   * Overrides the mailbox to be more appropriate for restAPI.
   * In particular, the mailbox contains two properties:
   * 1. pending: stores the body of any request currently being made.
   * 2. current: stores the body of request not yet made (under construction), new messages are
   * added to this body as they come.
   * Additionally, the mailbox provides a `merge_requests` method, to merge pending into current,
   * in order to re-stage the body of failed requests.
   * @param {jiff-instance} jiff - the instance in which the new mailbox is installed.
   */
  function mailboxRestAPI(jiff) {
    jiff.socket.mailbox = {};
    jiff.socket.mailbox.pending = null;
    jiff.socket.mailbox.current = { messages: [] };
    jiff.socket.mailbox.merge_requests = function () {
      var mailbox = jiff.socket.mailbox;
      if (mailbox.pending == null) {
        return;
      }

      if (mailbox.current.initialization == null) {
        mailbox.current.initialization = mailbox.pending.initialization;
      }
      if (mailbox.current.ack == null) {
        mailbox.current.ack = mailbox.pending.ack;
      }
      mailbox.current.messages = mailbox.pending.messages.concat(mailbox.current.messages);
      mailbox.pending = null;
    };
  }

  /**
   * Completely override the socket object, so that the socket is effectiely destroyed and useless.
   * Overrides the following methods:
   * 1. connect: does nothing and immediately fires the 'connect' event.
   * 2. emit: adds the given label and message to the body of the current request in the mailbox.
   * 3. safe_emit: alias for emit.
   * 4. resend_mailbox: does nothing.
   * 5. disconnect: fires the appropriate hooks, and cancels the polling/flushing daemons, fires the 'disconnect' event.
   * 6. safe_disconnect: ensures that all messages have been flushed (including any pending free), before calling disconnect.
   * @param {jiff-instance} jiff - the instance in which the socket is overriden.
   */
  function socketToRestAPI(jiff) {
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
        jiff.socket.mailbox.current.initialization = msg;
        return;
      }

      jiff.socket.mailbox.current.messages.push({ label: label, payload: msg });
    };

    // disconnect related methods
    jiff.socket.disconnect = function () {
      jiff.hooks.execute_array_hooks('beforeOperation', [jiff, 'disconnect', {}], -1);
      if (jiff.pollInterval != null) {
        clearInterval(jiff.pollInterval);
      }
      if (jiff.flushInterval != null) {
        clearInterval(jiff.flushInterval);
      }
      jiff.hooks.execute_array_hooks('afterOperation', [jiff, 'disconnect', {}], -1);
    };
    jiff.socket.is_empty = function () {
      return jiff.socket.mailbox.pending == null
        && jiff.socket.mailbox.current.initialization == null
        && jiff.socket.mailbox.current.messages.length === 0
        && jiff.counters.pending_opens === 0;
    };

    // aliases and empty methods
    jiff.socket.safe_emit = jiff.socket.emit;
    jiff.socket.resend_mailbox = function () {};
  }

  /**
   * The name of this extension: 'restAPI'
   * @type {string}
   * @memberOf jiff_restAPI
   */
  exports.name = 'restAPI';

  // Use this as the socket.io dependency in jiff-client
  // if you want to remove socket.io completely.
  exports.io = function () {
    var listeners = { connect : [ 0 ] };
    var self = {};
    self.on = function (event, listener) {
      if (listeners[event] == null) {
        listeners[event] = [];
      }

      listeners[event].push(listener);
    };
    self.listeners = function (event) {
      return listeners[event] != null ? listeners[event] : [];
    };
    self.disconnect = function () {};
    return self;
  };

  // Take the jiff-client base instance and options for this extension, and use them
  // to construct an instance for this extension.
  exports.make_jiff = function (jiff, options) {
    options = options == null ? {} : options;
    // internal server computation instance is not rest nor sockets, ignore.
    if (options.__internal_socket != null) {
      return jiff;
    }

    // Default parameters
    options.pollInterval = (options.pollInterval == null ? 0 : options.pollInterval);
    options.flushInterval = (options.flushInterval == null ? 250 : options.flushInterval);
    jiff.maxBatchSize = (options.maxBatchSize == null) ? 150 : options.maxBatchSize;

    // Stop the socket just in case it got connected somehow (if user forgot to disabled autoConnect)
    if (jiff.socket == null) {
      jiff.socketConnect(jiff);
    }
    jiff.socket.disconnect();

    // Preprocessing here is trivial
    jiff.preprocessing_function_map[exports.name] = {};

    // restAPI properties and functions
    jiff.restFlush = function () {
      if (jiff.socket.mailbox.pending != null) {
        return;
      }

      // Construct request body
      var messages = jiff.socket.mailbox.current.messages;
      var sliced = messages.slice(0, jiff.maxBatchSize);
      var tail = messages.slice(jiff.maxBatchSize);
      var body = {
        ack: jiff.socket.mailbox.current.ack,
        messages: sliced,
        initialization: jiff.socket.mailbox.current.initialization,
        computation_id: jiff.computation_id,
        from_id: jiff.id
      };

      // Mark mailbox with a pending request
      jiff.socket.mailbox.pending = body;
      jiff.socket.mailbox.current = { messages: tail };

      body = JSON.stringify(body);
      POST(jiff.hostname, body, jiff.restReceive);
    };
    jiff.restPoll = function () {
      if (jiff.socket.mailbox.pending != null) {
        return;
      }

      // Construct request body
      var body = {
        ack: jiff.socket.mailbox.current.ack,
        messages: [],
        initialization: jiff.socket.mailbox.current.initialization,
        computation_id: jiff.computation_id,
        from_id: jiff.id
      };

      // Mark mailbox with a pending request
      jiff.socket.mailbox.pending = body;
      jiff.socket.mailbox.current = { messages: jiff.socket.mailbox.current.messages };

      body = JSON.stringify(body);
      POST(jiff.hostname, body, jiff.restReceive);
    };
    jiff.restReceive = function (error, body) {
      if (error != null) {
        jiff.socket.mailbox.merge_requests();
        return;
      }

      body = JSON.parse(body);
      if (!body['success']) {
        execute_listeners(jiff, 'error', JSON.stringify({label: body['label'], error: body['error']}));
        return;
      }

      // No pending requests!
      jiff.socket.mailbox.pending = null;

      // handle ack, initialization, and remaining messages
      jiff.socket.mailbox.current.ack = body['ack'];
      if (body['initialization'] != null) {
        execute_listeners(jiff, 'initialization', body['initialization']);
      }
      for (var i = 0; i < body['messages'].length; i++) {
        var msg = body['messages'][i];
        execute_listeners(jiff, msg['label'], msg['payload']);
      }

      if (jiff.socket.is_empty() && jiff.socket.empty_deferred != null) {
        jiff.socket.empty_deferred.resolve();
      }
    };

    // Override core socket functionality
    mailboxRestAPI(jiff);
    socketToRestAPI(jiff);

    // Override jiff connect and disconnect routines
    jiff.connect = function (immediate) {
      var setup = function () {
        jiff.socket.connect();

        if (immediate !== false) {
          jiff.restFlush();
        }

        // Run poll and flush periodically.
        jiff.pollInterval = options.pollInterval !== 0 ? setInterval(jiff.restPoll, options.pollInterval) : null;
        jiff.flushInterval = options.flushInterval !== 0 ? setInterval(jiff.restFlush, options.flushInterval) : null;
      };

      if (jiff.sodium_ === false) {
        setup();
      } else {
        jiff.sodium_.ready.then(setup);
      }
    };

    return jiff;
  };
}((typeof exports === 'undefined' ? this.jiff_restAPI = {} : exports), typeof exports !== 'undefined'));
