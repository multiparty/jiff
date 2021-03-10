/**
 * This defines a library extension for using websockets rather than socket.io for communication. This
 * extension primarily edits/overwrites existing socket functions to use and be compatible with the 
 * ws library.
 * @namespace jiffclient_websockets
 * @version 1.0
 *
 * REQUIREMENTS:
 * You must apply this extension to your client and the server you're communicating with must apply jiffserver_websockets.
 */

var WebSocket = require('ws');
var linked_list = require('../common/linkedlist.js');
const socket = require('../server/socket.js');

(function (exports, node) {
  /**
   * The name of this extension: 'websocket'
   * @type {string}
   * @memberOf jiffclient_websockets
   */
  exports.name = 'websocket';

  if (node) {
    // TODO: add node/browser dependency switching for ws and  ws-isomorphic
    // has to be global to make sure BigNumber library sees it.
    // global.crypto = require('crypto');
  } else {
    // window.crypto = window.crypto || window.msCrypto;
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
      this.socket.on('open', jiffClient.handlers.connected);

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
          jiffClient.messagesWaitingKeys[sender_id].push({label: 'share', msg: json_msg});
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
          jiffClient.messagesWaitingKeys[sender_id].push({label: 'open', msg: json_msg});
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
          jiffClient.messagesWaitingKeys[sender_id].push({label: 'custom', msg: json_msg});
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

      this.socket.on('close', function (reason) {
        socketClose(reason);
      });

      /**
         * In every message sent over ws, we will send along with it a socketProtocol string
         * that will be parsed by the receiver to route the request to the correct function. The
         * previous information sent by socket.io will be untouched, but now sent inside of msg.data.
         */
      this.socket.on('message', function (msg, callback) {
        msg = JSON.parse(msg);

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
      });

    };

    /* Overwrite the socketConnect function from jiff-client.js */
    var handlers = require('../client/handlers.js');
    jiff.socketConnect = function (JIFFClientInstance) {
      JIFFClientInstance.socket = guardedSocket(JIFFClientInstance);

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
        JIFFClientInstance.socket.send(JSON.stringify( { socketProtocol: 'initialization', data: msg }));
      };


      JIFFClientInstance.initSocket();
    }
    /**
     * A guarded socket with an attached mailbox.
     *
     * The socket uses the mailbox to store all outgoing messages, and removes them from the mailbox only when
     * the server acknowledges their receipt. The socket resends mailbox upon re-connection. Extends {@link https://socket.io/docs/client-api/#Socket}.
     * @see {@link module:jiff-client~JIFFClient#socket}
     * @name GuardedSocket
     * @alias GuardedSocket
     * @constructor
     */

    /* Functions that overwrite client/socket/mailbox.js functionality */

    function guardedSocket(jiffClient) {
      // Create plain socket io object which we will wrap in this
      var socket = new WebSocket(jiffClient.hostname)

      socket.old_disconnect = socket.close;

      socket.mailbox = linked_list(); // for outgoing messages
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

    /**
     * Safe emit: stores message in the mailbox until acknowledgment is received, results in socket.emit(label, msg) call(s)
     * @method safe_emit
     * @memberof GuardedSocket
     * @instance
     * @param {string} label - the label given to the message
     * @param {string} msg - the message to send
     */
    function safe_emit(label, msg) {
      // add message to mailbox
      var mailbox_pointer = this.mailbox.add({ label: label, msg: msg });
      if (this.readyState === 1) {
        var self = this;
        // emit the message, if an acknowledgment is received, remove it from mailbox

        this.send(JSON.stringify( { socketProtocol: label, data: msg } ), null, function (status) {

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


    /**
     * Re-sends all pending messages
     * @method resend_mailbox
     * @memberof GuardedSocket
     * @instance
     */
    function resend_mailbox() {
      // Create a new mailbox, since the current mailbox will be resent and
      // will contain new backups.
      var old_mailbox = this.mailbox;
      this.mailbox = linked_list();

      // loop over all stored messages and emit them
      var current_node = old_mailbox.head;
      while (current_node != null) {
        var label = current_node.object.label;
        var msg = current_node.object.msg;
        this.safe_emit(label, msg);
        current_node = current_node.next;
      }

    }


    /**
     * Wraps socket regular disconnect with a call to a hook before disconnection
     * @method disconnect
     * @memberof GuardedSocket
     * @instance
     */
    function disconnect() {

      this.jiffClient.hooks.execute_array_hooks('beforeOperation', [this.jiffClient, 'disconnect', {}], -1);

      
      this.old_disconnect.apply(this, arguments);
    }


    /**
     * Safe disconnect: disconnect only after all messages (including free) were acknowledged and
     * all pending opens were resolved
     * @method safe_disconnect
     * @memberof GuardedSocket
     * @instance
     * @param {boolean} [free=false] - if true, a free message will be issued prior to disconnecting
     * @param {function()} [callback] - given callback will be executed after safe disconnection is complete
     */
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


    /**
     * Checks if the socket mailbox is empty (all communication was done and acknowledged),
     * used in safe_disconnect
     * @method is_empty
     * @memberof GuardedSocket
     * @instance
     */
    function is_empty() {
      return this.mailbox.head == null && this.jiffClient.counters.pending_opens === 0;

    }

    /* PREPROCESSING IS THE SAME */
    jiff.preprocessing_function_map[exports.name] = {};


    return jiff;
  }
  // Expose the API for this extension.
  exports.make_jiff = make_jiff;

}((typeof exports === 'undefined' ? this.jiffclient_websockets = {} : exports), typeof exports !== 'undefined'));

