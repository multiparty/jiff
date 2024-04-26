(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.jiff_websockets = f()}})(function(){var define,module,exports;return (function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
var initializationHandlers = require('./handlers/initialization.js');
var shareHandlers = require('./handlers/sharing.js');
var customHandlers = require('./handlers/custom.js');
var cryptoProviderHandlers = require('./handlers/crypto_provider.js');

/**
 * Contains handlers for communication events
 * @name handlers
 * @alias handlers
 * @namespace
 */

// Add handlers implementations
module.exports = function (jiffClient) {
  // fill in handlers
  initializationHandlers(jiffClient);
  shareHandlers(jiffClient);
  customHandlers(jiffClient);
  cryptoProviderHandlers(jiffClient);
};

},{"./handlers/crypto_provider.js":2,"./handlers/custom.js":3,"./handlers/initialization.js":4,"./handlers/sharing.js":5}],2:[function(require,module,exports){
// setup handler for receiving messages from the crypto provider
module.exports = function (jiffClient) {
  /**
   * Parse crypto provider message and resolve associated promise.
   * @method
   * @memberof handlers
   * @param {object} json_msg - the parsed json message as received by the crypto_provider event, contains 'values' and 'shares' attributes.
   */
  jiffClient.handlers.receive_crypto_provider = function (json_msg) {
    // Hook
    json_msg = jiffClient.hooks.execute_array_hooks('afterOperation', [jiffClient, 'crypto_provider', json_msg], 2);

    var op_id = json_msg['op_id'];
    if (jiffClient.deferreds[op_id] == null) {
      return; // duplicate message: ignore
    }

    // parse msg
    var receivers_list = json_msg['receivers'];
    var threshold = json_msg['threshold'];
    var Zp = json_msg['Zp'];

    // construct secret share objects
    var result = {};
    if (json_msg['values'] != null) {
      result.values = json_msg['values'];
    }
    if (json_msg['shares'] != null) {
      result.shares = [];
      for (var i = 0; i < json_msg['shares'].length; i++) {
        result.shares.push(new jiffClient.SecretShare(json_msg['shares'][i], receivers_list, threshold, Zp));
      }
    }

    // resolve deferred
    jiffClient.deferreds[op_id].resolve(result);
    delete jiffClient.deferreds[op_id];
  };
};

},{}],3:[function(require,module,exports){
module.exports = function (jiffClient) {
  /**
   * Called when this party receives a custom tag message from any party (including itself).
   * If a custom listener was setup to listen to the tag, the message is passed to the listener.
   * Otherwise, the message is stored until such a listener is provided.
   * @method
   * @memberof handlers
   * @param {object} json_msg - the parsed json message as received by the custom event.
   */
  jiffClient.handlers.receive_custom = function (json_msg) {
    if (json_msg['party_id'] !== jiffClient.id) {
      if (json_msg['encrypted'] === true) {
        json_msg['message'] = jiffClient.hooks.decryptSign(jiffClient, json_msg['message'], jiffClient.secret_key, jiffClient.keymap[json_msg['party_id']]);
      }

      json_msg = jiffClient.hooks.execute_array_hooks('afterOperation', [jiffClient, 'custom', json_msg], 2);
    }

    var sender_id = json_msg['party_id'];
    var tag = json_msg['tag'];
    var message = json_msg['message'];

    if (jiffClient.listeners[tag] != null) {
      jiffClient.listeners[tag](sender_id, message);
    } else {
      // Store message until listener is provided
      var stored_messages = jiffClient.custom_messages_mailbox[tag];
      if (stored_messages == null) {
        stored_messages = [];
        jiffClient.custom_messages_mailbox[tag] = stored_messages;
      }

      stored_messages.push({ sender_id: sender_id, message: message });
    }
  };
};

},{}],4:[function(require,module,exports){
// add handlers for initialization
module.exports = function (jiffClient) {
  jiffClient.options.initialization = Object.assign({}, jiffClient.options.initialization);

  /**
   * Called when an error occurs
   * @method
   * @memberof handlers
   * @param {string} label - the name of message or operation causing the error
   * @param {error|string} error - the error
   */
  jiffClient.handlers.error = function (label, error) {
    if (jiffClient.options.onError) {
      jiffClient.options.onError(label, error);
    }

    console.log(jiffClient.id, ':', 'Error from server:', label, '---', error); // TODO: remove debugging
    if (label === 'initialization') {
      jiffClient.socket.disconnect();

      if (jiffClient.initialization_counter < jiffClient.options.maxInitializationRetries) {
        console.log(jiffClient.id, ':', 'reconnecting..'); // TODO: remove debugging
        setTimeout(jiffClient.connect, jiffClient.options.socketOptions.reconnectionDelay);
      }
    }
  };

  /**
   * Builds the initialization message for this instance
   * @method
   * @memberof handlers
   * @return {Object}
   */
  jiffClient.handlers.build_initialization_message = function () {
    var msg = {
      computation_id: jiffClient.computation_id,
      party_id: jiffClient.id,
      party_count: jiffClient.party_count,
      public_key: jiffClient.public_key != null ? jiffClient.hooks.dumpKey(jiffClient, jiffClient.public_key) : undefined
    };
    msg = Object.assign(msg, jiffClient.options.initialization);

    // Initialization Hook
    return jiffClient.hooks.execute_array_hooks('beforeOperation', [jiffClient, 'initialization', msg], 2);
  };

  /**
   * Begins initialization of this instance by sending the initialization message to the server.
   * Should only be called after connection is established.
   * Do not call this manually unless you know what you are doing, use <jiff_instance>.connect() instead!
   * @method
   * @memberof handlers
   */
  jiffClient.handlers.connected = function () {
    console.log('Connected!', jiffClient.id); // TODO: remove debugging
    jiffClient.initialization_counter++;

    if (jiffClient.secret_key == null && jiffClient.public_key == null) {
      var key = jiffClient.hooks.generateKeyPair(jiffClient);
      jiffClient.secret_key = key.secret_key;
      jiffClient.public_key = key.public_key;
    }

    // Initialization message
    var msg = jiffClient.handlers.build_initialization_message();

    // Emit initialization message to server
    jiffClient.socket.emit('initialization', JSON.stringify(msg));
  };

  /**
   * Called after the server approves initialization of this instance.
   * Sets the instance id, the count of parties in the computation, and the public keys
   * of initialized parties.
   * @method
   * @memberof handlers
   */
  jiffClient.handlers.initialized = function (msg) {
    jiffClient.__initialized = true;
    jiffClient.initialization_counter = 0;

    msg = JSON.parse(msg);
    msg = jiffClient.hooks.execute_array_hooks('afterOperation', [jiffClient, 'initialization', msg], 2);

    jiffClient.id = msg.party_id;
    jiffClient.party_count = msg.party_count;

    // Now: (1) this party is connect (2) server (and other parties) know this public key
    // Resend all pending messages
    jiffClient.socket.resend_mailbox();

    // store the received public keys and resolve wait callbacks
    jiffClient.handlers.store_public_keys(msg.public_keys);
  };

  /**
   * Parse and store the given public keys
   * @method
   * @memberof handlers
   * @param {object} keymap - maps party id to serialized public key.
   */
  jiffClient.handlers.store_public_keys = function (keymap) {
    var i;
    for (i in keymap) {
      if (keymap.hasOwnProperty(i) && jiffClient.keymap[i] == null) {
        jiffClient.keymap[i] = jiffClient.hooks.parseKey(jiffClient, keymap[i]);
      }
    }

    // Resolve any pending messages that were received before the sender's public key was known
    jiffClient.resolve_messages_waiting_for_keys();

    // Resolve any pending waits that have satisfied conditions
    jiffClient.execute_wait_callbacks();

    // Check if all keys have been received
    if (jiffClient.keymap['s1'] == null) {
      return;
    }
    for (i = 1; i <= jiffClient.party_count; i++) {
      if (jiffClient.keymap[i] == null) {
        return;
      }
    }

    // all parties are connected; execute callback
    if (jiffClient.__ready !== true && jiffClient.__initialized) {
      jiffClient.__ready = true;
      if (jiffClient.options.onConnect != null) {
        jiffClient.options.onConnect(jiffClient);
      }
    }
  };
};

},{}],5:[function(require,module,exports){
// adds sharing related handlers
module.exports = function (jiffClient) {
  /**
   * Store the received share and resolves the corresponding
   * deferred if needed.
   * @method
   * @memberof handlers
   * @param {object} json_msg - the parsed json message as received.
   */
  jiffClient.handlers.receive_share = function (json_msg) {
    // Decrypt share
    json_msg['share'] = jiffClient.hooks.decryptSign(jiffClient, json_msg['share'], jiffClient.secret_key, jiffClient.keymap[json_msg['party_id']]);
    json_msg = jiffClient.hooks.execute_array_hooks('afterOperation', [jiffClient, 'share', json_msg], 2);

    var sender_id = json_msg['party_id'];
    var op_id = json_msg['op_id'];
    var share = json_msg['share'];

    // Call hook
    share = jiffClient.hooks.execute_array_hooks('receiveShare', [jiffClient, sender_id, share], 2);

    // check if a deferred is set up (maybe the share was received early)
    if (jiffClient.deferreds[op_id] == null) {
      jiffClient.deferreds[op_id] = {};
    }
    if (jiffClient.deferreds[op_id][sender_id] == null) {
      // Share is received before deferred was setup, store it.
      jiffClient.deferreds[op_id][sender_id] = new jiffClient.helpers.Deferred();
    }

    // Deferred is already setup, resolve it.
    jiffClient.deferreds[op_id][sender_id].resolve(share);
  };

  /**
   * Resolves the deferred corresponding to operation_id and sender_id.
   * @method
   * @memberof handlers
   * @param {object} json_msg - the json message as received with the open event.
   */
  jiffClient.handlers.receive_open = function (json_msg) {
    // Decrypt share
    if (json_msg['party_id'] !== jiffClient.id) {
      json_msg['share'] = jiffClient.hooks.decryptSign(jiffClient, json_msg['share'], jiffClient.secret_key, jiffClient.keymap[json_msg['party_id']]);
      json_msg = jiffClient.hooks.execute_array_hooks('afterOperation', [jiffClient, 'open', json_msg], 2);
    }

    var sender_id = json_msg['party_id'];
    var op_id = json_msg['op_id'];
    var share = json_msg['share'];
    var Zp = json_msg['Zp'];

    // call hook
    share = jiffClient.hooks.execute_array_hooks('receiveOpen', [jiffClient, sender_id, share, Zp], 2);

    // Ensure deferred is setup
    if (jiffClient.deferreds[op_id] == null) {
      jiffClient.deferreds[op_id] = {};
    }
    if (jiffClient.deferreds[op_id].shares == null) {
      jiffClient.deferreds[op_id].shares = [];
    }

    // Accumulate received shares
    jiffClient.deferreds[op_id].shares.push({ value: share, sender_id: sender_id, Zp: Zp });

    // Resolve when ready
    if (jiffClient.deferreds[op_id].shares.length === jiffClient.deferreds[op_id].threshold) {
      jiffClient.deferreds[op_id].deferred.resolve();
    }

    // Clean up if done
    if (jiffClient.deferreds[op_id] != null && jiffClient.deferreds[op_id].deferred === 'CLEAN' && jiffClient.deferreds[op_id].shares.length === jiffClient.deferreds[op_id].total) {
      delete jiffClient.deferreds[op_id];
    }
  };
};

},{}],6:[function(require,module,exports){
/** Doubly linked list with add and remove functions and pointers to head and tail**/
module.exports = function () {
  // attributes: list.head and list.tail
  // functions: list.add(object) (returns pointer), list.remove(pointer)
  // list.head/list.tail/any element contains:
  //    next: pointer to next,
  //    previous: pointer to previous,
  //    object: stored object.
  var list = { head: null, tail: null };
  // TODO rename this to pushTail || push
  list.add = function (obj) {
    var node = { object: obj, next: null, previous: null };
    if (list.head == null) {
      list.head = node;
      list.tail = node;
    } else {
      list.tail.next = node;
      node.previous = list.tail;
      list.tail = node;
    }
    return node;
  };

  list.pushHead = function (obj) {
    list.head = { object: obj, next: list.head, previous: null };
    if (list.head.next != null) {
      list.head.next.previous = list.head;
    } else {
      list.tail = list.head;
    }
  };

  list.popHead = function () {
    var result = list.head;
    if (list.head != null) {
      list.head = list.head.next;
      if (list.head == null) {
        list.tail = null;
      } else {
        list.head.previous = null;
      }
    }
    return result;
  };

  // merges two linked lists and return a pointer to the head of the merged list
  // the head will be the head of list and the tail the tail of l2
  list.extend = function (l2) {
    if (list.head == null) {
      return l2;
    }
    if (l2.head == null) {
      return list;
    }
    list.tail.next = l2.head;
    l2.head.previous = list.tail;
    list.tail = l2.tail;

    return list;
  };

  list.remove = function (ptr) {
    var prev = ptr.previous;
    var next = ptr.next;

    if (prev == null && list.head !== ptr) {
      return;
    } else if (next == null && list.tail !== ptr) {
      return;
    }

    if (prev == null) {
      // ptr is head (or both head and tail)
      list.head = next;
      if (list.head != null) {
        list.head.previous = null;
      } else {
        list.tail = null;
      }
    } else if (next == null) {
      // ptr is tail (and not head)
      list.tail = prev;
      prev.next = null;
    } else {
      // ptr is inside
      prev.next = next;
      next.previous = prev;
    }
  };
  list.slice = function (ptr) {
    // remove all elements from head to ptr (including ptr).
    if (ptr == null) {
      return;
    }

    /* CONSERVATIVE: make sure ptr is part of the list then remove */
    var current = list.head;
    while (current != null) {
      if (current === ptr) {
        list.head = ptr.next;
        if (list.head == null) {
          list.tail = null;
        }

        return;
      }
      current = current.next;
    }

    /* MORE AGGRESSIVE VERSION: will be incorrect if ptr is not in the list */
    /*
    list.head = ptr.next;
    if (list.head == null) {
      list.tail = null;
    }
    */
  };
  /*
  list._debug_length = function () {
    var l = 0;
    var current = list.head;
    while (current != null) {
      current = current.next;
      l++;
    }
    return l;
  };
  */
  return list;
};

},{}],7:[function(require,module,exports){
(function (process,global){(function (){
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
      ws = WebSocket;
    } else if (typeof MozWebSocket !== 'undefined') {
      ws = MozWebSocket;
    } else if (typeof global !== 'undefined') {
      ws = global.WebSocket || global.MozWebSocket;
    } else if (typeof window !== 'undefined') {
      ws = window.WebSocket || window.MozWebSocket;
    } else if (typeof self !== 'undefined') {
      ws = self.WebSocket || self.MozWebSocket;
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
      };

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
      };
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
    };

    /* Functions that overwrite client/socket/mailbox.js functionality */

    function guardedSocket(jiffClient) {
      // Create plain socket io object which we will wrap in this
      var socket;
      if (jiffClient.hostname.startsWith('http')) {
        var modifiedHostName = 'ws' + jiffClient.hostname.substring(jiffClient.hostname.indexOf(':'));
        socket = new ws(modifiedHostName);
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
})(typeof exports === 'undefined' ? (this.jiff_websockets = {}) : exports, typeof exports !== 'undefined');

}).call(this)}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"../client/handlers.js":1,"../common/linkedlist.js":6,"_process":8,"ws":9}],8:[function(require,module,exports){
// shim for using process in browser
var process = module.exports = {};

// cached from whatever global is present so that test runners that stub it
// don't break things.  But we need to wrap it in a try catch in case it is
// wrapped in strict mode code which doesn't define any globals.  It's inside a
// function because try/catches deoptimize in certain engines.

var cachedSetTimeout;
var cachedClearTimeout;

function defaultSetTimout() {
    throw new Error('setTimeout has not been defined');
}
function defaultClearTimeout () {
    throw new Error('clearTimeout has not been defined');
}
(function () {
    try {
        if (typeof setTimeout === 'function') {
            cachedSetTimeout = setTimeout;
        } else {
            cachedSetTimeout = defaultSetTimout;
        }
    } catch (e) {
        cachedSetTimeout = defaultSetTimout;
    }
    try {
        if (typeof clearTimeout === 'function') {
            cachedClearTimeout = clearTimeout;
        } else {
            cachedClearTimeout = defaultClearTimeout;
        }
    } catch (e) {
        cachedClearTimeout = defaultClearTimeout;
    }
} ())
function runTimeout(fun) {
    if (cachedSetTimeout === setTimeout) {
        //normal enviroments in sane situations
        return setTimeout(fun, 0);
    }
    // if setTimeout wasn't available but was latter defined
    if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
        cachedSetTimeout = setTimeout;
        return setTimeout(fun, 0);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedSetTimeout(fun, 0);
    } catch(e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
            return cachedSetTimeout.call(null, fun, 0);
        } catch(e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
            return cachedSetTimeout.call(this, fun, 0);
        }
    }


}
function runClearTimeout(marker) {
    if (cachedClearTimeout === clearTimeout) {
        //normal enviroments in sane situations
        return clearTimeout(marker);
    }
    // if clearTimeout wasn't available but was latter defined
    if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
        cachedClearTimeout = clearTimeout;
        return clearTimeout(marker);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedClearTimeout(marker);
    } catch (e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
            return cachedClearTimeout.call(null, marker);
        } catch (e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
            // Some versions of I.E. have different rules for clearTimeout vs setTimeout
            return cachedClearTimeout.call(this, marker);
        }
    }



}
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = runTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    runClearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        runTimeout(drainQueue);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;
process.prependListener = noop;
process.prependOnceListener = noop;

