/**
 * This defines a library extension for using websockets rather than socket.io for communication. This
 * extension primarily edits/overwrites existing socket functions to use and be compatible with the
 * ws library.
 * @namespace jiffclient_websockets
 * @version 1.0
 *
 * REQUIREMENTS:
 * You must apply this extension to your client and the server you're communicating with must apply jiffserver_websockets.
 * When using this extension in browser, "/dist/jiff-client-websockets.js" must be loaded in client.html instead of this file.
 */



(function (exports, node) {
  /**
   * The name of this extension: 'websocket'
   * @type {string}
   * @memberOf jiffclient_websockets
   */

  var ws;
  var linkedList;
  var handlers;

  linkedList = require('../common/linkedlist.js');
  handlers = require('../client/handlers.js');
  if (!process.browser) {
    ws = require('ws');
  } else {
    if (typeof WebSocket !== 'undefined') {
      ws = WebSocket
    } else if (typeof MozWebSocket !== 'undefined') {
      ws = MozWebSocket
    } else if (typeof global !== 'undefined') {
      ws = global.WebSocket || global.MozWebSocket
    } else if (typeof window !== 'undefined') {
      ws = window.WebSocket || window.MozWebSocket
    } else if (typeof self !== 'undefined') {
      ws = self.WebSocket || self.MozWebSocket
    }
  }


  // Take the jiff-client base instance and options for this extension, and use them
  // to construct an instance for this extension.
  function make_jiff(base_instance, options) {
    var jiff = base_instance;

    // Parse options
    if (options == null) {
      options = {};
    }

    /* Functions that overwrite client/socket/events.js functionality */

    /**
     * initSocket's '.on' functions needed to be replaced since ws does
     * not have as many protocols. Instead these functions are routed to
     * when a message is received and a protocol is manually parsed.
     */
    jiff.initSocket = function () {
      var jiffClient = this;

      /* ws uses the 'open' protocol on connection. Should not conflict with the
           JIFF open protocl as that will be sent as a message and ws
           will see it as a 'message' protocol. */
      this.socket.onopen = jiffClient.handlers.connected;

      // Public keys were updated on the server, and it sent us the updates
      function publicKeysChanged(msg, callback) {

        msg = JSON.parse(msg);
        msg = jiffClient.hooks.execute_array_hooks('afterOperation', [jiffClient, 'public_keys', msg], 2);

        jiffClient.handlers.store_public_keys(msg.public_keys);
      }

      // Setup receiving matching shares
      function share(msg, callback) {

        // parse message
        var json_msg = JSON.parse(msg);
        var sender_id = json_msg['party_id'];

        if (jiffClient.keymap[sender_id] != null) {
          jiffClient.handlers.receive_share(json_msg);
        } else {
          if (jiffClient.messagesWaitingKeys[sender_id] == null) {
            jiffClient.messagesWaitingKeys[sender_id] = [];
          }
          jiffClient.messagesWaitingKeys[sender_id].push({ label: 'share', msg: json_msg });
        }
      }

      function mpcOpen(msg, callback) {
        // parse message
        var json_msg = JSON.parse(msg);
        var sender_id = json_msg['party_id'];

        if (jiffClient.keymap[sender_id] != null) {
          jiffClient.handlers.receive_open(json_msg);
        } else {
          if (jiffClient.messagesWaitingKeys[sender_id] == null) {
            jiffClient.messagesWaitingKeys[sender_id] = [];
          }
          jiffClient.messagesWaitingKeys[sender_id].push({ label: 'open', msg: json_msg });
        }
      }

      // handle custom messages
      function socketCustom(msg, callback) {
        var json_msg = JSON.parse(msg);
        var sender_id = json_msg['party_id'];
        var encrypted = json_msg['encrypted'];

        if (jiffClient.keymap[sender_id] != null || encrypted !== true) {
          jiffClient.handlers.receive_custom(json_msg);
        } else {
          // key must not exist yet for sender_id, and encrypted must be true
          if (jiffClient.messagesWaitingKeys[sender_id] == null) {
            jiffClient.messagesWaitingKeys[sender_id] = [];
          }
          jiffClient.messagesWaitingKeys[sender_id].push({ label: 'custom', msg: json_msg });
        }
      }

      function cryptoProvider(msg, callback) {
        jiffClient.handlers.receive_crypto_provider(JSON.parse(msg));
      }

      function onError(msg) {
        try {
          msg = JSON.parse(msg);
          jiffClient.handlers.error(msg['label'], msg['error']);
        } catch (error) {
          jiffClient.handlers.error('socket.io', msg);
        }
      }

      function socketClose(reason) {
        if (reason !== 'io client disconnect') {
          // check that the reason is an error and not a user initiated disconnect
          console.log('Disconnected!', jiffClient.id, reason);
        }

        jiffClient.hooks.execute_array_hooks('afterOperation', [jiffClient, 'disconnect', reason], -1);
      }

      this.socket.onclose = function (reason) {
        socketClose(reason.code);
      }

      /**
       * In every message sent over ws, we will send along with it a socketProtocol string
       * that will be parsed by the receiver to route the request to the correct function. The
       * previous information sent by socket.io will be untouched, but now sent inside of msg.data.
       */
      this.socket.onmessage = function (msg, callback) {
        msg = JSON.parse(msg.data);

        switch (msg.socketProtocol) {
          case 'initialization':
            jiffClient.handlers.initialized(msg.data);
            break;
          case 'public_keys':
            publicKeysChanged(msg.data, callback);
            break;
          case 'share':
            share(msg.data, callback);
            break;
          case 'open':
            mpcOpen(msg.data, callback);
            break;
          case 'custom':
            socketCustom(msg.data, callback);
            break;
          case 'crypto_provider':
            cryptoProvider(msg.data, callback);
            break;
          case 'close':
            socketClose(msg.data);
            break;
          case 'disconnect':
            socketClose(msg.data);
            break;
          case 'error':
            onError(msg.data);
            break;
          default:
            console.log('Uknown protocol, ' + msg.socketProtocol + ', received');
        }
      }

    };

    /* Overwrite the socketConnect function from jiff-client.js */

    jiff.socketConnect = function (JIFFClientInstance) {

      if (options.__internal_socket == null) {
        /**
         * Socket wrapper between this instance and the server, based on sockets.io
         * @type {!GuardedSocket}
         */
        JIFFClientInstance.socket = guardedSocket(JIFFClientInstance);
      } else {
        JIFFClientInstance.socket = internalSocket(JIFFClientInstance, options.__internal_socket);
      }

      // set up socket event handlers
      handlers(JIFFClientInstance);

      // Overwrite handlers.connected with our new ws connection handler
      JIFFClientInstance.handlers.connected = function () {
        JIFFClientInstance.initialization_counter++;

        if (JIFFClientInstance.secret_key == null && JIFFClientInstance.public_key == null) {
          var key = JIFFClientInstance.hooks.generateKeyPair(JIFFClientInstance);
          JIFFClientInstance.secret_key = key.secret_key;
          JIFFClientInstance.public_key = key.public_key;
        }

        // Initialization message
        var msg = JIFFClientInstance.handlers.build_initialization_message();

        // Double wrap the msg
        msg = JSON.stringify(msg);

        // Emit initialization message to server
        JIFFClientInstance.socket.send(JSON.stringify({ socketProtocol: 'initialization', data: msg }));
      };


      JIFFClientInstance.initSocket();
    }

    /* Functions that overwrite client/socket/mailbox.js functionality */

    function guardedSocket(jiffClient) {
      // Create plain socket io object which we will wrap in this
      var socket;
      if (jiffClient.hostname.startsWith("http")) {
        var modifiedHostName = "ws" + jiffClient.hostname.substring(jiffClient.hostname.indexOf(":"))
        socket = new ws(modifiedHostName)
      } else {
        socket = new ws(jiffClient.hostname);
      }


      socket.old_disconnect = socket.close;

      socket.mailbox = linkedList(); // for outgoing messages
      socket.empty_deferred = null; // gets resolved whenever the mailbox is empty
      socket.jiffClient = jiffClient;

      // add functionality to socket
      socket.safe_emit = safe_emit.bind(socket);
      socket.resend_mailbox = resend_mailbox.bind(socket);
      socket.disconnect = disconnect.bind(socket);
      socket.safe_disconnect = safe_disconnect.bind(socket);
      socket.is_empty = is_empty.bind(socket);

      return socket;
    }

    function safe_emit(label, msg) {
      // add message to mailbox
      var mailbox_pointer = this.mailbox.add({ label: label, msg: msg });
      if (this.readyState === 1) {
        var self = this;
        // emit the message, if an acknowledgment is received, remove it from mailbox

        this.send(JSON.stringify({ socketProtocol: label, data: msg }), null, function (status) {

          self.mailbox.remove(mailbox_pointer);

          if (self.is_empty() && self.empty_deferred != null) {
            self.empty_deferred.resolve();
          }

          if (label === 'free') {
            self.jiffClient.hooks.execute_array_hooks('afterOperation', [self.jiffClient, 'free', msg], 2);
          }
        });
      }

    }

    function resend_mailbox() {
      // Create a new mailbox, since the current mailbox will be resent and
      // will contain new backups.
      var old_mailbox = this.mailbox;
      this.mailbox = linkedList();

      // loop over all stored messages and emit them
      var current_node = old_mailbox.head;
      while (current_node != null) {
        var label = current_node.object.label;
        var msg = current_node.object.msg;
        this.safe_emit(label, msg);
        current_node = current_node.next;
      }

    }

    function disconnect() {

      this.jiffClient.hooks.execute_array_hooks('beforeOperation', [this.jiffClient, 'disconnect', {}], -1);


      this.old_disconnect.apply(this, arguments);
    }

    function safe_disconnect(free, callback) {

      if (this.is_empty()) {

        if (free) {
          this.jiffClient.free();
          free = false;
        } else {
          // T: Should remain "disconnect" since we override the .disconnect, no need to change to close
          this.disconnect();
          if (callback != null) {
            callback();
          }
          return;
        }
      }

      this.empty_deferred = new this.jiffClient.helpers.Deferred();
      this.empty_deferred.promise.then(this.safe_disconnect.bind(this, free, callback));

    }

    function is_empty() {
      return this.mailbox.head == null && this.jiffClient.counters.pending_opens === 0;

    }

    /* PREPROCESSING IS THE SAME */
    jiff.preprocessing_function_map[exports.name] = {};


    return jiff;
  }
  // Expose the API for this extension.
  exports.make_jiff = make_jiff;

}((typeof exports === 'undefined' ? this.jiff_websockets = {} : exports), typeof exports !== 'undefined'));