process.listeners = function (name) { return [] }

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],9:[function(require,module,exports){
'use strict';

module.exports = function () {
  throw new Error(
    'ws does not work in the browser. Browser clients must use the native ' +
      'WebSocket object'
  );
};

},{}]},{},[7])(7)
});

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJsaWIvY2xpZW50L2hhbmRsZXJzLmpzIiwibGliL2NsaWVudC9oYW5kbGVycy9jcnlwdG9fcHJvdmlkZXIuanMiLCJsaWIvY2xpZW50L2hhbmRsZXJzL2N1c3RvbS5qcyIsImxpYi9jbGllbnQvaGFuZGxlcnMvaW5pdGlhbGl6YXRpb24uanMiLCJsaWIvY2xpZW50L2hhbmRsZXJzL3NoYXJpbmcuanMiLCJsaWIvY29tbW9uL2xpbmtlZGxpc3QuanMiLCJsaWIvZXh0L2ppZmYtY2xpZW50LXdlYnNvY2tldHMuanMiLCJub2RlX21vZHVsZXMvcHJvY2Vzcy9icm93c2VyLmpzIiwibm9kZV9tb2R1bGVzL3dzL2Jyb3dzZXIuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RJQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN0VBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQ2xJQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDM1VBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeExBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uKCl7ZnVuY3Rpb24gcihlLG4sdCl7ZnVuY3Rpb24gbyhpLGYpe2lmKCFuW2ldKXtpZighZVtpXSl7dmFyIGM9XCJmdW5jdGlvblwiPT10eXBlb2YgcmVxdWlyZSYmcmVxdWlyZTtpZighZiYmYylyZXR1cm4gYyhpLCEwKTtpZih1KXJldHVybiB1KGksITApO3ZhciBhPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIraStcIidcIik7dGhyb3cgYS5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGF9dmFyIHA9bltpXT17ZXhwb3J0czp7fX07ZVtpXVswXS5jYWxsKHAuZXhwb3J0cyxmdW5jdGlvbihyKXt2YXIgbj1lW2ldWzFdW3JdO3JldHVybiBvKG58fHIpfSxwLHAuZXhwb3J0cyxyLGUsbix0KX1yZXR1cm4gbltpXS5leHBvcnRzfWZvcih2YXIgdT1cImZ1bmN0aW9uXCI9PXR5cGVvZiByZXF1aXJlJiZyZXF1aXJlLGk9MDtpPHQubGVuZ3RoO2krKylvKHRbaV0pO3JldHVybiBvfXJldHVybiByfSkoKSIsInZhciBpbml0aWFsaXphdGlvbkhhbmRsZXJzID0gcmVxdWlyZSgnLi9oYW5kbGVycy9pbml0aWFsaXphdGlvbi5qcycpO1xudmFyIHNoYXJlSGFuZGxlcnMgPSByZXF1aXJlKCcuL2hhbmRsZXJzL3NoYXJpbmcuanMnKTtcbnZhciBjdXN0b21IYW5kbGVycyA9IHJlcXVpcmUoJy4vaGFuZGxlcnMvY3VzdG9tLmpzJyk7XG52YXIgY3J5cHRvUHJvdmlkZXJIYW5kbGVycyA9IHJlcXVpcmUoJy4vaGFuZGxlcnMvY3J5cHRvX3Byb3ZpZGVyLmpzJyk7XG5cbi8qKlxuICogQ29udGFpbnMgaGFuZGxlcnMgZm9yIGNvbW11bmljYXRpb24gZXZlbnRzXG4gKiBAbmFtZSBoYW5kbGVyc1xuICogQGFsaWFzIGhhbmRsZXJzXG4gKiBAbmFtZXNwYWNlXG4gKi9cblxuLy8gQWRkIGhhbmRsZXJzIGltcGxlbWVudGF0aW9uc1xubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAoamlmZkNsaWVudCkge1xuICAvLyBmaWxsIGluIGhhbmRsZXJzXG4gIGluaXRpYWxpemF0aW9uSGFuZGxlcnMoamlmZkNsaWVudCk7XG4gIHNoYXJlSGFuZGxlcnMoamlmZkNsaWVudCk7XG4gIGN1c3RvbUhhbmRsZXJzKGppZmZDbGllbnQpO1xuICBjcnlwdG9Qcm92aWRlckhhbmRsZXJzKGppZmZDbGllbnQpO1xufTtcbiIsIi8vIHNldHVwIGhhbmRsZXIgZm9yIHJlY2VpdmluZyBtZXNzYWdlcyBmcm9tIHRoZSBjcnlwdG8gcHJvdmlkZXJcbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKGppZmZDbGllbnQpIHtcbiAgLyoqXG4gICAqIFBhcnNlIGNyeXB0byBwcm92aWRlciBtZXNzYWdlIGFuZCByZXNvbHZlIGFzc29jaWF0ZWQgcHJvbWlzZS5cbiAgICogQG1ldGhvZFxuICAgKiBAbWVtYmVyb2YgaGFuZGxlcnNcbiAgICogQHBhcmFtIHtvYmplY3R9IGpzb25fbXNnIC0gdGhlIHBhcnNlZCBqc29uIG1lc3NhZ2UgYXMgcmVjZWl2ZWQgYnkgdGhlIGNyeXB0b19wcm92aWRlciBldmVudCwgY29udGFpbnMgJ3ZhbHVlcycgYW5kICdzaGFyZXMnIGF0dHJpYnV0ZXMuXG4gICAqL1xuICBqaWZmQ2xpZW50LmhhbmRsZXJzLnJlY2VpdmVfY3J5cHRvX3Byb3ZpZGVyID0gZnVuY3Rpb24gKGpzb25fbXNnKSB7XG4gICAgLy8gSG9va1xuICAgIGpzb25fbXNnID0gamlmZkNsaWVudC5ob29rcy5leGVjdXRlX2FycmF5X2hvb2tzKCdhZnRlck9wZXJhdGlvbicsIFtqaWZmQ2xpZW50LCAnY3J5cHRvX3Byb3ZpZGVyJywganNvbl9tc2ddLCAyKTtcblxuICAgIHZhciBvcF9pZCA9IGpzb25fbXNnWydvcF9pZCddO1xuICAgIGlmIChqaWZmQ2xpZW50LmRlZmVycmVkc1tvcF9pZF0gPT0gbnVsbCkge1xuICAgICAgcmV0dXJuOyAvLyBkdXBsaWNhdGUgbWVzc2FnZTogaWdub3JlXG4gICAgfVxuXG4gICAgLy8gcGFyc2UgbXNnXG4gICAgdmFyIHJlY2VpdmVyc19saXN0ID0ganNvbl9tc2dbJ3JlY2VpdmVycyddO1xuICAgIHZhciB0aHJlc2hvbGQgPSBqc29uX21zZ1sndGhyZXNob2xkJ107XG4gICAgdmFyIFpwID0ganNvbl9tc2dbJ1pwJ107XG5cbiAgICAvLyBjb25zdHJ1Y3Qgc2VjcmV0IHNoYXJlIG9iamVjdHNcbiAgICB2YXIgcmVzdWx0ID0ge307XG4gICAgaWYgKGpzb25fbXNnWyd2YWx1ZXMnXSAhPSBudWxsKSB7XG4gICAgICByZXN1bHQudmFsdWVzID0ganNvbl9tc2dbJ3ZhbHVlcyddO1xuICAgIH1cbiAgICBpZiAoanNvbl9tc2dbJ3NoYXJlcyddICE9IG51bGwpIHtcbiAgICAgIHJlc3VsdC5zaGFyZXMgPSBbXTtcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwganNvbl9tc2dbJ3NoYXJlcyddLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHJlc3VsdC5zaGFyZXMucHVzaChuZXcgamlmZkNsaWVudC5TZWNyZXRTaGFyZShqc29uX21zZ1snc2hhcmVzJ11baV0sIHJlY2VpdmVyc19saXN0LCB0aHJlc2hvbGQsIFpwKSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gcmVzb2x2ZSBkZWZlcnJlZFxuICAgIGppZmZDbGllbnQuZGVmZXJyZWRzW29wX2lkXS5yZXNvbHZlKHJlc3VsdCk7XG4gICAgZGVsZXRlIGppZmZDbGllbnQuZGVmZXJyZWRzW29wX2lkXTtcbiAgfTtcbn07XG4iLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChqaWZmQ2xpZW50KSB7XG4gIC8qKlxuICAgKiBDYWxsZWQgd2hlbiB0aGlzIHBhcnR5IHJlY2VpdmVzIGEgY3VzdG9tIHRhZyBtZXNzYWdlIGZyb20gYW55IHBhcnR5IChpbmNsdWRpbmcgaXRzZWxmKS5cbiAgICogSWYgYSBjdXN0b20gbGlzdGVuZXIgd2FzIHNldHVwIHRvIGxpc3RlbiB0byB0aGUgdGFnLCB0aGUgbWVzc2FnZSBpcyBwYXNzZWQgdG8gdGhlIGxpc3RlbmVyLlxuICAgKiBPdGhlcndpc2UsIHRoZSBtZXNzYWdlIGlzIHN0b3JlZCB1bnRpbCBzdWNoIGEgbGlzdGVuZXIgaXMgcHJvdmlkZWQuXG4gICAqIEBtZXRob2RcbiAgICogQG1lbWJlcm9mIGhhbmRsZXJzXG4gICAqIEBwYXJhbSB7b2JqZWN0fSBqc29uX21zZyAtIHRoZSBwYXJzZWQganNvbiBtZXNzYWdlIGFzIHJlY2VpdmVkIGJ5IHRoZSBjdXN0b20gZXZlbnQuXG4gICAqL1xuICBqaWZmQ2xpZW50LmhhbmRsZXJzLnJlY2VpdmVfY3VzdG9tID0gZnVuY3Rpb24gKGpzb25fbXNnKSB7XG4gICAgaWYgKGpzb25fbXNnWydwYXJ0eV9pZCddICE9PSBqaWZmQ2xpZW50LmlkKSB7XG4gICAgICBpZiAoanNvbl9tc2dbJ2VuY3J5cHRlZCddID09PSB0cnVlKSB7XG4gICAgICAgIGpzb25fbXNnWydtZXNzYWdlJ10gPSBqaWZmQ2xpZW50Lmhvb2tzLmRlY3J5cHRTaWduKGppZmZDbGllbnQsIGpzb25fbXNnWydtZXNzYWdlJ10sIGppZmZDbGllbnQuc2VjcmV0X2tleSwgamlmZkNsaWVudC5rZXltYXBbanNvbl9tc2dbJ3BhcnR5X2lkJ11dKTtcbiAgICAgIH1cblxuICAgICAganNvbl9tc2cgPSBqaWZmQ2xpZW50Lmhvb2tzLmV4ZWN1dGVfYXJyYXlfaG9va3MoJ2FmdGVyT3BlcmF0aW9uJywgW2ppZmZDbGllbnQsICdjdXN0b20nLCBqc29uX21zZ10sIDIpO1xuICAgIH1cblxuICAgIHZhciBzZW5kZXJfaWQgPSBqc29uX21zZ1sncGFydHlfaWQnXTtcbiAgICB2YXIgdGFnID0ganNvbl9tc2dbJ3RhZyddO1xuICAgIHZhciBtZXNzYWdlID0ganNvbl9tc2dbJ21lc3NhZ2UnXTtcblxuICAgIGlmIChqaWZmQ2xpZW50Lmxpc3RlbmVyc1t0YWddICE9IG51bGwpIHtcbiAgICAgIGppZmZDbGllbnQubGlzdGVuZXJzW3RhZ10oc2VuZGVyX2lkLCBtZXNzYWdlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gU3RvcmUgbWVzc2FnZSB1bnRpbCBsaXN0ZW5lciBpcyBwcm92aWRlZFxuICAgICAgdmFyIHN0b3JlZF9tZXNzYWdlcyA9IGppZmZDbGllbnQuY3VzdG9tX21lc3NhZ2VzX21haWxib3hbdGFnXTtcbiAgICAgIGlmIChzdG9yZWRfbWVzc2FnZXMgPT0gbnVsbCkge1xuICAgICAgICBzdG9yZWRfbWVzc2FnZXMgPSBbXTtcbiAgICAgICAgamlmZkNsaWVudC5jdXN0b21fbWVzc2FnZXNfbWFpbGJveFt0YWddID0gc3RvcmVkX21lc3NhZ2VzO1xuICAgICAgfVxuXG4gICAgICBzdG9yZWRfbWVzc2FnZXMucHVzaCh7IHNlbmRlcl9pZDogc2VuZGVyX2lkLCBtZXNzYWdlOiBtZXNzYWdlIH0pO1xuICAgIH1cbiAgfTtcbn07XG4iLCIvLyBhZGQgaGFuZGxlcnMgZm9yIGluaXRpYWxpemF0aW9uXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChqaWZmQ2xpZW50KSB7XG4gIGppZmZDbGllbnQub3B0aW9ucy5pbml0aWFsaXphdGlvbiA9IE9iamVjdC5hc3NpZ24oe30sIGppZmZDbGllbnQub3B0aW9ucy5pbml0aWFsaXphdGlvbik7XG5cbiAgLyoqXG4gICAqIENhbGxlZCB3aGVuIGFuIGVycm9yIG9jY3Vyc1xuICAgKiBAbWV0aG9kXG4gICAqIEBtZW1iZXJvZiBoYW5kbGVyc1xuICAgKiBAcGFyYW0ge3N0cmluZ30gbGFiZWwgLSB0aGUgbmFtZSBvZiBtZXNzYWdlIG9yIG9wZXJhdGlvbiBjYXVzaW5nIHRoZSBlcnJvclxuICAgKiBAcGFyYW0ge2Vycm9yfHN0cmluZ30gZXJyb3IgLSB0aGUgZXJyb3JcbiAgICovXG4gIGppZmZDbGllbnQuaGFuZGxlcnMuZXJyb3IgPSBmdW5jdGlvbiAobGFiZWwsIGVycm9yKSB7XG4gICAgaWYgKGppZmZDbGllbnQub3B0aW9ucy5vbkVycm9yKSB7XG4gICAgICBqaWZmQ2xpZW50Lm9wdGlvbnMub25FcnJvcihsYWJlbCwgZXJyb3IpO1xuICAgIH1cblxuICAgIGNvbnNvbGUubG9nKGppZmZDbGllbnQuaWQsICc6JywgJ0Vycm9yIGZyb20gc2VydmVyOicsIGxhYmVsLCAnLS0tJywgZXJyb3IpOyAvLyBUT0RPOiByZW1vdmUgZGVidWdnaW5nXG4gICAgaWYgKGxhYmVsID09PSAnaW5pdGlhbGl6YXRpb24nKSB7XG4gICAgICBqaWZmQ2xpZW50LnNvY2tldC5kaXNjb25uZWN0KCk7XG5cbiAgICAgIGlmIChqaWZmQ2xpZW50LmluaXRpYWxpemF0aW9uX2NvdW50ZXIgPCBqaWZmQ2xpZW50Lm9wdGlvbnMubWF4SW5pdGlhbGl6YXRpb25SZXRyaWVzKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGppZmZDbGllbnQuaWQsICc6JywgJ3JlY29ubmVjdGluZy4uJyk7IC8vIFRPRE86IHJlbW92ZSBkZWJ1Z2dpbmdcbiAgICAgICAgc2V0VGltZW91dChqaWZmQ2xpZW50LmNvbm5lY3QsIGppZmZDbGllbnQub3B0aW9ucy5zb2NrZXRPcHRpb25zLnJlY29ubmVjdGlvbkRlbGF5KTtcbiAgICAgIH1cbiAgICB9XG4gIH07XG5cbiAgLyoqXG4gICAqIEJ1aWxkcyB0aGUgaW5pdGlhbGl6YXRpb24gbWVzc2FnZSBmb3IgdGhpcyBpbnN0YW5jZVxuICAgKiBAbWV0aG9kXG4gICAqIEBtZW1iZXJvZiBoYW5kbGVyc1xuICAgKiBAcmV0dXJuIHtPYmplY3R9XG4gICAqL1xuICBqaWZmQ2xpZW50LmhhbmRsZXJzLmJ1aWxkX2luaXRpYWxpemF0aW9uX21lc3NhZ2UgPSBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIG1zZyA9IHtcbiAgICAgIGNvbXB1dGF0aW9uX2lkOiBqaWZmQ2xpZW50LmNvbXB1dGF0aW9uX2lkLFxuICAgICAgcGFydHlfaWQ6IGppZmZDbGllbnQuaWQsXG4gICAgICBwYXJ0eV9jb3VudDogamlmZkNsaWVudC5wYXJ0eV9jb3VudCxcbiAgICAgIHB1YmxpY19rZXk6IGppZmZDbGllbnQucHVibGljX2tleSAhPSBudWxsID8gamlmZkNsaWVudC5ob29rcy5kdW1wS2V5KGppZmZDbGllbnQsIGppZmZDbGllbnQucHVibGljX2tleSkgOiB1bmRlZmluZWRcbiAgICB9O1xuICAgIG1zZyA9IE9iamVjdC5hc3NpZ24obXNnLCBqaWZmQ2xpZW50Lm9wdGlvbnMuaW5pdGlhbGl6YXRpb24pO1xuXG4gICAgLy8gSW5pdGlhbGl6YXRpb24gSG9va1xuICAgIHJldHVybiBqaWZmQ2xpZW50Lmhvb2tzLmV4ZWN1dGVfYXJyYXlfaG9va3MoJ2JlZm9yZU9wZXJhdGlvbicsIFtqaWZmQ2xpZW50LCAnaW5pdGlhbGl6YXRpb24nLCBtc2ddLCAyKTtcbiAgfTtcblxuICAvKipcbiAgICogQmVnaW5zIGluaXRpYWxpemF0aW9uIG9mIHRoaXMgaW5zdGFuY2UgYnkgc2VuZGluZyB0aGUgaW5pdGlhbGl6YXRpb24gbWVzc2FnZSB0byB0aGUgc2VydmVyLlxuICAgKiBTaG91bGQgb25seSBiZSBjYWxsZWQgYWZ0ZXIgY29ubmVjdGlvbiBpcyBlc3RhYmxpc2hlZC5cbiAgICogRG8gbm90IGNhbGwgdGhpcyBtYW51YWxseSB1bmxlc3MgeW91IGtub3cgd2hhdCB5b3UgYXJlIGRvaW5nLCB1c2UgPGppZmZfaW5zdGFuY2U+LmNvbm5lY3QoKSBpbnN0ZWFkIVxuICAgKiBAbWV0aG9kXG4gICAqIEBtZW1iZXJvZiBoYW5kbGVyc1xuICAgKi9cbiAgamlmZkNsaWVudC5oYW5kbGVycy5jb25uZWN0ZWQgPSBmdW5jdGlvbiAoKSB7XG4gICAgY29uc29sZS5sb2coJ0Nvbm5lY3RlZCEnLCBqaWZmQ2xpZW50LmlkKTsgLy8gVE9ETzogcmVtb3ZlIGRlYnVnZ2luZ1xuICAgIGppZmZDbGllbnQuaW5pdGlhbGl6YXRpb25fY291bnRlcisrO1xuXG4gICAgaWYgKGppZmZDbGllbnQuc2VjcmV0X2tleSA9PSBudWxsICYmIGppZmZDbGllbnQucHVibGljX2tleSA9PSBudWxsKSB7XG4gICAgICB2YXIga2V5ID0gamlmZkNsaWVudC5ob29rcy5nZW5lcmF0ZUtleVBhaXIoamlmZkNsaWVudCk7XG4gICAgICBqaWZmQ2xpZW50LnNlY3JldF9rZXkgPSBrZXkuc2VjcmV0X2tleTtcbiAgICAgIGppZmZDbGllbnQucHVibGljX2tleSA9IGtleS5wdWJsaWNfa2V5O1xuICAgIH1cblxuICAgIC8vIEluaXRpYWxpemF0aW9uIG1lc3NhZ2VcbiAgICB2YXIgbXNnID0gamlmZkNsaWVudC5oYW5kbGVycy5idWlsZF9pbml0aWFsaXphdGlvbl9tZXNzYWdlKCk7XG5cbiAgICAvLyBFbWl0IGluaXRpYWxpemF0aW9uIG1lc3NhZ2UgdG8gc2VydmVyXG4gICAgamlmZkNsaWVudC5zb2NrZXQuZW1pdCgnaW5pdGlhbGl6YXRpb24nLCBKU09OLnN0cmluZ2lmeShtc2cpKTtcbiAgfTtcblxuICAvKipcbiAgICogQ2FsbGVkIGFmdGVyIHRoZSBzZXJ2ZXIgYXBwcm92ZXMgaW5pdGlhbGl6YXRpb24gb2YgdGhpcyBpbnN0YW5jZS5cbiAgICogU2V0cyB0aGUgaW5zdGFuY2UgaWQsIHRoZSBjb3VudCBvZiBwYXJ0aWVzIGluIHRoZSBjb21wdXRhdGlvbiwgYW5kIHRoZSBwdWJsaWMga2V5c1xuICAgKiBvZiBpbml0aWFsaXplZCBwYXJ0aWVzLlxuICAgKiBAbWV0aG9kXG4gICAqIEBtZW1iZXJvZiBoYW5kbGVyc1xuICAgKi9cbiAgamlmZkNsaWVudC5oYW5kbGVycy5pbml0aWFsaXplZCA9IGZ1bmN0aW9uIChtc2cpIHtcbiAgICBqaWZmQ2xpZW50Ll9faW5pdGlhbGl6ZWQgPSB0cnVlO1xuICAgIGppZmZDbGllbnQuaW5pdGlhbGl6YXRpb25fY291bnRlciA9IDA7XG5cbiAgICBtc2cgPSBKU09OLnBhcnNlKG1zZyk7XG4gICAgbXNnID0gamlmZkNsaWVudC5ob29rcy5leGVjdXRlX2FycmF5X2hvb2tzKCdhZnRlck9wZXJhdGlvbicsIFtqaWZmQ2xpZW50LCAnaW5pdGlhbGl6YXRpb24nLCBtc2ddLCAyKTtcblxuICAgIGppZmZDbGllbnQuaWQgPSBtc2cucGFydHlfaWQ7XG4gICAgamlmZkNsaWVudC5wYXJ0eV9jb3VudCA9IG1zZy5wYXJ0eV9jb3VudDtcblxuICAgIC8vIE5vdzogKDEpIHRoaXMgcGFydHkgaXMgY29ubmVjdCAoMikgc2VydmVyIChhbmQgb3RoZXIgcGFydGllcykga25vdyB0aGlzIHB1YmxpYyBrZXlcbiAgICAvLyBSZXNlbmQgYWxsIHBlbmRpbmcgbWVzc2FnZXNcbiAgICBqaWZmQ2xpZW50LnNvY2tldC5yZXNlbmRfbWFpbGJveCgpO1xuXG4gICAgLy8gc3RvcmUgdGhlIHJlY2VpdmVkIHB1YmxpYyBrZXlzIGFuZCByZXNvbHZlIHdhaXQgY2FsbGJhY2tzXG4gICAgamlmZkNsaWVudC5oYW5kbGVycy5zdG9yZV9wdWJsaWNfa2V5cyhtc2cucHVibGljX2tleXMpO1xuICB9O1xuXG4gIC8qKlxuICAgKiBQYXJzZSBhbmQgc3RvcmUgdGhlIGdpdmVuIHB1YmxpYyBrZXlzXG4gICAqIEBtZXRob2RcbiAgICogQG1lbWJlcm9mIGhhbmRsZXJzXG4gICAqIEBwYXJhbSB7b2JqZWN0fSBrZXltYXAgLSBtYXBzIHBhcnR5IGlkIHRvIHNlcmlhbGl6ZWQgcHVibGljIGtleS5cbiAgICovXG4gIGppZmZDbGllbnQuaGFuZGxlcnMuc3RvcmVfcHVibGljX2tleXMgPSBmdW5jdGlvbiAoa2V5bWFwKSB7XG4gICAgdmFyIGk7XG4gICAgZm9yIChpIGluIGtleW1hcCkge1xuICAgICAgaWYgKGtleW1hcC5oYXNPd25Qcm9wZXJ0eShpKSAmJiBqaWZmQ2xpZW50LmtleW1hcFtpXSA9PSBudWxsKSB7XG4gICAgICAgIGppZmZDbGllbnQua2V5bWFwW2ldID0gamlmZkNsaWVudC5ob29rcy5wYXJzZUtleShqaWZmQ2xpZW50LCBrZXltYXBbaV0pO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIFJlc29sdmUgYW55IHBlbmRpbmcgbWVzc2FnZXMgdGhhdCB3ZXJlIHJlY2VpdmVkIGJlZm9yZSB0aGUgc2VuZGVyJ3MgcHVibGljIGtleSB3YXMga25vd25cbiAgICBqaWZmQ2xpZW50LnJlc29sdmVfbWVzc2FnZXNfd2FpdGluZ19mb3Jfa2V5cygpO1xuXG4gICAgLy8gUmVzb2x2ZSBhbnkgcGVuZGluZyB3YWl0cyB0aGF0IGhhdmUgc2F0aXNmaWVkIGNvbmRpdGlvbnNcbiAgICBqaWZmQ2xpZW50LmV4ZWN1dGVfd2FpdF9jYWxsYmFja3MoKTtcblxuICAgIC8vIENoZWNrIGlmIGFsbCBrZXlzIGhhdmUgYmVlbiByZWNlaXZlZFxuICAgIGlmIChqaWZmQ2xpZW50LmtleW1hcFsnczEnXSA9PSBudWxsKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGZvciAoaSA9IDE7IGkgPD0gamlmZkNsaWVudC5wYXJ0eV9jb3VudDsgaSsrKSB7XG4gICAgICBpZiAoamlmZkNsaWVudC5rZXltYXBbaV0gPT0gbnVsbCkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gYWxsIHBhcnRpZXMgYXJlIGNvbm5lY3RlZDsgZXhlY3V0ZSBjYWxsYmFja1xuICAgIGlmIChqaWZmQ2xpZW50Ll9fcmVhZHkgIT09IHRydWUgJiYgamlmZkNsaWVudC5fX2luaXRpYWxpemVkKSB7XG4gICAgICBqaWZmQ2xpZW50Ll9fcmVhZHkgPSB0cnVlO1xuICAgICAgaWYgKGppZmZDbGllbnQub3B0aW9ucy5vbkNvbm5lY3QgIT0gbnVsbCkge1xuICAgICAgICBqaWZmQ2xpZW50Lm9wdGlvbnMub25Db25uZWN0KGppZmZDbGllbnQpO1xuICAgICAgfVxuICAgIH1cbiAgfTtcbn07XG4iLCIvLyBhZGRzIHNoYXJpbmcgcmVsYXRlZCBoYW5kbGVyc1xubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAoamlmZkNsaWVudCkge1xuICAvKipcbiAgICogU3RvcmUgdGhlIHJlY2VpdmVkIHNoYXJlIGFuZCByZXNvbHZlcyB0aGUgY29ycmVzcG9uZGluZ1xuICAgKiBkZWZlcnJlZCBpZiBuZWVkZWQuXG4gICAqIEBtZXRob2RcbiAgICogQG1lbWJlcm9mIGhhbmRsZXJzXG4gICAqIEBwYXJhbSB7b2JqZWN0fSBqc29uX21zZyAtIHRoZSBwYXJzZWQganNvbiBtZXNzYWdlIGFzIHJlY2VpdmVkLlxuICAgKi9cbiAgamlmZkNsaWVudC5oYW5kbGVycy5yZWNlaXZlX3NoYXJlID0gZnVuY3Rpb24gKGpzb25fbXNnKSB7XG4gICAgLy8gRGVjcnlwdCBzaGFyZVxuICAgIGpzb25fbXNnWydzaGFyZSddID0gamlmZkNsaWVudC5ob29rcy5kZWNyeXB0U2lnbihqaWZmQ2xpZW50LCBqc29uX21zZ1snc2hhcmUnXSwgamlmZkNsaWVudC5zZWNyZXRfa2V5LCBqaWZmQ2xpZW50LmtleW1hcFtqc29uX21zZ1sncGFydHlfaWQnXV0pO1xuICAgIGpzb25fbXNnID0gamlmZkNsaWVudC5ob29rcy5leGVjdXRlX2FycmF5X2hvb2tzKCdhZnRlck9wZXJhdGlvbicsIFtqaWZmQ2xpZW50LCAnc2hhcmUnLCBqc29uX21zZ10sIDIpO1xuXG4gICAgdmFyIHNlbmRlcl9pZCA9IGpzb25fbXNnWydwYXJ0eV9pZCddO1xuICAgIHZhciBvcF9pZCA9IGpzb25fbXNnWydvcF9pZCddO1xuICAgIHZhciBzaGFyZSA9IGpzb25fbXNnWydzaGFyZSddO1xuXG4gICAgLy8gQ2FsbCBob29rXG4gICAgc2hhcmUgPSBqaWZmQ2xpZW50Lmhvb2tzLmV4ZWN1dGVfYXJyYXlfaG9va3MoJ3JlY2VpdmVTaGFyZScsIFtqaWZmQ2xpZW50LCBzZW5kZXJfaWQsIHNoYXJlXSwgMik7XG5cbiAgICAvLyBjaGVjayBpZiBhIGRlZmVycmVkIGlzIHNldCB1cCAobWF5YmUgdGhlIHNoYXJlIHdhcyByZWNlaXZlZCBlYXJseSlcbiAgICBpZiAoamlmZkNsaWVudC5kZWZlcnJlZHNbb3BfaWRdID09IG51bGwpIHtcbiAgICAgIGppZmZDbGllbnQuZGVmZXJyZWRzW29wX2lkXSA9IHt9O1xuICAgIH1cbiAgICBpZiAoamlmZkNsaWVudC5kZWZlcnJlZHNbb3BfaWRdW3NlbmRlcl9pZF0gPT0gbnVsbCkge1xuICAgICAgLy8gU2hhcmUgaXMgcmVjZWl2ZWQgYmVmb3JlIGRlZmVycmVkIHdhcyBzZXR1cCwgc3RvcmUgaXQuXG4gICAgICBqaWZmQ2xpZW50LmRlZmVycmVkc1tvcF9pZF1bc2VuZGVyX2lkXSA9IG5ldyBqaWZmQ2xpZW50LmhlbHBlcnMuRGVmZXJyZWQoKTtcbiAgICB9XG5cbiAgICAvLyBEZWZlcnJlZCBpcyBhbHJlYWR5IHNldHVwLCByZXNvbHZlIGl0LlxuICAgIGppZmZDbGllbnQuZGVmZXJyZWRzW29wX2lkXVtzZW5kZXJfaWRdLnJlc29sdmUoc2hhcmUpO1xuICB9O1xuXG4gIC8qKlxuICAgKiBSZXNvbHZlcyB0aGUgZGVmZXJyZWQgY29ycmVzcG9uZGluZyB0byBvcGVyYXRpb25faWQgYW5kIHNlbmRlcl9pZC5cbiAgICogQG1ldGhvZFxuICAgKiBAbWVtYmVyb2YgaGFuZGxlcnNcbiAgICogQHBhcmFtIHtvYmplY3R9IGpzb25fbXNnIC0gdGhlIGpzb24gbWVzc2FnZSBhcyByZWNlaXZlZCB3aXRoIHRoZSBvcGVuIGV2ZW50LlxuICAgKi9cbiAgamlmZkNsaWVudC5oYW5kbGVycy5yZWNlaXZlX29wZW4gPSBmdW5jdGlvbiAoanNvbl9tc2cpIHtcbiAgICAvLyBEZWNyeXB0IHNoYXJlXG4gICAgaWYgKGpzb25fbXNnWydwYXJ0eV9pZCddICE9PSBqaWZmQ2xpZW50LmlkKSB7XG4gICAgICBqc29uX21zZ1snc2hhcmUnXSA9IGppZmZDbGllbnQuaG9va3MuZGVjcnlwdFNpZ24oamlmZkNsaWVudCwganNvbl9tc2dbJ3NoYXJlJ10sIGppZmZDbGllbnQuc2VjcmV0X2tleSwgamlmZkNsaWVudC5rZXltYXBbanNvbl9tc2dbJ3BhcnR5X2lkJ11dKTtcbiAgICAgIGpzb25fbXNnID0gamlmZkNsaWVudC5ob29rcy5leGVjdXRlX2FycmF5X2hvb2tzKCdhZnRlck9wZXJhdGlvbicsIFtqaWZmQ2xpZW50LCAnb3BlbicsIGpzb25fbXNnXSwgMik7XG4gICAgfVxuXG4gICAgdmFyIHNlbmRlcl9pZCA9IGpzb25fbXNnWydwYXJ0eV9pZCddO1xuICAgIHZhciBvcF9pZCA9IGpzb25fbXNnWydvcF9pZCddO1xuICAgIHZhciBzaGFyZSA9IGpzb25fbXNnWydzaGFyZSddO1xuICAgIHZhciBacCA9IGpzb25fbXNnWydacCddO1xuXG4gICAgLy8gY2FsbCBob29rXG4gICAgc2hhcmUgPSBqaWZmQ2xpZW50Lmhvb2tzLmV4ZWN1dGVfYXJyYXlfaG9va3MoJ3JlY2VpdmVPcGVuJywgW2ppZmZDbGllbnQsIHNlbmRlcl9pZCwgc2hhcmUsIFpwXSwgMik7XG5cbiAgICAvLyBFbnN1cmUgZGVmZXJyZWQgaXMgc2V0dXBcbiAgICBpZiAoamlmZkNsaWVudC5kZWZlcnJlZHNbb3BfaWRdID09IG51bGwpIHtcbiAgICAgIGppZmZDbGllbnQuZGVmZXJyZWRzW29wX2lkXSA9IHt9O1xuICAgIH1cbiAgICBpZiAoamlmZkNsaWVudC5kZWZlcnJlZHNbb3BfaWRdLnNoYXJlcyA9PSBudWxsKSB7XG4gICAgICBqaWZmQ2xpZW50LmRlZmVycmVkc1tvcF9pZF0uc2hhcmVzID0gW107XG4gICAgfVxuXG4gICAgLy8gQWNjdW11bGF0ZSByZWNlaXZlZCBzaGFyZXNcbiAgICBqaWZmQ2xpZW50LmRlZmVycmVkc1tvcF9pZF0uc2hhcmVzLnB1c2goeyB2YWx1ZTogc2hhcmUsIHNlbmRlcl9pZDogc2VuZGVyX2lkLCBacDogWnAgfSk7XG5cbiAgICAvLyBSZXNvbHZlIHdoZW4gcmVhZHlcbiAgICBpZiAoamlmZkNsaWVudC5kZWZlcnJlZHNbb3BfaWRdLnNoYXJlcy5sZW5ndGggPT09IGppZmZDbGllbnQuZGVmZXJyZWRzW29wX2lkXS50aHJlc2hvbGQpIHtcbiAgICAgIGppZmZDbGllbnQuZGVmZXJyZWRzW29wX2lkXS5kZWZlcnJlZC5yZXNvbHZlKCk7XG4gICAgfVxuXG4gICAgLy8gQ2xlYW4gdXAgaWYgZG9uZVxuICAgIGlmIChqaWZmQ2xpZW50LmRlZmVycmVkc1tvcF9pZF0gIT0gbnVsbCAmJiBqaWZmQ2xpZW50LmRlZmVycmVkc1tvcF9pZF0uZGVmZXJyZWQgPT09ICdDTEVBTicgJiYgamlmZkNsaWVudC5kZWZlcnJlZHNbb3BfaWRdLnNoYXJlcy5sZW5ndGggPT09IGppZmZDbGllbnQuZGVmZXJyZWRzW29wX2lkXS50b3RhbCkge1xuICAgICAgZGVsZXRlIGppZmZDbGllbnQuZGVmZXJyZWRzW29wX2lkXTtcbiAgICB9XG4gIH07XG59O1xuIiwiLyoqIERvdWJseSBsaW5rZWQgbGlzdCB3aXRoIGFkZCBhbmQgcmVtb3ZlIGZ1bmN0aW9ucyBhbmQgcG9pbnRlcnMgdG8gaGVhZCBhbmQgdGFpbCoqL1xubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAoKSB7XG4gIC8vIGF0dHJpYnV0ZXM6IGxpc3QuaGVhZCBhbmQgbGlzdC50YWlsXG4gIC8vIGZ1bmN0aW9uczogbGlzdC5hZGQob2JqZWN0KSAocmV0dXJucyBwb2ludGVyKSwgbGlzdC5yZW1vdmUocG9pbnRlcilcbiAgLy8gbGlzdC5oZWFkL2xpc3QudGFpbC9hbnkgZWxlbWVudCBjb250YWluczpcbiAgLy8gICAgbmV4dDogcG9pbnRlciB0byBuZXh0LFxuICAvLyAgICBwcmV2aW91czogcG9pbnRlciB0byBwcmV2aW91cyxcbiAgLy8gICAgb2JqZWN0OiBzdG9yZWQgb2JqZWN0LlxuICB2YXIgbGlzdCA9IHsgaGVhZDogbnVsbCwgdGFpbDogbnVsbCB9O1xuICAvLyBUT0RPIHJlbmFtZSB0aGlzIHRvIHB1c2hUYWlsIHx8IHB1c2hcbiAgbGlzdC5hZGQgPSBmdW5jdGlvbiAob2JqKSB7XG4gICAgdmFyIG5vZGUgPSB7IG9iamVjdDogb2JqLCBuZXh0OiBudWxsLCBwcmV2aW91czogbnVsbCB9O1xuICAgIGlmIChsaXN0LmhlYWQgPT0gbnVsbCkge1xuICAgICAgbGlzdC5oZWFkID0gbm9kZTtcbiAgICAgIGxpc3QudGFpbCA9IG5vZGU7XG4gICAgfSBlbHNlIHtcbiAgICAgIGxpc3QudGFpbC5uZXh0ID0gbm9kZTtcbiAgICAgIG5vZGUucHJldmlvdXMgPSBsaXN0LnRhaWw7XG4gICAgICBsaXN0LnRhaWwgPSBub2RlO1xuICAgIH1cbiAgICByZXR1cm4gbm9kZTtcbiAgfTtcblxuICBsaXN0LnB1c2hIZWFkID0gZnVuY3Rpb24gKG9iaikge1xuICAgIGxpc3QuaGVhZCA9IHsgb2JqZWN0OiBvYmosIG5leHQ6IGxpc3QuaGVhZCwgcHJldmlvdXM6IG51bGwgfTtcbiAgICBpZiAobGlzdC5oZWFkLm5leHQgIT0gbnVsbCkge1xuICAgICAgbGlzdC5oZWFkLm5leHQucHJldmlvdXMgPSBsaXN0LmhlYWQ7XG4gICAgfSBlbHNlIHtcbiAgICAgIGxpc3QudGFpbCA9IGxpc3QuaGVhZDtcbiAgICB9XG4gIH07XG5cbiAgbGlzdC5wb3BIZWFkID0gZnVuY3Rpb24gKCkge1xuICAgIHZhciByZXN1bHQgPSBsaXN0LmhlYWQ7XG4gICAgaWYgKGxpc3QuaGVhZCAhPSBudWxsKSB7XG4gICAgICBsaXN0LmhlYWQgPSBsaXN0LmhlYWQubmV4dDtcbiAgICAgIGlmIChsaXN0LmhlYWQgPT0gbnVsbCkge1xuICAgICAgICBsaXN0LnRhaWwgPSBudWxsO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbGlzdC5oZWFkLnByZXZpb3VzID0gbnVsbDtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfTtcblxuICAvLyBtZXJnZXMgdHdvIGxpbmtlZCBsaXN0cyBhbmQgcmV0dXJuIGEgcG9pbnRlciB0byB0aGUgaGVhZCBvZiB0aGUgbWVyZ2VkIGxpc3RcbiAgLy8gdGhlIGhlYWQgd2lsbCBiZSB0aGUgaGVhZCBvZiBsaXN0IGFuZCB0aGUgdGFpbCB0aGUgdGFpbCBvZiBsMlxuICBsaXN0LmV4dGVuZCA9IGZ1bmN0aW9uIChsMikge1xuICAgIGlmIChsaXN0LmhlYWQgPT0gbnVsbCkge1xuICAgICAgcmV0dXJuIGwyO1xuICAgIH1cbiAgICBpZiAobDIuaGVhZCA9PSBudWxsKSB7XG4gICAgICByZXR1cm4gbGlzdDtcbiAgICB9XG4gICAgbGlzdC50YWlsLm5leHQgPSBsMi5oZWFkO1xuICAgIGwyLmhlYWQucHJldmlvdXMgPSBsaXN0LnRhaWw7XG4gICAgbGlzdC50YWlsID0gbDIudGFpbDtcblxuICAgIHJldHVybiBsaXN0O1xuICB9O1xuXG4gIGxpc3QucmVtb3ZlID0gZnVuY3Rpb24gKHB0cikge1xuICAgIHZhciBwcmV2ID0gcHRyLnByZXZpb3VzO1xuICAgIHZhciBuZXh0ID0gcHRyLm5leHQ7XG5cbiAgICBpZiAocHJldiA9PSBudWxsICYmIGxpc3QuaGVhZCAhPT0gcHRyKSB7XG4gICAgICByZXR1cm47XG4gICAgfSBlbHNlIGlmIChuZXh0ID09IG51bGwgJiYgbGlzdC50YWlsICE9PSBwdHIpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAocHJldiA9PSBudWxsKSB7XG4gICAgICAvLyBwdHIgaXMgaGVhZCAob3IgYm90aCBoZWFkIGFuZCB0YWlsKVxuICAgICAgbGlzdC5oZWFkID0gbmV4dDtcbiAgICAgIGlmIChsaXN0LmhlYWQgIT0gbnVsbCkge1xuICAgICAgICBsaXN0LmhlYWQucHJldmlvdXMgPSBudWxsO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbGlzdC50YWlsID0gbnVsbDtcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKG5leHQgPT0gbnVsbCkge1xuICAgICAgLy8gcHRyIGlzIHRhaWwgKGFuZCBub3QgaGVhZClcbiAgICAgIGxpc3QudGFpbCA9IHByZXY7XG4gICAgICBwcmV2Lm5leHQgPSBudWxsO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBwdHIgaXMgaW5zaWRlXG4gICAgICBwcmV2Lm5leHQgPSBuZXh0O1xuICAgICAgbmV4dC5wcmV2aW91cyA9IHByZXY7XG4gICAgfVxuICB9O1xuICBsaXN0LnNsaWNlID0gZnVuY3Rpb24gKHB0cikge1xuICAgIC8vIHJlbW92ZSBhbGwgZWxlbWVudHMgZnJvbSBoZWFkIHRvIHB0ciAoaW5jbHVkaW5nIHB0cikuXG4gICAgaWYgKHB0ciA9PSBudWxsKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLyogQ09OU0VSVkFUSVZFOiBtYWtlIHN1cmUgcHRyIGlzIHBhcnQgb2YgdGhlIGxpc3QgdGhlbiByZW1vdmUgKi9cbiAgICB2YXIgY3VycmVudCA9IGxpc3QuaGVhZDtcbiAgICB3aGlsZSAoY3VycmVudCAhPSBudWxsKSB7XG4gICAgICBpZiAoY3VycmVudCA9PT0gcHRyKSB7XG4gICAgICAgIGxpc3QuaGVhZCA9IHB0ci5uZXh0O1xuICAgICAgICBpZiAobGlzdC5oZWFkID09IG51bGwpIHtcbiAgICAgICAgICBsaXN0LnRhaWwgPSBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgY3VycmVudCA9IGN1cnJlbnQubmV4dDtcbiAgICB9XG5cbiAgICAvKiBNT1JFIEFHR1JFU1NJVkUgVkVSU0lPTjogd2lsbCBiZSBpbmNvcnJlY3QgaWYgcHRyIGlzIG5vdCBpbiB0aGUgbGlzdCAqL1xuICAgIC8qXG4gICAgbGlzdC5oZWFkID0gcHRyLm5leHQ7XG4gICAgaWYgKGxpc3QuaGVhZCA9PSBudWxsKSB7XG4gICAgICBsaXN0LnRhaWwgPSBudWxsO1xuICAgIH1cbiAgICAqL1xuICB9O1xuICAvKlxuICBsaXN0Ll9kZWJ1Z19sZW5ndGggPSBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIGwgPSAwO1xuICAgIHZhciBjdXJyZW50ID0gbGlzdC5oZWFkO1xuICAgIHdoaWxlIChjdXJyZW50ICE9IG51bGwpIHtcbiAgICAgIGN1cnJlbnQgPSBjdXJyZW50Lm5leHQ7XG4gICAgICBsKys7XG4gICAgfVxuICAgIHJldHVybiBsO1xuICB9O1xuICAqL1xuICByZXR1cm4gbGlzdDtcbn07XG4iLCIvKipcbiAqIFRoaXMgZGVmaW5lcyBhIGxpYnJhcnkgZXh0ZW5zaW9uIGZvciB1c2luZyB3ZWJzb2NrZXRzIHJhdGhlciB0aGFuIHNvY2tldC5pbyBmb3IgY29tbXVuaWNhdGlvbi4gVGhpc1xuICogZXh0ZW5zaW9uIHByaW1hcmlseSBlZGl0cy9vdmVyd3JpdGVzIGV4aXN0aW5nIHNvY2tldCBmdW5jdGlvbnMgdG8gdXNlIGFuZCBiZSBjb21wYXRpYmxlIHdpdGggdGhlXG4gKiB3cyBsaWJyYXJ5LlxuICogQG5hbWVzcGFjZSBqaWZmY2xpZW50X3dlYnNvY2tldHNcbiAqIEB2ZXJzaW9uIDEuMFxuICpcbiAqIFJFUVVJUkVNRU5UUzpcbiAqIFlvdSBtdXN0IGFwcGx5IHRoaXMgZXh0ZW5zaW9uIHRvIHlvdXIgY2xpZW50IGFuZCB0aGUgc2VydmVyIHlvdSdyZSBjb21tdW5pY2F0aW5nIHdpdGggbXVzdCBhcHBseSBqaWZmc2VydmVyX3dlYnNvY2tldHMuXG4gKiBXaGVuIHVzaW5nIHRoaXMgZXh0ZW5zaW9uIGluIGJyb3dzZXIsIFwiL2Rpc3QvamlmZi1jbGllbnQtd2Vic29ja2V0cy5qc1wiIG11c3QgYmUgbG9hZGVkIGluIGNsaWVudC5odG1sIGluc3RlYWQgb2YgdGhpcyBmaWxlLlxuICovXG5cbihmdW5jdGlvbiAoZXhwb3J0cywgbm9kZSkge1xuICAvKipcbiAgICogVGhlIG5hbWUgb2YgdGhpcyBleHRlbnNpb246ICd3ZWJzb2NrZXQnXG4gICAqIEB0eXBlIHtzdHJpbmd9XG4gICAqIEBtZW1iZXJPZiBqaWZmY2xpZW50X3dlYnNvY2tldHNcbiAgICovXG5cbiAgdmFyIHdzO1xuICB2YXIgbGlua2VkTGlzdDtcbiAgdmFyIGhhbmRsZXJzO1xuXG4gIGxpbmtlZExpc3QgPSByZXF1aXJlKCcuLi9jb21tb24vbGlua2VkbGlzdC5qcycpO1xuICBoYW5kbGVycyA9IHJlcXVpcmUoJy4uL2NsaWVudC9oYW5kbGVycy5qcycpO1xuICBpZiAoIXByb2Nlc3MuYnJvd3Nlcikge1xuICAgIHdzID0gcmVxdWlyZSgnd3MnKTtcbiAgfSBlbHNlIHtcbiAgICBpZiAodHlwZW9mIFdlYlNvY2tldCAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgIHdzID0gV2ViU29ja2V0O1xuICAgIH0gZWxzZSBpZiAodHlwZW9mIE1veldlYlNvY2tldCAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgIHdzID0gTW96V2ViU29ja2V0O1xuICAgIH0gZWxzZSBpZiAodHlwZW9mIGdsb2JhbCAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgIHdzID0gZ2xvYmFsLldlYlNvY2tldCB8fCBnbG9iYWwuTW96V2ViU29ja2V0O1xuICAgIH0gZWxzZSBpZiAodHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgIHdzID0gd2luZG93LldlYlNvY2tldCB8fCB3aW5kb3cuTW96V2ViU29ja2V0O1xuICAgIH0gZWxzZSBpZiAodHlwZW9mIHNlbGYgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICB3cyA9IHNlbGYuV2ViU29ja2V0IHx8IHNlbGYuTW96V2ViU29ja2V0O1xuICAgIH1cbiAgfVxuXG4gIC8vIFRha2UgdGhlIGppZmYtY2xpZW50IGJhc2UgaW5zdGFuY2UgYW5kIG9wdGlvbnMgZm9yIHRoaXMgZXh0ZW5zaW9uLCBhbmQgdXNlIHRoZW1cbiAgLy8gdG8gY29uc3RydWN0IGFuIGluc3RhbmNlIGZvciB0aGlzIGV4dGVuc2lvbi5cbiAgZnVuY3Rpb24gbWFrZV9qaWZmKGJhc2VfaW5zdGFuY2UsIG9wdGlvbnMpIHtcbiAgICB2YXIgamlmZiA9IGJhc2VfaW5zdGFuY2U7XG5cbiAgICAvLyBQYXJzZSBvcHRpb25zXG4gICAgaWYgKG9wdGlvbnMgPT0gbnVsbCkge1xuICAgICAgb3B0aW9ucyA9IHt9O1xuICAgIH1cblxuICAgIC8qIEZ1bmN0aW9ucyB0aGF0IG92ZXJ3cml0ZSBjbGllbnQvc29ja2V0L2V2ZW50cy5qcyBmdW5jdGlvbmFsaXR5ICovXG5cbiAgICAvKipcbiAgICAgKiBpbml0U29ja2V0J3MgJy5vbicgZnVuY3Rpb25zIG5lZWRlZCB0byBiZSByZXBsYWNlZCBzaW5jZSB3cyBkb2VzXG4gICAgICogbm90IGhhdmUgYXMgbWFueSBwcm90b2NvbHMuIEluc3RlYWQgdGhlc2UgZnVuY3Rpb25zIGFyZSByb3V0ZWQgdG9cbiAgICAgKiB3aGVuIGEgbWVzc2FnZSBpcyByZWNlaXZlZCBhbmQgYSBwcm90b2NvbCBpcyBtYW51YWxseSBwYXJzZWQuXG4gICAgICovXG4gICAgamlmZi5pbml0U29ja2V0ID0gZnVuY3Rpb24gKCkge1xuICAgICAgdmFyIGppZmZDbGllbnQgPSB0aGlzO1xuXG4gICAgICAvKiB3cyB1c2VzIHRoZSAnb3BlbicgcHJvdG9jb2wgb24gY29ubmVjdGlvbi4gU2hvdWxkIG5vdCBjb25mbGljdCB3aXRoIHRoZVxuICAgICAgICAgICBKSUZGIG9wZW4gcHJvdG9jbCBhcyB0aGF0IHdpbGwgYmUgc2VudCBhcyBhIG1lc3NhZ2UgYW5kIHdzXG4gICAgICAgICAgIHdpbGwgc2VlIGl0IGFzIGEgJ21lc3NhZ2UnIHByb3RvY29sLiAqL1xuICAgICAgdGhpcy5zb2NrZXQub25vcGVuID0gamlmZkNsaWVudC5oYW5kbGVycy5jb25uZWN0ZWQ7XG5cbiAgICAgIC8vIFB1YmxpYyBrZXlzIHdlcmUgdXBkYXRlZCBvbiB0aGUgc2VydmVyLCBhbmQgaXQgc2VudCB1cyB0aGUgdXBkYXRlc1xuICAgICAgZnVuY3Rpb24gcHVibGljS2V5c0NoYW5nZWQobXNnLCBjYWxsYmFjaykge1xuICAgICAgICBtc2cgPSBKU09OLnBhcnNlKG1zZyk7XG4gICAgICAgIG1zZyA9IGppZmZDbGllbnQuaG9va3MuZXhlY3V0ZV9hcnJheV9ob29rcygnYWZ0ZXJPcGVyYXRpb24nLCBbamlmZkNsaWVudCwgJ3B1YmxpY19rZXlzJywgbXNnXSwgMik7XG5cbiAgICAgICAgamlmZkNsaWVudC5oYW5kbGVycy5zdG9yZV9wdWJsaWNfa2V5cyhtc2cucHVibGljX2tleXMpO1xuICAgICAgfVxuXG4gICAgICAvLyBTZXR1cCByZWNlaXZpbmcgbWF0Y2hpbmcgc2hhcmVzXG4gICAgICBmdW5jdGlvbiBzaGFyZShtc2csIGNhbGxiYWNrKSB7XG4gICAgICAgIC8vIHBhcnNlIG1lc3NhZ2VcbiAgICAgICAgdmFyIGpzb25fbXNnID0gSlNPTi5wYXJzZShtc2cpO1xuICAgICAgICB2YXIgc2VuZGVyX2lkID0ganNvbl9tc2dbJ3BhcnR5X2lkJ107XG5cbiAgICAgICAgaWYgKGppZmZDbGllbnQua2V5bWFwW3NlbmRlcl9pZF0gIT0gbnVsbCkge1xuICAgICAgICAgIGppZmZDbGllbnQuaGFuZGxlcnMucmVjZWl2ZV9zaGFyZShqc29uX21zZyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgaWYgKGppZmZDbGllbnQubWVzc2FnZXNXYWl0aW5nS2V5c1tzZW5kZXJfaWRdID09IG51bGwpIHtcbiAgICAgICAgICAgIGppZmZDbGllbnQubWVzc2FnZXNXYWl0aW5nS2V5c1tzZW5kZXJfaWRdID0gW107XG4gICAgICAgICAgfVxuICAgICAgICAgIGppZmZDbGllbnQubWVzc2FnZXNXYWl0aW5nS2V5c1tzZW5kZXJfaWRdLnB1c2goeyBsYWJlbDogJ3NoYXJlJywgbXNnOiBqc29uX21zZyB9KTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBmdW5jdGlvbiBtcGNPcGVuKG1zZywgY2FsbGJhY2spIHtcbiAgICAgICAgLy8gcGFyc2UgbWVzc2FnZVxuICAgICAgICB2YXIganNvbl9tc2cgPSBKU09OLnBhcnNlKG1zZyk7XG4gICAgICAgIHZhciBzZW5kZXJfaWQgPSBqc29uX21zZ1sncGFydHlfaWQnXTtcblxuICAgICAgICBpZiAoamlmZkNsaWVudC5rZXltYXBbc2VuZGVyX2lkXSAhPSBudWxsKSB7XG4gICAgICAgICAgamlmZkNsaWVudC5oYW5kbGVycy5yZWNlaXZlX29wZW4oanNvbl9tc2cpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGlmIChqaWZmQ2xpZW50Lm1lc3NhZ2VzV2FpdGluZ0tleXNbc2VuZGVyX2lkXSA9PSBudWxsKSB7XG4gICAgICAgICAgICBqaWZmQ2xpZW50Lm1lc3NhZ2VzV2FpdGluZ0tleXNbc2VuZGVyX2lkXSA9IFtdO1xuICAgICAgICAgIH1cbiAgICAgICAgICBqaWZmQ2xpZW50Lm1lc3NhZ2VzV2FpdGluZ0tleXNbc2VuZGVyX2lkXS5wdXNoKHsgbGFiZWw6ICdvcGVuJywgbXNnOiBqc29uX21zZyB9KTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAvLyBoYW5kbGUgY3VzdG9tIG1lc3NhZ2VzXG4gICAgICBmdW5jdGlvbiBzb2NrZXRDdXN0b20obXNnLCBjYWxsYmFjaykge1xuICAgICAgICB2YXIganNvbl9tc2cgPSBKU09OLnBhcnNlKG1zZyk7XG4gICAgICAgIHZhciBzZW5kZXJfaWQgPSBqc29uX21zZ1sncGFydHlfaWQnXTtcbiAgICAgICAgdmFyIGVuY3J5cHRlZCA9IGpzb25fbXNnWydlbmNyeXB0ZWQnXTtcblxuICAgICAgICBpZiAoamlmZkNsaWVudC5rZXltYXBbc2VuZGVyX2lkXSAhPSBudWxsIHx8IGVuY3J5cHRlZCAhPT0gdHJ1ZSkge1xuICAgICAgICAgIGppZmZDbGllbnQuaGFuZGxlcnMucmVjZWl2ZV9jdXN0b20oanNvbl9tc2cpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIGtleSBtdXN0IG5vdCBleGlzdCB5ZXQgZm9yIHNlbmRlcl9pZCwgYW5kIGVuY3J5cHRlZCBtdXN0IGJlIHRydWVcbiAgICAgICAgICBpZiAoamlmZkNsaWVudC5tZXNzYWdlc1dhaXRpbmdLZXlzW3NlbmRlcl9pZF0gPT0gbnVsbCkge1xuICAgICAgICAgICAgamlmZkNsaWVudC5tZXNzYWdlc1dhaXRpbmdLZXlzW3NlbmRlcl9pZF0gPSBbXTtcbiAgICAgICAgICB9XG4gICAgICAgICAgamlmZkNsaWVudC5tZXNzYWdlc1dhaXRpbmdLZXlzW3NlbmRlcl9pZF0ucHVzaCh7IGxhYmVsOiAnY3VzdG9tJywgbXNnOiBqc29uX21zZyB9KTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBmdW5jdGlvbiBjcnlwdG9Qcm92aWRlcihtc2csIGNhbGxiYWNrKSB7XG4gICAgICAgIGppZmZDbGllbnQuaGFuZGxlcnMucmVjZWl2ZV9jcnlwdG9fcHJvdmlkZXIoSlNPTi5wYXJzZShtc2cpKTtcbiAgICAgIH1cblxuICAgICAgZnVuY3Rpb24gb25FcnJvcihtc2cpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBtc2cgPSBKU09OLnBhcnNlKG1zZyk7XG4gICAgICAgICAgamlmZkNsaWVudC5oYW5kbGVycy5lcnJvcihtc2dbJ2xhYmVsJ10sIG1zZ1snZXJyb3InXSk7XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgamlmZkNsaWVudC5oYW5kbGVycy5lcnJvcignc29ja2V0LmlvJywgbXNnKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBmdW5jdGlvbiBzb2NrZXRDbG9zZShyZWFzb24pIHtcbiAgICAgICAgaWYgKHJlYXNvbiAhPT0gJ2lvIGNsaWVudCBkaXNjb25uZWN0Jykge1xuICAgICAgICAgIC8vIGNoZWNrIHRoYXQgdGhlIHJlYXNvbiBpcyBhbiBlcnJvciBhbmQgbm90IGEgdXNlciBpbml0aWF0ZWQgZGlzY29ubmVjdFxuICAgICAgICAgIGNvbnNvbGUubG9nKCdEaXNjb25uZWN0ZWQhJywgamlmZkNsaWVudC5pZCwgcmVhc29uKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGppZmZDbGllbnQuaG9va3MuZXhlY3V0ZV9hcnJheV9ob29rcygnYWZ0ZXJPcGVyYXRpb24nLCBbamlmZkNsaWVudCwgJ2Rpc2Nvbm5lY3QnLCByZWFzb25dLCAtMSk7XG4gICAgICB9XG5cbiAgICAgIHRoaXMuc29ja2V0Lm9uY2xvc2UgPSBmdW5jdGlvbiAocmVhc29uKSB7XG4gICAgICAgIHNvY2tldENsb3NlKHJlYXNvbi5jb2RlKTtcbiAgICAgIH07XG5cbiAgICAgIC8qKlxuICAgICAgICogSW4gZXZlcnkgbWVzc2FnZSBzZW50IG92ZXIgd3MsIHdlIHdpbGwgc2VuZCBhbG9uZyB3aXRoIGl0IGEgc29ja2V0UHJvdG9jb2wgc3RyaW5nXG4gICAgICAgKiB0aGF0IHdpbGwgYmUgcGFyc2VkIGJ5IHRoZSByZWNlaXZlciB0byByb3V0ZSB0aGUgcmVxdWVzdCB0byB0aGUgY29ycmVjdCBmdW5jdGlvbi4gVGhlXG4gICAgICAgKiBwcmV2aW91cyBpbmZvcm1hdGlvbiBzZW50IGJ5IHNvY2tldC5pbyB3aWxsIGJlIHVudG91Y2hlZCwgYnV0IG5vdyBzZW50IGluc2lkZSBvZiBtc2cuZGF0YS5cbiAgICAgICAqL1xuICAgICAgdGhpcy5zb2NrZXQub25tZXNzYWdlID0gZnVuY3Rpb24gKG1zZywgY2FsbGJhY2spIHtcbiAgICAgICAgbXNnID0gSlNPTi5wYXJzZShtc2cuZGF0YSk7XG5cbiAgICAgICAgc3dpdGNoIChtc2cuc29ja2V0UHJvdG9jb2wpIHtcbiAgICAgICAgICBjYXNlICdpbml0aWFsaXphdGlvbic6XG4gICAgICAgICAgICBqaWZmQ2xpZW50LmhhbmRsZXJzLmluaXRpYWxpemVkKG1zZy5kYXRhKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIGNhc2UgJ3B1YmxpY19rZXlzJzpcbiAgICAgICAgICAgIHB1YmxpY0tleXNDaGFuZ2VkKG1zZy5kYXRhLCBjYWxsYmFjayk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBjYXNlICdzaGFyZSc6XG4gICAgICAgICAgICBzaGFyZShtc2cuZGF0YSwgY2FsbGJhY2spO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgY2FzZSAnb3Blbic6XG4gICAgICAgICAgICBtcGNPcGVuKG1zZy5kYXRhLCBjYWxsYmFjayk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBjYXNlICdjdXN0b20nOlxuICAgICAgICAgICAgc29ja2V0Q3VzdG9tKG1zZy5kYXRhLCBjYWxsYmFjayk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBjYXNlICdjcnlwdG9fcHJvdmlkZXInOlxuICAgICAgICAgICAgY3J5cHRvUHJvdmlkZXIobXNnLmRhdGEsIGNhbGxiYWNrKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIGNhc2UgJ2Nsb3NlJzpcbiAgICAgICAgICAgIHNvY2tldENsb3NlKG1zZy5kYXRhKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIGNhc2UgJ2Rpc2Nvbm5lY3QnOlxuICAgICAgICAgICAgc29ja2V0Q2xvc2UobXNnLmRhdGEpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgY2FzZSAnZXJyb3InOlxuICAgICAgICAgICAgb25FcnJvcihtc2cuZGF0YSk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgY29uc29sZS5sb2coJ1Vrbm93biBwcm90b2NvbCwgJyArIG1zZy5zb2NrZXRQcm90b2NvbCArICcsIHJlY2VpdmVkJyk7XG4gICAgICAgIH1cbiAgICAgIH07XG4gICAgfTtcblxuICAgIC8qIE92ZXJ3cml0ZSB0aGUgc29ja2V0Q29ubmVjdCBmdW5jdGlvbiBmcm9tIGppZmYtY2xpZW50LmpzICovXG5cbiAgICBqaWZmLnNvY2tldENvbm5lY3QgPSBmdW5jdGlvbiAoSklGRkNsaWVudEluc3RhbmNlKSB7XG4gICAgICBpZiAob3B0aW9ucy5fX2ludGVybmFsX3NvY2tldCA9PSBudWxsKSB7XG4gICAgICAgIC8qKlxuICAgICAgICAgKiBTb2NrZXQgd3JhcHBlciBiZXR3ZWVuIHRoaXMgaW5zdGFuY2UgYW5kIHRoZSBzZXJ2ZXIsIGJhc2VkIG9uIHNvY2tldHMuaW9cbiAgICAgICAgICogQHR5cGUgeyFHdWFyZGVkU29ja2V0fVxuICAgICAgICAgKi9cbiAgICAgICAgSklGRkNsaWVudEluc3RhbmNlLnNvY2tldCA9IGd1YXJkZWRTb2NrZXQoSklGRkNsaWVudEluc3RhbmNlKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIEpJRkZDbGllbnRJbnN0YW5jZS5zb2NrZXQgPSBpbnRlcm5hbFNvY2tldChKSUZGQ2xpZW50SW5zdGFuY2UsIG9wdGlvbnMuX19pbnRlcm5hbF9zb2NrZXQpO1xuICAgICAgfVxuXG4gICAgICAvLyBzZXQgdXAgc29ja2V0IGV2ZW50IGhhbmRsZXJzXG4gICAgICBoYW5kbGVycyhKSUZGQ2xpZW50SW5zdGFuY2UpO1xuXG4gICAgICAvLyBPdmVyd3JpdGUgaGFuZGxlcnMuY29ubmVjdGVkIHdpdGggb3VyIG5ldyB3cyBjb25uZWN0aW9uIGhhbmRsZXJcbiAgICAgIEpJRkZDbGllbnRJbnN0YW5jZS5oYW5kbGVycy5jb25uZWN0ZWQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIEpJRkZDbGllbnRJbnN0YW5jZS5pbml0aWFsaXphdGlvbl9jb3VudGVyKys7XG5cbiAgICAgICAgaWYgKEpJRkZDbGllbnRJbnN0YW5jZS5zZWNyZXRfa2V5ID09IG51bGwgJiYgSklGRkNsaWVudEluc3RhbmNlLnB1YmxpY19rZXkgPT0gbnVsbCkge1xuICAgICAgICAgIHZhciBrZXkgPSBKSUZGQ2xpZW50SW5zdGFuY2UuaG9va3MuZ2VuZXJhdGVLZXlQYWlyKEpJRkZDbGllbnRJbnN0YW5jZSk7XG4gICAgICAgICAgSklGRkNsaWVudEluc3RhbmNlLnNlY3JldF9rZXkgPSBrZXkuc2VjcmV0X2tleTtcbiAgICAgICAgICBKSUZGQ2xpZW50SW5zdGFuY2UucHVibGljX2tleSA9IGtleS5wdWJsaWNfa2V5O1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gSW5pdGlhbGl6YXRpb24gbWVzc2FnZVxuICAgICAgICB2YXIgbXNnID0gSklGRkNsaWVudEluc3RhbmNlLmhhbmRsZXJzLmJ1aWxkX2luaXRpYWxpemF0aW9uX21lc3NhZ2UoKTtcblxuICAgICAgICAvLyBEb3VibGUgd3JhcCB0aGUgbXNnXG4gICAgICAgIG1zZyA9IEpTT04uc3RyaW5naWZ5KG1zZyk7XG5cbiAgICAgICAgLy8gRW1pdCBpbml0aWFsaXphdGlvbiBtZXNzYWdlIHRvIHNlcnZlclxuICAgICAgICBKSUZGQ2xpZW50SW5zdGFuY2Uuc29ja2V0LnNlbmQoSlNPTi5zdHJpbmdpZnkoeyBzb2NrZXRQcm90b2NvbDogJ2luaXRpYWxpemF0aW9uJywgZGF0YTogbXNnIH0pKTtcbiAgICAgIH07XG5cbiAgICAgIEpJRkZDbGllbnRJbnN0YW5jZS5pbml0U29ja2V0KCk7XG4gICAgfTtcblxuICAgIC8qIEZ1bmN0aW9ucyB0aGF0IG92ZXJ3cml0ZSBjbGllbnQvc29ja2V0L21haWxib3guanMgZnVuY3Rpb25hbGl0eSAqL1xuXG4gICAgZnVuY3Rpb24gZ3VhcmRlZFNvY2tldChqaWZmQ2xpZW50KSB7XG4gICAgICAvLyBDcmVhdGUgcGxhaW4gc29ja2V0IGlvIG9iamVjdCB3aGljaCB3ZSB3aWxsIHdyYXAgaW4gdGhpc1xuICAgICAgdmFyIHNvY2tldDtcbiAgICAgIGlmIChqaWZmQ2xpZW50Lmhvc3RuYW1lLnN0YXJ0c1dpdGgoJ2h0dHAnKSkge1xuICAgICAgICB2YXIgbW9kaWZpZWRIb3N0TmFtZSA9ICd3cycgKyBqaWZmQ2xpZW50Lmhvc3RuYW1lLnN1YnN0cmluZyhqaWZmQ2xpZW50Lmhvc3RuYW1lLmluZGV4T2YoJzonKSk7XG4gICAgICAgIHNvY2tldCA9IG5ldyB3cyhtb2RpZmllZEhvc3ROYW1lKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHNvY2tldCA9IG5ldyB3cyhqaWZmQ2xpZW50Lmhvc3RuYW1lKTtcbiAgICAgIH1cblxuICAgICAgc29ja2V0Lm9sZF9kaXNjb25uZWN0ID0gc29ja2V0LmNsb3NlO1xuXG4gICAgICBzb2NrZXQubWFpbGJveCA9IGxpbmtlZExpc3QoKTsgLy8gZm9yIG91dGdvaW5nIG1lc3NhZ2VzXG4gICAgICBzb2NrZXQuZW1wdHlfZGVmZXJyZWQgPSBudWxsOyAvLyBnZXRzIHJlc29sdmVkIHdoZW5ldmVyIHRoZSBtYWlsYm94IGlzIGVtcHR5XG4gICAgICBzb2NrZXQuamlmZkNsaWVudCA9IGppZmZDbGllbnQ7XG5cbiAgICAgIC8vIGFkZCBmdW5jdGlvbmFsaXR5IHRvIHNvY2tldFxuICAgICAgc29ja2V0LnNhZmVfZW1pdCA9IHNhZmVfZW1pdC5iaW5kKHNvY2tldCk7XG4gICAgICBzb2NrZXQucmVzZW5kX21haWxib3ggPSByZXNlbmRfbWFpbGJveC5iaW5kKHNvY2tldCk7XG4gICAgICBzb2NrZXQuZGlzY29ubmVjdCA9IGRpc2Nvbm5lY3QuYmluZChzb2NrZXQpO1xuICAgICAgc29ja2V0LnNhZmVfZGlzY29ubmVjdCA9IHNhZmVfZGlzY29ubmVjdC5iaW5kKHNvY2tldCk7XG4gICAgICBzb2NrZXQuaXNfZW1wdHkgPSBpc19lbXB0eS5iaW5kKHNvY2tldCk7XG5cbiAgICAgIHJldHVybiBzb2NrZXQ7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gc2FmZV9lbWl0KGxhYmVsLCBtc2cpIHtcbiAgICAgIC8vIGFkZCBtZXNzYWdlIHRvIG1haWxib3hcbiAgICAgIHZhciBtYWlsYm94X3BvaW50ZXIgPSB0aGlzLm1haWxib3guYWRkKHsgbGFiZWw6IGxhYmVsLCBtc2c6IG1zZyB9KTtcbiAgICAgIGlmICh0aGlzLnJlYWR5U3RhdGUgPT09IDEpIHtcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgICAvLyBlbWl0IHRoZSBtZXNzYWdlLCBpZiBhbiBhY2tub3dsZWRnbWVudCBpcyByZWNlaXZlZCwgcmVtb3ZlIGl0IGZyb20gbWFpbGJveFxuXG4gICAgICAgIHRoaXMuc2VuZChKU09OLnN0cmluZ2lmeSh7IHNvY2tldFByb3RvY29sOiBsYWJlbCwgZGF0YTogbXNnIH0pLCBudWxsLCBmdW5jdGlvbiAoc3RhdHVzKSB7XG4gICAgICAgICAgc2VsZi5tYWlsYm94LnJlbW92ZShtYWlsYm94X3BvaW50ZXIpO1xuXG4gICAgICAgICAgaWYgKHNlbGYuaXNfZW1wdHkoKSAmJiBzZWxmLmVtcHR5X2RlZmVycmVkICE9IG51bGwpIHtcbiAgICAgICAgICAgIHNlbGYuZW1wdHlfZGVmZXJyZWQucmVzb2x2ZSgpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmIChsYWJlbCA9PT0gJ2ZyZWUnKSB7XG4gICAgICAgICAgICBzZWxmLmppZmZDbGllbnQuaG9va3MuZXhlY3V0ZV9hcnJheV9ob29rcygnYWZ0ZXJPcGVyYXRpb24nLCBbc2VsZi5qaWZmQ2xpZW50LCAnZnJlZScsIG1zZ10sIDIpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcmVzZW5kX21haWxib3goKSB7XG4gICAgICAvLyBDcmVhdGUgYSBuZXcgbWFpbGJveCwgc2luY2UgdGhlIGN1cnJlbnQgbWFpbGJveCB3aWxsIGJlIHJlc2VudCBhbmRcbiAgICAgIC8vIHdpbGwgY29udGFpbiBuZXcgYmFja3Vwcy5cbiAgICAgIHZhciBvbGRfbWFpbGJveCA9IHRoaXMubWFpbGJveDtcbiAgICAgIHRoaXMubWFpbGJveCA9IGxpbmtlZExpc3QoKTtcblxuICAgICAgLy8gbG9vcCBvdmVyIGFsbCBzdG9yZWQgbWVzc2FnZXMgYW5kIGVtaXQgdGhlbVxuICAgICAgdmFyIGN1cnJlbnRfbm9kZSA9IG9sZF9tYWlsYm94LmhlYWQ7XG4gICAgICB3aGlsZSAoY3VycmVudF9ub2RlICE9IG51bGwpIHtcbiAgICAgICAgdmFyIGxhYmVsID0gY3VycmVudF9ub2RlLm9iamVjdC5sYWJlbDtcbiAgICAgICAgdmFyIG1zZyA9IGN1cnJlbnRfbm9kZS5vYmplY3QubXNnO1xuICAgICAgICB0aGlzLnNhZmVfZW1pdChsYWJlbCwgbXNnKTtcbiAgICAgICAgY3VycmVudF9ub2RlID0gY3VycmVudF9ub2RlLm5leHQ7XG4gICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZGlzY29ubmVjdCgpIHtcbiAgICAgIHRoaXMuamlmZkNsaWVudC5ob29rcy5leGVjdXRlX2FycmF5X2hvb2tzKCdiZWZvcmVPcGVyYXRpb24nLCBbdGhpcy5qaWZmQ2xpZW50LCAnZGlzY29ubmVjdCcsIHt9XSwgLTEpO1xuXG4gICAgICB0aGlzLm9sZF9kaXNjb25uZWN0LmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gc2FmZV9kaXNjb25uZWN0KGZyZWUsIGNhbGxiYWNrKSB7XG4gICAgICBpZiAodGhpcy5pc19lbXB0eSgpKSB7XG4gICAgICAgIGlmIChmcmVlKSB7XG4gICAgICAgICAgdGhpcy5qaWZmQ2xpZW50LmZyZWUoKTtcbiAgICAgICAgICBmcmVlID0gZmFsc2U7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLy8gVDogU2hvdWxkIHJlbWFpbiBcImRpc2Nvbm5lY3RcIiBzaW5jZSB3ZSBvdmVycmlkZSB0aGUgLmRpc2Nvbm5lY3QsIG5vIG5lZWQgdG8gY2hhbmdlIHRvIGNsb3NlXG4gICAgICAgICAgdGhpcy5kaXNjb25uZWN0KCk7XG4gICAgICAgICAgaWYgKGNhbGxiYWNrICE9IG51bGwpIHtcbiAgICAgICAgICAgIGNhbGxiYWNrKCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICB0aGlzLmVtcHR5X2RlZmVycmVkID0gbmV3IHRoaXMuamlmZkNsaWVudC5oZWxwZXJzLkRlZmVycmVkKCk7XG4gICAgICB0aGlzLmVtcHR5X2RlZmVycmVkLnByb21pc2UudGhlbih0aGlzLnNhZmVfZGlzY29ubmVjdC5iaW5kKHRoaXMsIGZyZWUsIGNhbGxiYWNrKSk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gaXNfZW1wdHkoKSB7XG4gICAgICByZXR1cm4gdGhpcy5tYWlsYm94LmhlYWQgPT0gbnVsbCAmJiB0aGlzLmppZmZDbGllbnQuY291bnRlcnMucGVuZGluZ19vcGVucyA9PT0gMDtcbiAgICB9XG5cbiAgICAvKiBQUkVQUk9DRVNTSU5HIElTIFRIRSBTQU1FICovXG4gICAgamlmZi5wcmVwcm9jZXNzaW5nX2Z1bmN0aW9uX21hcFtleHBvcnRzLm5hbWVdID0ge307XG5cbiAgICByZXR1cm4gamlmZjtcbiAgfVxuICAvLyBFeHBvc2UgdGhlIEFQSSBmb3IgdGhpcyBleHRlbnNpb24uXG4gIGV4cG9ydHMubWFrZV9qaWZmID0gbWFrZV9qaWZmO1xufSkodHlwZW9mIGV4cG9ydHMgPT09ICd1bmRlZmluZWQnID8gKHRoaXMuamlmZl93ZWJzb2NrZXRzID0ge30pIDogZXhwb3J0cywgdHlwZW9mIGV4cG9ydHMgIT09ICd1bmRlZmluZWQnKTtcbiIsIi8vIHNoaW0gZm9yIHVzaW5nIHByb2Nlc3MgaW4gYnJvd3NlclxudmFyIHByb2Nlc3MgPSBtb2R1bGUuZXhwb3J0cyA9IHt9O1xuXG4vLyBjYWNoZWQgZnJvbSB3aGF0ZXZlciBnbG9iYWwgaXMgcHJlc2VudCBzbyB0aGF0IHRlc3QgcnVubmVycyB0aGF0IHN0dWIgaXRcbi8vIGRvbid0IGJyZWFrIHRoaW5ncy4gIEJ1dCB3ZSBuZWVkIHRvIHdyYXAgaXQgaW4gYSB0cnkgY2F0Y2ggaW4gY2FzZSBpdCBpc1xuLy8gd3JhcHBlZCBpbiBzdHJpY3QgbW9kZSBjb2RlIHdoaWNoIGRvZXNuJ3QgZGVmaW5lIGFueSBnbG9iYWxzLiAgSXQncyBpbnNpZGUgYVxuLy8gZnVuY3Rpb24gYmVjYXVzZSB0cnkvY2F0Y2hlcyBkZW9wdGltaXplIGluIGNlcnRhaW4gZW5naW5lcy5cblxudmFyIGNhY2hlZFNldFRpbWVvdXQ7XG52YXIgY2FjaGVkQ2xlYXJUaW1lb3V0O1xuXG5mdW5jdGlvbiBkZWZhdWx0U2V0VGltb3V0KCkge1xuICAgIHRocm93IG5ldyBFcnJvcignc2V0VGltZW91dCBoYXMgbm90IGJlZW4gZGVmaW5lZCcpO1xufVxuZnVuY3Rpb24gZGVmYXVsdENsZWFyVGltZW91dCAoKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdjbGVhclRpbWVvdXQgaGFzIG5vdCBiZWVuIGRlZmluZWQnKTtcbn1cbihmdW5jdGlvbiAoKSB7XG4gICAgdHJ5IHtcbiAgICAgICAgaWYgKHR5cGVvZiBzZXRUaW1lb3V0ID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICBjYWNoZWRTZXRUaW1lb3V0ID0gc2V0VGltZW91dDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNhY2hlZFNldFRpbWVvdXQgPSBkZWZhdWx0U2V0VGltb3V0O1xuICAgICAgICB9XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgICBjYWNoZWRTZXRUaW1lb3V0ID0gZGVmYXVsdFNldFRpbW91dDtcbiAgICB9XG4gICAgdHJ5IHtcbiAgICAgICAgaWYgKHR5cGVvZiBjbGVhclRpbWVvdXQgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgIGNhY2hlZENsZWFyVGltZW91dCA9IGNsZWFyVGltZW91dDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNhY2hlZENsZWFyVGltZW91dCA9IGRlZmF1bHRDbGVhclRpbWVvdXQ7XG4gICAgICAgIH1cbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIGNhY2hlZENsZWFyVGltZW91dCA9IGRlZmF1bHRDbGVhclRpbWVvdXQ7XG4gICAgfVxufSAoKSlcbmZ1bmN0aW9uIHJ1blRpbWVvdXQoZnVuKSB7XG4gICAgaWYgKGNhY2hlZFNldFRpbWVvdXQgPT09IHNldFRpbWVvdXQpIHtcbiAgICAgICAgLy9ub3JtYWwgZW52aXJvbWVudHMgaW4gc2FuZSBzaXR1YXRpb25zXG4gICAgICAgIHJldHVybiBzZXRUaW1lb3V0KGZ1biwgMCk7XG4gICAgfVxuICAgIC8vIGlmIHNldFRpbWVvdXQgd2Fzbid0IGF2YWlsYWJsZSBidXQgd2FzIGxhdHRlciBkZWZpbmVkXG4gICAgaWYgKChjYWNoZWRTZXRUaW1lb3V0ID09PSBkZWZhdWx0U2V0VGltb3V0IHx8ICFjYWNoZWRTZXRUaW1lb3V0KSAmJiBzZXRUaW1lb3V0KSB7XG4gICAgICAgIGNhY2hlZFNldFRpbWVvdXQgPSBzZXRUaW1lb3V0O1xuICAgICAgICByZXR1cm4gc2V0VGltZW91dChmdW4sIDApO1xuICAgIH1cbiAgICB0cnkge1xuICAgICAgICAvLyB3aGVuIHdoZW4gc29tZWJvZHkgaGFzIHNjcmV3ZWQgd2l0aCBzZXRUaW1lb3V0IGJ1dCBubyBJLkUuIG1hZGRuZXNzXG4gICAgICAgIHJldHVybiBjYWNoZWRTZXRUaW1lb3V0KGZ1biwgMCk7XG4gICAgfSBjYXRjaChlKXtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIC8vIFdoZW4gd2UgYXJlIGluIEkuRS4gYnV0IHRoZSBzY3JpcHQgaGFzIGJlZW4gZXZhbGVkIHNvIEkuRS4gZG9lc24ndCB0cnVzdCB0aGUgZ2xvYmFsIG9iamVjdCB3aGVuIGNhbGxlZCBub3JtYWxseVxuICAgICAgICAgICAgcmV0dXJuIGNhY2hlZFNldFRpbWVvdXQuY2FsbChudWxsLCBmdW4sIDApO1xuICAgICAgICB9IGNhdGNoKGUpe1xuICAgICAgICAgICAgLy8gc2FtZSBhcyBhYm92ZSBidXQgd2hlbiBpdCdzIGEgdmVyc2lvbiBvZiBJLkUuIHRoYXQgbXVzdCBoYXZlIHRoZSBnbG9iYWwgb2JqZWN0IGZvciAndGhpcycsIGhvcGZ1bGx5IG91ciBjb250ZXh0IGNvcnJlY3Qgb3RoZXJ3aXNlIGl0IHdpbGwgdGhyb3cgYSBnbG9iYWwgZXJyb3JcbiAgICAgICAgICAgIHJldHVybiBjYWNoZWRTZXRUaW1lb3V0LmNhbGwodGhpcywgZnVuLCAwKTtcbiAgICAgICAgfVxuICAgIH1cblxuXG59XG5mdW5jdGlvbiBydW5DbGVhclRpbWVvdXQobWFya2VyKSB7XG4gICAgaWYgKGNhY2hlZENsZWFyVGltZW91dCA9PT0gY2xlYXJUaW1lb3V0KSB7XG4gICAgICAgIC8vbm9ybWFsIGVudmlyb21lbnRzIGluIHNhbmUgc2l0dWF0aW9uc1xuICAgICAgICByZXR1cm4gY2xlYXJUaW1lb3V0KG1hcmtlcik7XG4gICAgfVxuICAgIC8vIGlmIGNsZWFyVGltZW91dCB3YXNuJ3QgYXZhaWxhYmxlIGJ1dCB3YXMgbGF0dGVyIGRlZmluZWRcbiAgICBpZiAoKGNhY2hlZENsZWFyVGltZW91dCA9PT0gZGVmYXVsdENsZWFyVGltZW91dCB8fCAhY2FjaGVkQ2xlYXJUaW1lb3V0KSAmJiBjbGVhclRpbWVvdXQpIHtcbiAgICAgICAgY2FjaGVkQ2xlYXJUaW1lb3V0ID0gY2xlYXJUaW1lb3V0O1xuICAgICAgICByZXR1cm4gY2xlYXJUaW1lb3V0KG1hcmtlcik7XG4gICAgfVxuICAgIHRyeSB7XG4gICAgICAgIC8vIHdoZW4gd2hlbiBzb21lYm9keSBoYXMgc2NyZXdlZCB3aXRoIHNldFRpbWVvdXQgYnV0IG5vIEkuRS4gbWFkZG5lc3NcbiAgICAgICAgcmV0dXJuIGNhY2hlZENsZWFyVGltZW91dChtYXJrZXIpO1xuICAgIH0gY2F0Y2ggKGUpe1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgLy8gV2hlbiB3ZSBhcmUgaW4gSS5FLiBidXQgdGhlIHNjcmlwdCBoYXMgYmVlbiBldmFsZWQgc28gSS5FLiBkb2Vzbid0ICB0cnVzdCB0aGUgZ2xvYmFsIG9iamVjdCB3aGVuIGNhbGxlZCBub3JtYWxseVxuICAgICAgICAgICAgcmV0dXJuIGNhY2hlZENsZWFyVGltZW91dC5jYWxsKG51bGwsIG1hcmtlcik7XG4gICAgICAgIH0gY2F0Y2ggKGUpe1xuICAgICAgICAgICAgLy8gc2FtZSBhcyBhYm92ZSBidXQgd2hlbiBpdCdzIGEgdmVyc2lvbiBvZiBJLkUuIHRoYXQgbXVzdCBoYXZlIHRoZSBnbG9iYWwgb2JqZWN0IGZvciAndGhpcycsIGhvcGZ1bGx5IG91ciBjb250ZXh0IGNvcnJlY3Qgb3RoZXJ3aXNlIGl0IHdpbGwgdGhyb3cgYSBnbG9iYWwgZXJyb3IuXG4gICAgICAgICAgICAvLyBTb21lIHZlcnNpb25zIG9mIEkuRS4gaGF2ZSBkaWZmZXJlbnQgcnVsZXMgZm9yIGNsZWFyVGltZW91dCB2cyBzZXRUaW1lb3V0XG4gICAgICAgICAgICByZXR1cm4gY2FjaGVkQ2xlYXJUaW1lb3V0LmNhbGwodGhpcywgbWFya2VyKTtcbiAgICAgICAgfVxuICAgIH1cblxuXG5cbn1cbnZhciBxdWV1ZSA9IFtdO1xudmFyIGRyYWluaW5nID0gZmFsc2U7XG52YXIgY3VycmVudFF1ZXVlO1xudmFyIHF1ZXVlSW5kZXggPSAtMTtcblxuZnVuY3Rpb24gY2xlYW5VcE5leHRUaWNrKCkge1xuICAgIGlmICghZHJhaW5pbmcgfHwgIWN1cnJlbnRRdWV1ZSkge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuICAgIGRyYWluaW5nID0gZmFsc2U7XG4gICAgaWYgKGN1cnJlbnRRdWV1ZS5sZW5ndGgpIHtcbiAgICAgICAgcXVldWUgPSBjdXJyZW50UXVldWUuY29uY2F0KHF1ZXVlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBxdWV1ZUluZGV4ID0gLTE7XG4gICAgfVxuICAgIGlmIChxdWV1ZS5sZW5ndGgpIHtcbiAgICAgICAgZHJhaW5RdWV1ZSgpO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gZHJhaW5RdWV1ZSgpIHtcbiAgICBpZiAoZHJhaW5pbmcpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICB2YXIgdGltZW91dCA9IHJ1blRpbWVvdXQoY2xlYW5VcE5leHRUaWNrKTtcbiAgICBkcmFpbmluZyA9IHRydWU7XG5cbiAgICB2YXIgbGVuID0gcXVldWUubGVuZ3RoO1xuICAgIHdoaWxlKGxlbikge1xuICAgICAgICBjdXJyZW50UXVldWUgPSBxdWV1ZTtcbiAgICAgICAgcXVldWUgPSBbXTtcbiAgICAgICAgd2hpbGUgKCsrcXVldWVJbmRleCA8IGxlbikge1xuICAgICAgICAgICAgaWYgKGN1cnJlbnRRdWV1ZSkge1xuICAgICAgICAgICAgICAgIGN1cnJlbnRRdWV1ZVtxdWV1ZUluZGV4XS5ydW4oKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBxdWV1ZUluZGV4ID0gLTE7XG4gICAgICAgIGxlbiA9IHF1ZXVlLmxlbmd0aDtcbiAgICB9XG4gICAgY3VycmVudFF1ZXVlID0gbnVsbDtcbiAgICBkcmFpbmluZyA9IGZhbHNlO1xuICAgIHJ1bkNsZWFyVGltZW91dCh0aW1lb3V0KTtcbn1cblxucHJvY2Vzcy5uZXh0VGljayA9IGZ1bmN0aW9uIChmdW4pIHtcbiAgICB2YXIgYXJncyA9IG5ldyBBcnJheShhcmd1bWVudHMubGVuZ3RoIC0gMSk7XG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPiAxKSB7XG4gICAgICAgIGZvciAodmFyIGkgPSAxOyBpIDwgYXJndW1lbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBhcmdzW2kgLSAxXSA9IGFyZ3VtZW50c1tpXTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBxdWV1ZS5wdXNoKG5ldyBJdGVtKGZ1biwgYXJncykpO1xuICAgIGlmIChxdWV1ZS5sZW5ndGggPT09IDEgJiYgIWRyYWluaW5nKSB7XG4gICAgICAgIHJ1blRpbWVvdXQoZHJhaW5RdWV1ZSk7XG4gICAgfVxufTtcblxuLy8gdjggbGlrZXMgcHJlZGljdGlibGUgb2JqZWN0c1xuZnVuY3Rpb24gSXRlbShmdW4sIGFycmF5KSB7XG4gICAgdGhpcy5mdW4gPSBmdW47XG4gICAgdGhpcy5hcnJheSA9IGFycmF5O1xufVxuSXRlbS5wcm90b3R5cGUucnVuID0gZnVuY3Rpb24gKCkge1xuICAgIHRoaXMuZnVuLmFwcGx5KG51bGwsIHRoaXMuYXJyYXkpO1xufTtcbnByb2Nlc3MudGl0bGUgPSAnYnJvd3Nlcic7XG5wcm9jZXNzLmJyb3dzZXIgPSB0cnVlO1xucHJvY2Vzcy5lbnYgPSB7fTtcbnByb2Nlc3MuYXJndiA9IFtdO1xucHJvY2Vzcy52ZXJzaW9uID0gJyc7IC8vIGVtcHR5IHN0cmluZyB0byBhdm9pZCByZWdleHAgaXNzdWVzXG5wcm9jZXNzLnZlcnNpb25zID0ge307XG5cbmZ1bmN0aW9uIG5vb3AoKSB7fVxuXG5wcm9jZXNzLm9uID0gbm9vcDtcbnByb2Nlc3MuYWRkTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5vbmNlID0gbm9vcDtcbnByb2Nlc3Mub2ZmID0gbm9vcDtcbnByb2Nlc3MucmVtb3ZlTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5yZW1vdmVBbGxMaXN0ZW5lcnMgPSBub29wO1xucHJvY2Vzcy5lbWl0ID0gbm9vcDtcbnByb2Nlc3MucHJlcGVuZExpc3RlbmVyID0gbm9vcDtcbnByb2Nlc3MucHJlcGVuZE9uY2VMaXN0ZW5lciA9IG5vb3A7XG5cbnByb2Nlc3MubGlzdGVuZXJzID0gZnVuY3Rpb24gKG5hbWUpIHsgcmV0dXJuIFtdIH1cblxucHJvY2Vzcy5iaW5kaW5nID0gZnVuY3Rpb24gKG5hbWUpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3Byb2Nlc3MuYmluZGluZyBpcyBub3Qgc3VwcG9ydGVkJyk7XG59O1xuXG5wcm9jZXNzLmN3ZCA9IGZ1bmN0aW9uICgpIHsgcmV0dXJuICcvJyB9O1xucHJvY2Vzcy5jaGRpciA9IGZ1bmN0aW9uIChkaXIpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3Byb2Nlc3MuY2hkaXIgaXMgbm90IHN1cHBvcnRlZCcpO1xufTtcbnByb2Nlc3MudW1hc2sgPSBmdW5jdGlvbigpIHsgcmV0dXJuIDA7IH07XG4iLCIndXNlIHN0cmljdCc7XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKCkge1xuICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgJ3dzIGRvZXMgbm90IHdvcmsgaW4gdGhlIGJyb3dzZXIuIEJyb3dzZXIgY2xpZW50cyBtdXN0IHVzZSB0aGUgbmF0aXZlICcgK1xuICAgICAgJ1dlYlNvY2tldCBvYmplY3QnXG4gICk7XG59O1xuIl19
