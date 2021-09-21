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

      stored_messages.push({sender_id: sender_id, message: message});
    }
  }
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
    let decrypted = jiffClient.hooks.decryptSign(jiffClient, json_msg['share'], jiffClient.secret_key, jiffClient.keymap[json_msg['party_id']]);
    
    var ready = function (decrypted) {
      json_msg['share'] = decrypted;
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
    }

    if (decrypted.then) {
      decrypted.then(ready);
    } else {
      ready(decrypted);
    }
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
    jiffClient.deferreds[op_id].shares.push({value: share, sender_id: sender_id, Zp: Zp});

    // Resolve when ready
    if (jiffClient.deferreds[op_id].shares.length === jiffClient.deferreds[op_id].threshold) {
      jiffClient.deferreds[op_id].deferred.resolve();
    }

    // Clean up if done
    if (jiffClient.deferreds[op_id] != null && jiffClient.deferreds[op_id].deferred === 'CLEAN' && jiffClient.deferreds[op_id].shares.length === jiffClient.deferreds[op_id].total) {
      delete jiffClient.deferreds[op_id];
    }
  }
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
  var list = {head: null, tail: null};
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
    list.head = {object: obj, next : list.head, previous : null};
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
        list.head.previous  = null;
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

    if (prev == null) { // ptr is head (or both head and tail)
      list.head = next;
      if (list.head != null) {
        list.head.previous = null;
      } else {
        list.tail = null;
      }
    } else if (next == null) { // ptr is tail (and not head)
      list.tail = prev;
      prev.next = null;
    } else { // ptr is inside
      prev.next = next;
      next.previous = prev;
    }
  };
  list.slice = function (ptr) { // remove all elements from head to ptr (including ptr).
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

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJsaWIvY2xpZW50L2hhbmRsZXJzLmpzIiwibGliL2NsaWVudC9oYW5kbGVycy9jcnlwdG9fcHJvdmlkZXIuanMiLCJsaWIvY2xpZW50L2hhbmRsZXJzL2N1c3RvbS5qcyIsImxpYi9jbGllbnQvaGFuZGxlcnMvaW5pdGlhbGl6YXRpb24uanMiLCJsaWIvY2xpZW50L2hhbmRsZXJzL3NoYXJpbmcuanMiLCJsaWIvY29tbW9uL2xpbmtlZGxpc3QuanMiLCJsaWIvZXh0L2ppZmYtY2xpZW50LXdlYnNvY2tldHMuanMiLCJub2RlX21vZHVsZXMvcHJvY2Vzcy9icm93c2VyLmpzIiwibm9kZV9tb2R1bGVzL3dzL2Jyb3dzZXIuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25CQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNySUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FDOUhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDL1ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeExBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uKCl7ZnVuY3Rpb24gcihlLG4sdCl7ZnVuY3Rpb24gbyhpLGYpe2lmKCFuW2ldKXtpZighZVtpXSl7dmFyIGM9XCJmdW5jdGlvblwiPT10eXBlb2YgcmVxdWlyZSYmcmVxdWlyZTtpZighZiYmYylyZXR1cm4gYyhpLCEwKTtpZih1KXJldHVybiB1KGksITApO3ZhciBhPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIraStcIidcIik7dGhyb3cgYS5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGF9dmFyIHA9bltpXT17ZXhwb3J0czp7fX07ZVtpXVswXS5jYWxsKHAuZXhwb3J0cyxmdW5jdGlvbihyKXt2YXIgbj1lW2ldWzFdW3JdO3JldHVybiBvKG58fHIpfSxwLHAuZXhwb3J0cyxyLGUsbix0KX1yZXR1cm4gbltpXS5leHBvcnRzfWZvcih2YXIgdT1cImZ1bmN0aW9uXCI9PXR5cGVvZiByZXF1aXJlJiZyZXF1aXJlLGk9MDtpPHQubGVuZ3RoO2krKylvKHRbaV0pO3JldHVybiBvfXJldHVybiByfSkoKSIsInZhciBpbml0aWFsaXphdGlvbkhhbmRsZXJzID0gcmVxdWlyZSgnLi9oYW5kbGVycy9pbml0aWFsaXphdGlvbi5qcycpO1xudmFyIHNoYXJlSGFuZGxlcnMgPSByZXF1aXJlKCcuL2hhbmRsZXJzL3NoYXJpbmcuanMnKTtcbnZhciBjdXN0b21IYW5kbGVycyA9IHJlcXVpcmUoJy4vaGFuZGxlcnMvY3VzdG9tLmpzJyk7XG52YXIgY3J5cHRvUHJvdmlkZXJIYW5kbGVycyA9IHJlcXVpcmUoJy4vaGFuZGxlcnMvY3J5cHRvX3Byb3ZpZGVyLmpzJyk7XG5cbi8qKlxuICogQ29udGFpbnMgaGFuZGxlcnMgZm9yIGNvbW11bmljYXRpb24gZXZlbnRzXG4gKiBAbmFtZSBoYW5kbGVyc1xuICogQGFsaWFzIGhhbmRsZXJzXG4gKiBAbmFtZXNwYWNlXG4gKi9cblxuLy8gQWRkIGhhbmRsZXJzIGltcGxlbWVudGF0aW9uc1xubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAoamlmZkNsaWVudCkge1xuICAvLyBmaWxsIGluIGhhbmRsZXJzXG4gIGluaXRpYWxpemF0aW9uSGFuZGxlcnMoamlmZkNsaWVudCk7XG4gIHNoYXJlSGFuZGxlcnMoamlmZkNsaWVudCk7XG4gIGN1c3RvbUhhbmRsZXJzKGppZmZDbGllbnQpO1xuICBjcnlwdG9Qcm92aWRlckhhbmRsZXJzKGppZmZDbGllbnQpO1xufTsiLCIvLyBzZXR1cCBoYW5kbGVyIGZvciByZWNlaXZpbmcgbWVzc2FnZXMgZnJvbSB0aGUgY3J5cHRvIHByb3ZpZGVyXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChqaWZmQ2xpZW50KSB7XG4gIC8qKlxuICAgKiBQYXJzZSBjcnlwdG8gcHJvdmlkZXIgbWVzc2FnZSBhbmQgcmVzb2x2ZSBhc3NvY2lhdGVkIHByb21pc2UuXG4gICAqIEBtZXRob2RcbiAgICogQG1lbWJlcm9mIGhhbmRsZXJzXG4gICAqIEBwYXJhbSB7b2JqZWN0fSBqc29uX21zZyAtIHRoZSBwYXJzZWQganNvbiBtZXNzYWdlIGFzIHJlY2VpdmVkIGJ5IHRoZSBjcnlwdG9fcHJvdmlkZXIgZXZlbnQsIGNvbnRhaW5zICd2YWx1ZXMnIGFuZCAnc2hhcmVzJyBhdHRyaWJ1dGVzLlxuICAgKi9cbiAgamlmZkNsaWVudC5oYW5kbGVycy5yZWNlaXZlX2NyeXB0b19wcm92aWRlciA9IGZ1bmN0aW9uIChqc29uX21zZykge1xuICAgIC8vIEhvb2tcbiAgICBqc29uX21zZyA9IGppZmZDbGllbnQuaG9va3MuZXhlY3V0ZV9hcnJheV9ob29rcygnYWZ0ZXJPcGVyYXRpb24nLCBbamlmZkNsaWVudCwgJ2NyeXB0b19wcm92aWRlcicsIGpzb25fbXNnXSwgMik7XG5cbiAgICB2YXIgb3BfaWQgPSBqc29uX21zZ1snb3BfaWQnXTtcbiAgICBpZiAoamlmZkNsaWVudC5kZWZlcnJlZHNbb3BfaWRdID09IG51bGwpIHtcbiAgICAgIHJldHVybjsgLy8gZHVwbGljYXRlIG1lc3NhZ2U6IGlnbm9yZVxuICAgIH1cblxuICAgIC8vIHBhcnNlIG1zZ1xuICAgIHZhciByZWNlaXZlcnNfbGlzdCA9IGpzb25fbXNnWydyZWNlaXZlcnMnXTtcbiAgICB2YXIgdGhyZXNob2xkID0ganNvbl9tc2dbJ3RocmVzaG9sZCddO1xuICAgIHZhciBacCA9IGpzb25fbXNnWydacCddO1xuXG4gICAgLy8gY29uc3RydWN0IHNlY3JldCBzaGFyZSBvYmplY3RzXG4gICAgdmFyIHJlc3VsdCA9IHt9O1xuICAgIGlmIChqc29uX21zZ1sndmFsdWVzJ10gIT0gbnVsbCkge1xuICAgICAgcmVzdWx0LnZhbHVlcyA9IGpzb25fbXNnWyd2YWx1ZXMnXTtcbiAgICB9XG4gICAgaWYgKGpzb25fbXNnWydzaGFyZXMnXSAhPSBudWxsKSB7XG4gICAgICByZXN1bHQuc2hhcmVzID0gW107XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGpzb25fbXNnWydzaGFyZXMnXS5sZW5ndGg7IGkrKykge1xuICAgICAgICByZXN1bHQuc2hhcmVzLnB1c2gobmV3IGppZmZDbGllbnQuU2VjcmV0U2hhcmUoanNvbl9tc2dbJ3NoYXJlcyddW2ldLCByZWNlaXZlcnNfbGlzdCwgdGhyZXNob2xkLCBacCkpO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIHJlc29sdmUgZGVmZXJyZWRcbiAgICBqaWZmQ2xpZW50LmRlZmVycmVkc1tvcF9pZF0ucmVzb2x2ZShyZXN1bHQpO1xuICAgIGRlbGV0ZSBqaWZmQ2xpZW50LmRlZmVycmVkc1tvcF9pZF07XG4gIH07XG59OyIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKGppZmZDbGllbnQpIHtcbiAgLyoqXG4gICAqIENhbGxlZCB3aGVuIHRoaXMgcGFydHkgcmVjZWl2ZXMgYSBjdXN0b20gdGFnIG1lc3NhZ2UgZnJvbSBhbnkgcGFydHkgKGluY2x1ZGluZyBpdHNlbGYpLlxuICAgKiBJZiBhIGN1c3RvbSBsaXN0ZW5lciB3YXMgc2V0dXAgdG8gbGlzdGVuIHRvIHRoZSB0YWcsIHRoZSBtZXNzYWdlIGlzIHBhc3NlZCB0byB0aGUgbGlzdGVuZXIuXG4gICAqIE90aGVyd2lzZSwgdGhlIG1lc3NhZ2UgaXMgc3RvcmVkIHVudGlsIHN1Y2ggYSBsaXN0ZW5lciBpcyBwcm92aWRlZC5cbiAgICogQG1ldGhvZFxuICAgKiBAbWVtYmVyb2YgaGFuZGxlcnNcbiAgICogQHBhcmFtIHtvYmplY3R9IGpzb25fbXNnIC0gdGhlIHBhcnNlZCBqc29uIG1lc3NhZ2UgYXMgcmVjZWl2ZWQgYnkgdGhlIGN1c3RvbSBldmVudC5cbiAgICovXG4gIGppZmZDbGllbnQuaGFuZGxlcnMucmVjZWl2ZV9jdXN0b20gPSBmdW5jdGlvbiAoanNvbl9tc2cpIHtcbiAgICBpZiAoanNvbl9tc2dbJ3BhcnR5X2lkJ10gIT09IGppZmZDbGllbnQuaWQpIHtcbiAgICAgIGlmIChqc29uX21zZ1snZW5jcnlwdGVkJ10gPT09IHRydWUpIHtcbiAgICAgICAganNvbl9tc2dbJ21lc3NhZ2UnXSA9IGppZmZDbGllbnQuaG9va3MuZGVjcnlwdFNpZ24oamlmZkNsaWVudCwganNvbl9tc2dbJ21lc3NhZ2UnXSwgamlmZkNsaWVudC5zZWNyZXRfa2V5LCBqaWZmQ2xpZW50LmtleW1hcFtqc29uX21zZ1sncGFydHlfaWQnXV0pO1xuICAgICAgfVxuXG4gICAgICBqc29uX21zZyA9IGppZmZDbGllbnQuaG9va3MuZXhlY3V0ZV9hcnJheV9ob29rcygnYWZ0ZXJPcGVyYXRpb24nLCBbamlmZkNsaWVudCwgJ2N1c3RvbScsIGpzb25fbXNnXSwgMik7XG4gICAgfVxuXG4gICAgdmFyIHNlbmRlcl9pZCA9IGpzb25fbXNnWydwYXJ0eV9pZCddO1xuICAgIHZhciB0YWcgPSBqc29uX21zZ1sndGFnJ107XG4gICAgdmFyIG1lc3NhZ2UgPSBqc29uX21zZ1snbWVzc2FnZSddO1xuXG4gICAgaWYgKGppZmZDbGllbnQubGlzdGVuZXJzW3RhZ10gIT0gbnVsbCkge1xuICAgICAgamlmZkNsaWVudC5saXN0ZW5lcnNbdGFnXShzZW5kZXJfaWQsIG1lc3NhZ2UpO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBTdG9yZSBtZXNzYWdlIHVudGlsIGxpc3RlbmVyIGlzIHByb3ZpZGVkXG4gICAgICB2YXIgc3RvcmVkX21lc3NhZ2VzID0gamlmZkNsaWVudC5jdXN0b21fbWVzc2FnZXNfbWFpbGJveFt0YWddO1xuICAgICAgaWYgKHN0b3JlZF9tZXNzYWdlcyA9PSBudWxsKSB7XG4gICAgICAgIHN0b3JlZF9tZXNzYWdlcyA9IFtdO1xuICAgICAgICBqaWZmQ2xpZW50LmN1c3RvbV9tZXNzYWdlc19tYWlsYm94W3RhZ10gPSBzdG9yZWRfbWVzc2FnZXM7XG4gICAgICB9XG5cbiAgICAgIHN0b3JlZF9tZXNzYWdlcy5wdXNoKHtzZW5kZXJfaWQ6IHNlbmRlcl9pZCwgbWVzc2FnZTogbWVzc2FnZX0pO1xuICAgIH1cbiAgfVxufTsiLCIvLyBhZGQgaGFuZGxlcnMgZm9yIGluaXRpYWxpemF0aW9uXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChqaWZmQ2xpZW50KSB7XG4gIGppZmZDbGllbnQub3B0aW9ucy5pbml0aWFsaXphdGlvbiA9IE9iamVjdC5hc3NpZ24oe30sIGppZmZDbGllbnQub3B0aW9ucy5pbml0aWFsaXphdGlvbik7XG5cbiAgLyoqXG4gICAqIENhbGxlZCB3aGVuIGFuIGVycm9yIG9jY3Vyc1xuICAgKiBAbWV0aG9kXG4gICAqIEBtZW1iZXJvZiBoYW5kbGVyc1xuICAgKiBAcGFyYW0ge3N0cmluZ30gbGFiZWwgLSB0aGUgbmFtZSBvZiBtZXNzYWdlIG9yIG9wZXJhdGlvbiBjYXVzaW5nIHRoZSBlcnJvclxuICAgKiBAcGFyYW0ge2Vycm9yfHN0cmluZ30gZXJyb3IgLSB0aGUgZXJyb3JcbiAgICovXG4gIGppZmZDbGllbnQuaGFuZGxlcnMuZXJyb3IgPSBmdW5jdGlvbiAobGFiZWwsIGVycm9yKSB7XG4gICAgaWYgKGppZmZDbGllbnQub3B0aW9ucy5vbkVycm9yKSB7XG4gICAgICBqaWZmQ2xpZW50Lm9wdGlvbnMub25FcnJvcihsYWJlbCwgZXJyb3IpO1xuICAgIH1cblxuICAgIGNvbnNvbGUubG9nKGppZmZDbGllbnQuaWQsICc6JywgJ0Vycm9yIGZyb20gc2VydmVyOicsIGxhYmVsLCAnLS0tJywgZXJyb3IpOyAvLyBUT0RPOiByZW1vdmUgZGVidWdnaW5nXG4gICAgaWYgKGxhYmVsID09PSAnaW5pdGlhbGl6YXRpb24nKSB7XG4gICAgICBqaWZmQ2xpZW50LnNvY2tldC5kaXNjb25uZWN0KCk7XG5cbiAgICAgIGlmIChqaWZmQ2xpZW50LmluaXRpYWxpemF0aW9uX2NvdW50ZXIgPCBqaWZmQ2xpZW50Lm9wdGlvbnMubWF4SW5pdGlhbGl6YXRpb25SZXRyaWVzKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGppZmZDbGllbnQuaWQsICc6JywgJ3JlY29ubmVjdGluZy4uJyk7IC8vIFRPRE86IHJlbW92ZSBkZWJ1Z2dpbmdcbiAgICAgICAgc2V0VGltZW91dChqaWZmQ2xpZW50LmNvbm5lY3QsIGppZmZDbGllbnQub3B0aW9ucy5zb2NrZXRPcHRpb25zLnJlY29ubmVjdGlvbkRlbGF5KTtcbiAgICAgIH1cbiAgICB9XG4gIH07XG5cbiAgLyoqXG4gICAqIEJ1aWxkcyB0aGUgaW5pdGlhbGl6YXRpb24gbWVzc2FnZSBmb3IgdGhpcyBpbnN0YW5jZVxuICAgKiBAbWV0aG9kXG4gICAqIEBtZW1iZXJvZiBoYW5kbGVyc1xuICAgKiBAcmV0dXJuIHtPYmplY3R9XG4gICAqL1xuICBqaWZmQ2xpZW50LmhhbmRsZXJzLmJ1aWxkX2luaXRpYWxpemF0aW9uX21lc3NhZ2UgPSBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIG1zZyA9IHtcbiAgICAgIGNvbXB1dGF0aW9uX2lkOiBqaWZmQ2xpZW50LmNvbXB1dGF0aW9uX2lkLFxuICAgICAgcGFydHlfaWQ6IGppZmZDbGllbnQuaWQsXG4gICAgICBwYXJ0eV9jb3VudDogamlmZkNsaWVudC5wYXJ0eV9jb3VudCxcbiAgICAgIHB1YmxpY19rZXk6IGppZmZDbGllbnQucHVibGljX2tleSAhPSBudWxsID8gamlmZkNsaWVudC5ob29rcy5kdW1wS2V5KGppZmZDbGllbnQsIGppZmZDbGllbnQucHVibGljX2tleSkgOiB1bmRlZmluZWRcbiAgICB9O1xuICAgIG1zZyA9IE9iamVjdC5hc3NpZ24obXNnLCBqaWZmQ2xpZW50Lm9wdGlvbnMuaW5pdGlhbGl6YXRpb24pO1xuXG4gICAgLy8gSW5pdGlhbGl6YXRpb24gSG9va1xuICAgIHJldHVybiBqaWZmQ2xpZW50Lmhvb2tzLmV4ZWN1dGVfYXJyYXlfaG9va3MoJ2JlZm9yZU9wZXJhdGlvbicsIFtqaWZmQ2xpZW50LCAnaW5pdGlhbGl6YXRpb24nLCBtc2ddLCAyKTtcbiAgfTtcblxuICAvKipcbiAgICogQmVnaW5zIGluaXRpYWxpemF0aW9uIG9mIHRoaXMgaW5zdGFuY2UgYnkgc2VuZGluZyB0aGUgaW5pdGlhbGl6YXRpb24gbWVzc2FnZSB0byB0aGUgc2VydmVyLlxuICAgKiBTaG91bGQgb25seSBiZSBjYWxsZWQgYWZ0ZXIgY29ubmVjdGlvbiBpcyBlc3RhYmxpc2hlZC5cbiAgICogRG8gbm90IGNhbGwgdGhpcyBtYW51YWxseSB1bmxlc3MgeW91IGtub3cgd2hhdCB5b3UgYXJlIGRvaW5nLCB1c2UgPGppZmZfaW5zdGFuY2U+LmNvbm5lY3QoKSBpbnN0ZWFkIVxuICAgKiBAbWV0aG9kXG4gICAqIEBtZW1iZXJvZiBoYW5kbGVyc1xuICAgKi9cbiAgamlmZkNsaWVudC5oYW5kbGVycy5jb25uZWN0ZWQgPSBmdW5jdGlvbiAoKSB7XG4gICAgY29uc29sZS5sb2coJ0Nvbm5lY3RlZCEnLCBqaWZmQ2xpZW50LmlkKTsgLy8gVE9ETzogcmVtb3ZlIGRlYnVnZ2luZ1xuICAgIGppZmZDbGllbnQuaW5pdGlhbGl6YXRpb25fY291bnRlcisrO1xuXG4gICAgaWYgKGppZmZDbGllbnQuc2VjcmV0X2tleSA9PSBudWxsICYmIGppZmZDbGllbnQucHVibGljX2tleSA9PSBudWxsKSB7XG4gICAgICB2YXIga2V5ID0gamlmZkNsaWVudC5ob29rcy5nZW5lcmF0ZUtleVBhaXIoamlmZkNsaWVudCk7XG4gICAgICBqaWZmQ2xpZW50LnNlY3JldF9rZXkgPSBrZXkuc2VjcmV0X2tleTtcbiAgICAgIGppZmZDbGllbnQucHVibGljX2tleSA9IGtleS5wdWJsaWNfa2V5O1xuICAgIH1cblxuICAgIC8vIEluaXRpYWxpemF0aW9uIG1lc3NhZ2VcbiAgICB2YXIgbXNnID0gamlmZkNsaWVudC5oYW5kbGVycy5idWlsZF9pbml0aWFsaXphdGlvbl9tZXNzYWdlKCk7XG5cbiAgICAvLyBFbWl0IGluaXRpYWxpemF0aW9uIG1lc3NhZ2UgdG8gc2VydmVyXG4gICAgamlmZkNsaWVudC5zb2NrZXQuZW1pdCgnaW5pdGlhbGl6YXRpb24nLCBKU09OLnN0cmluZ2lmeShtc2cpKTtcbiAgfTtcblxuICAvKipcbiAgICogQ2FsbGVkIGFmdGVyIHRoZSBzZXJ2ZXIgYXBwcm92ZXMgaW5pdGlhbGl6YXRpb24gb2YgdGhpcyBpbnN0YW5jZS5cbiAgICogU2V0cyB0aGUgaW5zdGFuY2UgaWQsIHRoZSBjb3VudCBvZiBwYXJ0aWVzIGluIHRoZSBjb21wdXRhdGlvbiwgYW5kIHRoZSBwdWJsaWMga2V5c1xuICAgKiBvZiBpbml0aWFsaXplZCBwYXJ0aWVzLlxuICAgKiBAbWV0aG9kXG4gICAqIEBtZW1iZXJvZiBoYW5kbGVyc1xuICAgKi9cbiAgamlmZkNsaWVudC5oYW5kbGVycy5pbml0aWFsaXplZCA9IGZ1bmN0aW9uIChtc2cpIHtcbiAgICBqaWZmQ2xpZW50Ll9faW5pdGlhbGl6ZWQgPSB0cnVlO1xuICAgIGppZmZDbGllbnQuaW5pdGlhbGl6YXRpb25fY291bnRlciA9IDA7XG5cbiAgICBtc2cgPSBKU09OLnBhcnNlKG1zZyk7XG4gICAgbXNnID0gamlmZkNsaWVudC5ob29rcy5leGVjdXRlX2FycmF5X2hvb2tzKCdhZnRlck9wZXJhdGlvbicsIFtqaWZmQ2xpZW50LCAnaW5pdGlhbGl6YXRpb24nLCBtc2ddLCAyKTtcblxuICAgIGppZmZDbGllbnQuaWQgPSBtc2cucGFydHlfaWQ7XG4gICAgamlmZkNsaWVudC5wYXJ0eV9jb3VudCA9IG1zZy5wYXJ0eV9jb3VudDtcblxuICAgIC8vIE5vdzogKDEpIHRoaXMgcGFydHkgaXMgY29ubmVjdCAoMikgc2VydmVyIChhbmQgb3RoZXIgcGFydGllcykga25vdyB0aGlzIHB1YmxpYyBrZXlcbiAgICAvLyBSZXNlbmQgYWxsIHBlbmRpbmcgbWVzc2FnZXNcbiAgICBqaWZmQ2xpZW50LnNvY2tldC5yZXNlbmRfbWFpbGJveCgpO1xuXG4gICAgLy8gc3RvcmUgdGhlIHJlY2VpdmVkIHB1YmxpYyBrZXlzIGFuZCByZXNvbHZlIHdhaXQgY2FsbGJhY2tzXG4gICAgamlmZkNsaWVudC5oYW5kbGVycy5zdG9yZV9wdWJsaWNfa2V5cyhtc2cucHVibGljX2tleXMpO1xuICB9O1xuXG4gIC8qKlxuICAgKiBQYXJzZSBhbmQgc3RvcmUgdGhlIGdpdmVuIHB1YmxpYyBrZXlzXG4gICAqIEBtZXRob2RcbiAgICogQG1lbWJlcm9mIGhhbmRsZXJzXG4gICAqIEBwYXJhbSB7b2JqZWN0fSBrZXltYXAgLSBtYXBzIHBhcnR5IGlkIHRvIHNlcmlhbGl6ZWQgcHVibGljIGtleS5cbiAgICovXG4gIGppZmZDbGllbnQuaGFuZGxlcnMuc3RvcmVfcHVibGljX2tleXMgPSBmdW5jdGlvbiAoa2V5bWFwKSB7XG4gICAgdmFyIGk7XG4gICAgZm9yIChpIGluIGtleW1hcCkge1xuICAgICAgaWYgKGtleW1hcC5oYXNPd25Qcm9wZXJ0eShpKSAmJiBqaWZmQ2xpZW50LmtleW1hcFtpXSA9PSBudWxsKSB7XG4gICAgICAgIGppZmZDbGllbnQua2V5bWFwW2ldID0gamlmZkNsaWVudC5ob29rcy5wYXJzZUtleShqaWZmQ2xpZW50LCBrZXltYXBbaV0pO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIFJlc29sdmUgYW55IHBlbmRpbmcgbWVzc2FnZXMgdGhhdCB3ZXJlIHJlY2VpdmVkIGJlZm9yZSB0aGUgc2VuZGVyJ3MgcHVibGljIGtleSB3YXMga25vd25cbiAgICBqaWZmQ2xpZW50LnJlc29sdmVfbWVzc2FnZXNfd2FpdGluZ19mb3Jfa2V5cygpO1xuXG4gICAgLy8gUmVzb2x2ZSBhbnkgcGVuZGluZyB3YWl0cyB0aGF0IGhhdmUgc2F0aXNmaWVkIGNvbmRpdGlvbnNcbiAgICBqaWZmQ2xpZW50LmV4ZWN1dGVfd2FpdF9jYWxsYmFja3MoKTtcblxuICAgIC8vIENoZWNrIGlmIGFsbCBrZXlzIGhhdmUgYmVlbiByZWNlaXZlZFxuICAgIGlmIChqaWZmQ2xpZW50LmtleW1hcFsnczEnXSA9PSBudWxsKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGZvciAoaSA9IDE7IGkgPD0gamlmZkNsaWVudC5wYXJ0eV9jb3VudDsgaSsrKSB7XG4gICAgICBpZiAoamlmZkNsaWVudC5rZXltYXBbaV0gPT0gbnVsbCkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gYWxsIHBhcnRpZXMgYXJlIGNvbm5lY3RlZDsgZXhlY3V0ZSBjYWxsYmFja1xuICAgIGlmIChqaWZmQ2xpZW50Ll9fcmVhZHkgIT09IHRydWUgJiYgamlmZkNsaWVudC5fX2luaXRpYWxpemVkKSB7XG4gICAgICBqaWZmQ2xpZW50Ll9fcmVhZHkgPSB0cnVlO1xuICAgICAgaWYgKGppZmZDbGllbnQub3B0aW9ucy5vbkNvbm5lY3QgIT0gbnVsbCkge1xuICAgICAgICBqaWZmQ2xpZW50Lm9wdGlvbnMub25Db25uZWN0KGppZmZDbGllbnQpO1xuICAgICAgfVxuICAgIH1cbiAgfTtcbn07IiwiLy8gYWRkcyBzaGFyaW5nIHJlbGF0ZWQgaGFuZGxlcnNcbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKGppZmZDbGllbnQpIHtcbiAgLyoqXG4gICAqIFN0b3JlIHRoZSByZWNlaXZlZCBzaGFyZSBhbmQgcmVzb2x2ZXMgdGhlIGNvcnJlc3BvbmRpbmdcbiAgICogZGVmZXJyZWQgaWYgbmVlZGVkLlxuICAgKiBAbWV0aG9kXG4gICAqIEBtZW1iZXJvZiBoYW5kbGVyc1xuICAgKiBAcGFyYW0ge29iamVjdH0ganNvbl9tc2cgLSB0aGUgcGFyc2VkIGpzb24gbWVzc2FnZSBhcyByZWNlaXZlZC5cbiAgICovXG4gIGppZmZDbGllbnQuaGFuZGxlcnMucmVjZWl2ZV9zaGFyZSA9IGZ1bmN0aW9uIChqc29uX21zZykge1xuICAgIC8vIERlY3J5cHQgc2hhcmVcbiAgICBsZXQgZGVjcnlwdGVkID0gamlmZkNsaWVudC5ob29rcy5kZWNyeXB0U2lnbihqaWZmQ2xpZW50LCBqc29uX21zZ1snc2hhcmUnXSwgamlmZkNsaWVudC5zZWNyZXRfa2V5LCBqaWZmQ2xpZW50LmtleW1hcFtqc29uX21zZ1sncGFydHlfaWQnXV0pO1xuICAgIFxuICAgIHZhciByZWFkeSA9IGZ1bmN0aW9uIChkZWNyeXB0ZWQpIHtcbiAgICAgIGpzb25fbXNnWydzaGFyZSddID0gZGVjcnlwdGVkO1xuICAgICAganNvbl9tc2cgPSBqaWZmQ2xpZW50Lmhvb2tzLmV4ZWN1dGVfYXJyYXlfaG9va3MoJ2FmdGVyT3BlcmF0aW9uJywgW2ppZmZDbGllbnQsICdzaGFyZScsIGpzb25fbXNnXSwgMik7XG5cbiAgICAgIHZhciBzZW5kZXJfaWQgPSBqc29uX21zZ1sncGFydHlfaWQnXTtcbiAgICAgIHZhciBvcF9pZCA9IGpzb25fbXNnWydvcF9pZCddO1xuICAgICAgdmFyIHNoYXJlID0ganNvbl9tc2dbJ3NoYXJlJ107XG5cbiAgICAgIC8vIENhbGwgaG9va1xuICAgICAgc2hhcmUgPSBqaWZmQ2xpZW50Lmhvb2tzLmV4ZWN1dGVfYXJyYXlfaG9va3MoJ3JlY2VpdmVTaGFyZScsIFtqaWZmQ2xpZW50LCBzZW5kZXJfaWQsIHNoYXJlXSwgMik7XG5cbiAgICAgIC8vIGNoZWNrIGlmIGEgZGVmZXJyZWQgaXMgc2V0IHVwIChtYXliZSB0aGUgc2hhcmUgd2FzIHJlY2VpdmVkIGVhcmx5KVxuICAgICAgaWYgKGppZmZDbGllbnQuZGVmZXJyZWRzW29wX2lkXSA9PSBudWxsKSB7XG4gICAgICAgIGppZmZDbGllbnQuZGVmZXJyZWRzW29wX2lkXSA9IHt9O1xuICAgICAgfVxuICAgICAgaWYgKGppZmZDbGllbnQuZGVmZXJyZWRzW29wX2lkXVtzZW5kZXJfaWRdID09IG51bGwpIHtcbiAgICAgICAgLy8gU2hhcmUgaXMgcmVjZWl2ZWQgYmVmb3JlIGRlZmVycmVkIHdhcyBzZXR1cCwgc3RvcmUgaXQuXG4gICAgICAgIGppZmZDbGllbnQuZGVmZXJyZWRzW29wX2lkXVtzZW5kZXJfaWRdID0gbmV3IGppZmZDbGllbnQuaGVscGVycy5EZWZlcnJlZCgpO1xuICAgICAgfVxuXG4gICAgICAvLyBEZWZlcnJlZCBpcyBhbHJlYWR5IHNldHVwLCByZXNvbHZlIGl0LlxuICAgICAgamlmZkNsaWVudC5kZWZlcnJlZHNbb3BfaWRdW3NlbmRlcl9pZF0ucmVzb2x2ZShzaGFyZSk7XG4gICAgfVxuXG4gICAgaWYgKGRlY3J5cHRlZC50aGVuKSB7XG4gICAgICBkZWNyeXB0ZWQudGhlbihyZWFkeSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJlYWR5KGRlY3J5cHRlZCk7XG4gICAgfVxuICB9O1xuXG4gIC8qKlxuICAgKiBSZXNvbHZlcyB0aGUgZGVmZXJyZWQgY29ycmVzcG9uZGluZyB0byBvcGVyYXRpb25faWQgYW5kIHNlbmRlcl9pZC5cbiAgICogQG1ldGhvZFxuICAgKiBAbWVtYmVyb2YgaGFuZGxlcnNcbiAgICogQHBhcmFtIHtvYmplY3R9IGpzb25fbXNnIC0gdGhlIGpzb24gbWVzc2FnZSBhcyByZWNlaXZlZCB3aXRoIHRoZSBvcGVuIGV2ZW50LlxuICAgKi9cbiAgamlmZkNsaWVudC5oYW5kbGVycy5yZWNlaXZlX29wZW4gPSBmdW5jdGlvbiAoanNvbl9tc2cpIHtcbiAgICAvLyBEZWNyeXB0IHNoYXJlXG4gICAgaWYgKGpzb25fbXNnWydwYXJ0eV9pZCddICE9PSBqaWZmQ2xpZW50LmlkKSB7XG4gICAgICBqc29uX21zZ1snc2hhcmUnXSA9IGppZmZDbGllbnQuaG9va3MuZGVjcnlwdFNpZ24oamlmZkNsaWVudCwganNvbl9tc2dbJ3NoYXJlJ10sIGppZmZDbGllbnQuc2VjcmV0X2tleSwgamlmZkNsaWVudC5rZXltYXBbanNvbl9tc2dbJ3BhcnR5X2lkJ11dKTtcbiAgICAgIGpzb25fbXNnID0gamlmZkNsaWVudC5ob29rcy5leGVjdXRlX2FycmF5X2hvb2tzKCdhZnRlck9wZXJhdGlvbicsIFtqaWZmQ2xpZW50LCAnb3BlbicsIGpzb25fbXNnXSwgMik7XG4gICAgfVxuXG4gICAgdmFyIHNlbmRlcl9pZCA9IGpzb25fbXNnWydwYXJ0eV9pZCddO1xuICAgIHZhciBvcF9pZCA9IGpzb25fbXNnWydvcF9pZCddO1xuICAgIHZhciBzaGFyZSA9IGpzb25fbXNnWydzaGFyZSddO1xuICAgIHZhciBacCA9IGpzb25fbXNnWydacCddO1xuXG4gICAgLy8gY2FsbCBob29rXG4gICAgc2hhcmUgPSBqaWZmQ2xpZW50Lmhvb2tzLmV4ZWN1dGVfYXJyYXlfaG9va3MoJ3JlY2VpdmVPcGVuJywgW2ppZmZDbGllbnQsIHNlbmRlcl9pZCwgc2hhcmUsIFpwXSwgMik7XG5cbiAgICAvLyBFbnN1cmUgZGVmZXJyZWQgaXMgc2V0dXBcbiAgICBpZiAoamlmZkNsaWVudC5kZWZlcnJlZHNbb3BfaWRdID09IG51bGwpIHtcbiAgICAgIGppZmZDbGllbnQuZGVmZXJyZWRzW29wX2lkXSA9IHt9O1xuICAgIH1cbiAgICBpZiAoamlmZkNsaWVudC5kZWZlcnJlZHNbb3BfaWRdLnNoYXJlcyA9PSBudWxsKSB7XG4gICAgICBqaWZmQ2xpZW50LmRlZmVycmVkc1tvcF9pZF0uc2hhcmVzID0gW107XG4gICAgfVxuXG4gICAgLy8gQWNjdW11bGF0ZSByZWNlaXZlZCBzaGFyZXNcbiAgICBqaWZmQ2xpZW50LmRlZmVycmVkc1tvcF9pZF0uc2hhcmVzLnB1c2goe3ZhbHVlOiBzaGFyZSwgc2VuZGVyX2lkOiBzZW5kZXJfaWQsIFpwOiBacH0pO1xuXG4gICAgLy8gUmVzb2x2ZSB3aGVuIHJlYWR5XG4gICAgaWYgKGppZmZDbGllbnQuZGVmZXJyZWRzW29wX2lkXS5zaGFyZXMubGVuZ3RoID09PSBqaWZmQ2xpZW50LmRlZmVycmVkc1tvcF9pZF0udGhyZXNob2xkKSB7XG4gICAgICBqaWZmQ2xpZW50LmRlZmVycmVkc1tvcF9pZF0uZGVmZXJyZWQucmVzb2x2ZSgpO1xuICAgIH1cblxuICAgIC8vIENsZWFuIHVwIGlmIGRvbmVcbiAgICBpZiAoamlmZkNsaWVudC5kZWZlcnJlZHNbb3BfaWRdICE9IG51bGwgJiYgamlmZkNsaWVudC5kZWZlcnJlZHNbb3BfaWRdLmRlZmVycmVkID09PSAnQ0xFQU4nICYmIGppZmZDbGllbnQuZGVmZXJyZWRzW29wX2lkXS5zaGFyZXMubGVuZ3RoID09PSBqaWZmQ2xpZW50LmRlZmVycmVkc1tvcF9pZF0udG90YWwpIHtcbiAgICAgIGRlbGV0ZSBqaWZmQ2xpZW50LmRlZmVycmVkc1tvcF9pZF07XG4gICAgfVxuICB9XG59OyIsIi8qKiBEb3VibHkgbGlua2VkIGxpc3Qgd2l0aCBhZGQgYW5kIHJlbW92ZSBmdW5jdGlvbnMgYW5kIHBvaW50ZXJzIHRvIGhlYWQgYW5kIHRhaWwqKi9cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKCkge1xuICAvLyBhdHRyaWJ1dGVzOiBsaXN0LmhlYWQgYW5kIGxpc3QudGFpbFxuICAvLyBmdW5jdGlvbnM6IGxpc3QuYWRkKG9iamVjdCkgKHJldHVybnMgcG9pbnRlciksIGxpc3QucmVtb3ZlKHBvaW50ZXIpXG4gIC8vIGxpc3QuaGVhZC9saXN0LnRhaWwvYW55IGVsZW1lbnQgY29udGFpbnM6XG4gIC8vICAgIG5leHQ6IHBvaW50ZXIgdG8gbmV4dCxcbiAgLy8gICAgcHJldmlvdXM6IHBvaW50ZXIgdG8gcHJldmlvdXMsXG4gIC8vICAgIG9iamVjdDogc3RvcmVkIG9iamVjdC5cbiAgdmFyIGxpc3QgPSB7aGVhZDogbnVsbCwgdGFpbDogbnVsbH07XG4gIC8vIFRPRE8gcmVuYW1lIHRoaXMgdG8gcHVzaFRhaWwgfHwgcHVzaFxuICBsaXN0LmFkZCA9IGZ1bmN0aW9uIChvYmopIHtcbiAgICB2YXIgbm9kZSA9IHsgb2JqZWN0OiBvYmosIG5leHQ6IG51bGwsIHByZXZpb3VzOiBudWxsIH07XG4gICAgaWYgKGxpc3QuaGVhZCA9PSBudWxsKSB7XG4gICAgICBsaXN0LmhlYWQgPSBub2RlO1xuICAgICAgbGlzdC50YWlsID0gbm9kZTtcbiAgICB9IGVsc2Uge1xuICAgICAgbGlzdC50YWlsLm5leHQgPSBub2RlO1xuICAgICAgbm9kZS5wcmV2aW91cyA9IGxpc3QudGFpbDtcbiAgICAgIGxpc3QudGFpbCA9IG5vZGU7XG4gICAgfVxuICAgIHJldHVybiBub2RlO1xuICB9O1xuXG4gIGxpc3QucHVzaEhlYWQgPSBmdW5jdGlvbiAob2JqKSB7XG4gICAgbGlzdC5oZWFkID0ge29iamVjdDogb2JqLCBuZXh0IDogbGlzdC5oZWFkLCBwcmV2aW91cyA6IG51bGx9O1xuICAgIGlmIChsaXN0LmhlYWQubmV4dCAhPSBudWxsKSB7XG4gICAgICBsaXN0LmhlYWQubmV4dC5wcmV2aW91cyA9IGxpc3QuaGVhZDtcbiAgICB9IGVsc2Uge1xuICAgICAgbGlzdC50YWlsID0gbGlzdC5oZWFkO1xuICAgIH1cbiAgfTtcblxuICBsaXN0LnBvcEhlYWQgPSBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHJlc3VsdCA9IGxpc3QuaGVhZDtcbiAgICBpZiAobGlzdC5oZWFkICE9IG51bGwpIHtcbiAgICAgIGxpc3QuaGVhZCA9IGxpc3QuaGVhZC5uZXh0O1xuICAgICAgaWYgKGxpc3QuaGVhZCA9PSBudWxsKSB7XG4gICAgICAgIGxpc3QudGFpbCA9IG51bGw7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBsaXN0LmhlYWQucHJldmlvdXMgID0gbnVsbDtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfTtcblxuICAvLyBtZXJnZXMgdHdvIGxpbmtlZCBsaXN0cyBhbmQgcmV0dXJuIGEgcG9pbnRlciB0byB0aGUgaGVhZCBvZiB0aGUgbWVyZ2VkIGxpc3RcbiAgLy8gdGhlIGhlYWQgd2lsbCBiZSB0aGUgaGVhZCBvZiBsaXN0IGFuZCB0aGUgdGFpbCB0aGUgdGFpbCBvZiBsMlxuICBsaXN0LmV4dGVuZCA9IGZ1bmN0aW9uIChsMikge1xuICAgIGlmIChsaXN0LmhlYWQgPT0gbnVsbCkge1xuICAgICAgcmV0dXJuIGwyO1xuICAgIH1cbiAgICBpZiAobDIuaGVhZCA9PSBudWxsKSB7XG4gICAgICByZXR1cm4gbGlzdDtcbiAgICB9XG4gICAgbGlzdC50YWlsLm5leHQgPSBsMi5oZWFkO1xuICAgIGwyLmhlYWQucHJldmlvdXMgPSBsaXN0LnRhaWw7XG4gICAgbGlzdC50YWlsID0gbDIudGFpbDtcblxuICAgIHJldHVybiBsaXN0O1xuICB9O1xuXG4gIGxpc3QucmVtb3ZlID0gZnVuY3Rpb24gKHB0cikge1xuICAgIHZhciBwcmV2ID0gcHRyLnByZXZpb3VzO1xuICAgIHZhciBuZXh0ID0gcHRyLm5leHQ7XG5cbiAgICBpZiAocHJldiA9PSBudWxsICYmIGxpc3QuaGVhZCAhPT0gcHRyKSB7XG4gICAgICByZXR1cm47XG4gICAgfSBlbHNlIGlmIChuZXh0ID09IG51bGwgJiYgbGlzdC50YWlsICE9PSBwdHIpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAocHJldiA9PSBudWxsKSB7IC8vIHB0ciBpcyBoZWFkIChvciBib3RoIGhlYWQgYW5kIHRhaWwpXG4gICAgICBsaXN0LmhlYWQgPSBuZXh0O1xuICAgICAgaWYgKGxpc3QuaGVhZCAhPSBudWxsKSB7XG4gICAgICAgIGxpc3QuaGVhZC5wcmV2aW91cyA9IG51bGw7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBsaXN0LnRhaWwgPSBudWxsO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAobmV4dCA9PSBudWxsKSB7IC8vIHB0ciBpcyB0YWlsIChhbmQgbm90IGhlYWQpXG4gICAgICBsaXN0LnRhaWwgPSBwcmV2O1xuICAgICAgcHJldi5uZXh0ID0gbnVsbDtcbiAgICB9IGVsc2UgeyAvLyBwdHIgaXMgaW5zaWRlXG4gICAgICBwcmV2Lm5leHQgPSBuZXh0O1xuICAgICAgbmV4dC5wcmV2aW91cyA9IHByZXY7XG4gICAgfVxuICB9O1xuICBsaXN0LnNsaWNlID0gZnVuY3Rpb24gKHB0cikgeyAvLyByZW1vdmUgYWxsIGVsZW1lbnRzIGZyb20gaGVhZCB0byBwdHIgKGluY2x1ZGluZyBwdHIpLlxuICAgIGlmIChwdHIgPT0gbnVsbCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8qIENPTlNFUlZBVElWRTogbWFrZSBzdXJlIHB0ciBpcyBwYXJ0IG9mIHRoZSBsaXN0IHRoZW4gcmVtb3ZlICovXG4gICAgdmFyIGN1cnJlbnQgPSBsaXN0LmhlYWQ7XG4gICAgd2hpbGUgKGN1cnJlbnQgIT0gbnVsbCkge1xuICAgICAgaWYgKGN1cnJlbnQgPT09IHB0cikge1xuICAgICAgICBsaXN0LmhlYWQgPSBwdHIubmV4dDtcbiAgICAgICAgaWYgKGxpc3QuaGVhZCA9PSBudWxsKSB7XG4gICAgICAgICAgbGlzdC50YWlsID0gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIGN1cnJlbnQgPSBjdXJyZW50Lm5leHQ7XG4gICAgfVxuXG4gICAgLyogTU9SRSBBR0dSRVNTSVZFIFZFUlNJT046IHdpbGwgYmUgaW5jb3JyZWN0IGlmIHB0ciBpcyBub3QgaW4gdGhlIGxpc3QgKi9cbiAgICAvKlxuICAgIGxpc3QuaGVhZCA9IHB0ci5uZXh0O1xuICAgIGlmIChsaXN0LmhlYWQgPT0gbnVsbCkge1xuICAgICAgbGlzdC50YWlsID0gbnVsbDtcbiAgICB9XG4gICAgKi9cbiAgfTtcbiAgLypcbiAgbGlzdC5fZGVidWdfbGVuZ3RoID0gZnVuY3Rpb24gKCkge1xuICAgIHZhciBsID0gMDtcbiAgICB2YXIgY3VycmVudCA9IGxpc3QuaGVhZDtcbiAgICB3aGlsZSAoY3VycmVudCAhPSBudWxsKSB7XG4gICAgICBjdXJyZW50ID0gY3VycmVudC5uZXh0O1xuICAgICAgbCsrO1xuICAgIH1cbiAgICByZXR1cm4gbDtcbiAgfTtcbiAgKi9cbiAgcmV0dXJuIGxpc3Q7XG59O1xuIiwiLyoqXG4gKiBUaGlzIGRlZmluZXMgYSBsaWJyYXJ5IGV4dGVuc2lvbiBmb3IgdXNpbmcgd2Vic29ja2V0cyByYXRoZXIgdGhhbiBzb2NrZXQuaW8gZm9yIGNvbW11bmljYXRpb24uIFRoaXNcbiAqIGV4dGVuc2lvbiBwcmltYXJpbHkgZWRpdHMvb3ZlcndyaXRlcyBleGlzdGluZyBzb2NrZXQgZnVuY3Rpb25zIHRvIHVzZSBhbmQgYmUgY29tcGF0aWJsZSB3aXRoIHRoZVxuICogd3MgbGlicmFyeS5cbiAqIEBuYW1lc3BhY2UgamlmZmNsaWVudF93ZWJzb2NrZXRzXG4gKiBAdmVyc2lvbiAxLjBcbiAqXG4gKiBSRVFVSVJFTUVOVFM6XG4gKiBZb3UgbXVzdCBhcHBseSB0aGlzIGV4dGVuc2lvbiB0byB5b3VyIGNsaWVudCBhbmQgdGhlIHNlcnZlciB5b3UncmUgY29tbXVuaWNhdGluZyB3aXRoIG11c3QgYXBwbHkgamlmZnNlcnZlcl93ZWJzb2NrZXRzLlxuICogV2hlbiB1c2luZyB0aGlzIGV4dGVuc2lvbiBpbiBicm93c2VyLCBcIi9kaXN0L2ppZmYtY2xpZW50LXdlYnNvY2tldHMuanNcIiBtdXN0IGJlIGxvYWRlZCBpbiBjbGllbnQuaHRtbCBpbnN0ZWFkIG9mIHRoaXMgZmlsZS5cbiAqL1xuXG5cblxuKGZ1bmN0aW9uIChleHBvcnRzLCBub2RlKSB7XG4gIC8qKlxuICAgKiBUaGUgbmFtZSBvZiB0aGlzIGV4dGVuc2lvbjogJ3dlYnNvY2tldCdcbiAgICogQHR5cGUge3N0cmluZ31cbiAgICogQG1lbWJlck9mIGppZmZjbGllbnRfd2Vic29ja2V0c1xuICAgKi9cblxuICB2YXIgd3M7XG4gIHZhciBsaW5rZWRMaXN0O1xuICB2YXIgaGFuZGxlcnM7XG5cbiAgbGlua2VkTGlzdCA9IHJlcXVpcmUoJy4uL2NvbW1vbi9saW5rZWRsaXN0LmpzJyk7XG4gIGhhbmRsZXJzID0gcmVxdWlyZSgnLi4vY2xpZW50L2hhbmRsZXJzLmpzJyk7XG4gIGlmICghcHJvY2Vzcy5icm93c2VyKSB7XG4gICAgd3MgPSByZXF1aXJlKCd3cycpO1xuICB9IGVsc2Uge1xuICAgIGlmICh0eXBlb2YgV2ViU29ja2V0ICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgd3MgPSBXZWJTb2NrZXRcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBNb3pXZWJTb2NrZXQgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICB3cyA9IE1veldlYlNvY2tldFxuICAgIH0gZWxzZSBpZiAodHlwZW9mIGdsb2JhbCAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgIHdzID0gZ2xvYmFsLldlYlNvY2tldCB8fCBnbG9iYWwuTW96V2ViU29ja2V0XG4gICAgfSBlbHNlIGlmICh0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgd3MgPSB3aW5kb3cuV2ViU29ja2V0IHx8IHdpbmRvdy5Nb3pXZWJTb2NrZXRcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBzZWxmICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgd3MgPSBzZWxmLldlYlNvY2tldCB8fCBzZWxmLk1veldlYlNvY2tldFxuICAgIH1cbiAgfVxuXG5cbiAgLy8gVGFrZSB0aGUgamlmZi1jbGllbnQgYmFzZSBpbnN0YW5jZSBhbmQgb3B0aW9ucyBmb3IgdGhpcyBleHRlbnNpb24sIGFuZCB1c2UgdGhlbVxuICAvLyB0byBjb25zdHJ1Y3QgYW4gaW5zdGFuY2UgZm9yIHRoaXMgZXh0ZW5zaW9uLlxuICBmdW5jdGlvbiBtYWtlX2ppZmYoYmFzZV9pbnN0YW5jZSwgb3B0aW9ucykge1xuICAgIHZhciBqaWZmID0gYmFzZV9pbnN0YW5jZTtcblxuICAgIC8vIFBhcnNlIG9wdGlvbnNcbiAgICBpZiAob3B0aW9ucyA9PSBudWxsKSB7XG4gICAgICBvcHRpb25zID0ge307XG4gICAgfVxuXG4gICAgLyogRnVuY3Rpb25zIHRoYXQgb3ZlcndyaXRlIGNsaWVudC9zb2NrZXQvZXZlbnRzLmpzIGZ1bmN0aW9uYWxpdHkgKi9cblxuICAgIC8qKlxuICAgICAqIGluaXRTb2NrZXQncyAnLm9uJyBmdW5jdGlvbnMgbmVlZGVkIHRvIGJlIHJlcGxhY2VkIHNpbmNlIHdzIGRvZXNcbiAgICAgKiBub3QgaGF2ZSBhcyBtYW55IHByb3RvY29scy4gSW5zdGVhZCB0aGVzZSBmdW5jdGlvbnMgYXJlIHJvdXRlZCB0b1xuICAgICAqIHdoZW4gYSBtZXNzYWdlIGlzIHJlY2VpdmVkIGFuZCBhIHByb3RvY29sIGlzIG1hbnVhbGx5IHBhcnNlZC5cbiAgICAgKi9cbiAgICBqaWZmLmluaXRTb2NrZXQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICB2YXIgamlmZkNsaWVudCA9IHRoaXM7XG5cbiAgICAgIC8qIHdzIHVzZXMgdGhlICdvcGVuJyBwcm90b2NvbCBvbiBjb25uZWN0aW9uLiBTaG91bGQgbm90IGNvbmZsaWN0IHdpdGggdGhlXG4gICAgICAgICAgIEpJRkYgb3BlbiBwcm90b2NsIGFzIHRoYXQgd2lsbCBiZSBzZW50IGFzIGEgbWVzc2FnZSBhbmQgd3NcbiAgICAgICAgICAgd2lsbCBzZWUgaXQgYXMgYSAnbWVzc2FnZScgcHJvdG9jb2wuICovXG4gICAgICB0aGlzLnNvY2tldC5vbm9wZW4gPSBqaWZmQ2xpZW50LmhhbmRsZXJzLmNvbm5lY3RlZDtcblxuICAgICAgLy8gUHVibGljIGtleXMgd2VyZSB1cGRhdGVkIG9uIHRoZSBzZXJ2ZXIsIGFuZCBpdCBzZW50IHVzIHRoZSB1cGRhdGVzXG4gICAgICBmdW5jdGlvbiBwdWJsaWNLZXlzQ2hhbmdlZChtc2csIGNhbGxiYWNrKSB7XG5cbiAgICAgICAgbXNnID0gSlNPTi5wYXJzZShtc2cpO1xuICAgICAgICBtc2cgPSBqaWZmQ2xpZW50Lmhvb2tzLmV4ZWN1dGVfYXJyYXlfaG9va3MoJ2FmdGVyT3BlcmF0aW9uJywgW2ppZmZDbGllbnQsICdwdWJsaWNfa2V5cycsIG1zZ10sIDIpO1xuXG4gICAgICAgIGppZmZDbGllbnQuaGFuZGxlcnMuc3RvcmVfcHVibGljX2tleXMobXNnLnB1YmxpY19rZXlzKTtcbiAgICAgIH1cblxuICAgICAgLy8gU2V0dXAgcmVjZWl2aW5nIG1hdGNoaW5nIHNoYXJlc1xuICAgICAgZnVuY3Rpb24gc2hhcmUobXNnLCBjYWxsYmFjaykge1xuXG4gICAgICAgIC8vIHBhcnNlIG1lc3NhZ2VcbiAgICAgICAgdmFyIGpzb25fbXNnID0gSlNPTi5wYXJzZShtc2cpO1xuICAgICAgICB2YXIgc2VuZGVyX2lkID0ganNvbl9tc2dbJ3BhcnR5X2lkJ107XG5cbiAgICAgICAgaWYgKGppZmZDbGllbnQua2V5bWFwW3NlbmRlcl9pZF0gIT0gbnVsbCkge1xuICAgICAgICAgIGppZmZDbGllbnQuaGFuZGxlcnMucmVjZWl2ZV9zaGFyZShqc29uX21zZyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgaWYgKGppZmZDbGllbnQubWVzc2FnZXNXYWl0aW5nS2V5c1tzZW5kZXJfaWRdID09IG51bGwpIHtcbiAgICAgICAgICAgIGppZmZDbGllbnQubWVzc2FnZXNXYWl0aW5nS2V5c1tzZW5kZXJfaWRdID0gW107XG4gICAgICAgICAgfVxuICAgICAgICAgIGppZmZDbGllbnQubWVzc2FnZXNXYWl0aW5nS2V5c1tzZW5kZXJfaWRdLnB1c2goeyBsYWJlbDogJ3NoYXJlJywgbXNnOiBqc29uX21zZyB9KTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBmdW5jdGlvbiBtcGNPcGVuKG1zZywgY2FsbGJhY2spIHtcbiAgICAgICAgLy8gcGFyc2UgbWVzc2FnZVxuICAgICAgICB2YXIganNvbl9tc2cgPSBKU09OLnBhcnNlKG1zZyk7XG4gICAgICAgIHZhciBzZW5kZXJfaWQgPSBqc29uX21zZ1sncGFydHlfaWQnXTtcblxuICAgICAgICBpZiAoamlmZkNsaWVudC5rZXltYXBbc2VuZGVyX2lkXSAhPSBudWxsKSB7XG4gICAgICAgICAgamlmZkNsaWVudC5oYW5kbGVycy5yZWNlaXZlX29wZW4oanNvbl9tc2cpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGlmIChqaWZmQ2xpZW50Lm1lc3NhZ2VzV2FpdGluZ0tleXNbc2VuZGVyX2lkXSA9PSBudWxsKSB7XG4gICAgICAgICAgICBqaWZmQ2xpZW50Lm1lc3NhZ2VzV2FpdGluZ0tleXNbc2VuZGVyX2lkXSA9IFtdO1xuICAgICAgICAgIH1cbiAgICAgICAgICBqaWZmQ2xpZW50Lm1lc3NhZ2VzV2FpdGluZ0tleXNbc2VuZGVyX2lkXS5wdXNoKHsgbGFiZWw6ICdvcGVuJywgbXNnOiBqc29uX21zZyB9KTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAvLyBoYW5kbGUgY3VzdG9tIG1lc3NhZ2VzXG4gICAgICBmdW5jdGlvbiBzb2NrZXRDdXN0b20obXNnLCBjYWxsYmFjaykge1xuICAgICAgICB2YXIganNvbl9tc2cgPSBKU09OLnBhcnNlKG1zZyk7XG4gICAgICAgIHZhciBzZW5kZXJfaWQgPSBqc29uX21zZ1sncGFydHlfaWQnXTtcbiAgICAgICAgdmFyIGVuY3J5cHRlZCA9IGpzb25fbXNnWydlbmNyeXB0ZWQnXTtcblxuICAgICAgICBpZiAoamlmZkNsaWVudC5rZXltYXBbc2VuZGVyX2lkXSAhPSBudWxsIHx8IGVuY3J5cHRlZCAhPT0gdHJ1ZSkge1xuICAgICAgICAgIGppZmZDbGllbnQuaGFuZGxlcnMucmVjZWl2ZV9jdXN0b20oanNvbl9tc2cpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIGtleSBtdXN0IG5vdCBleGlzdCB5ZXQgZm9yIHNlbmRlcl9pZCwgYW5kIGVuY3J5cHRlZCBtdXN0IGJlIHRydWVcbiAgICAgICAgICBpZiAoamlmZkNsaWVudC5tZXNzYWdlc1dhaXRpbmdLZXlzW3NlbmRlcl9pZF0gPT0gbnVsbCkge1xuICAgICAgICAgICAgamlmZkNsaWVudC5tZXNzYWdlc1dhaXRpbmdLZXlzW3NlbmRlcl9pZF0gPSBbXTtcbiAgICAgICAgICB9XG4gICAgICAgICAgamlmZkNsaWVudC5tZXNzYWdlc1dhaXRpbmdLZXlzW3NlbmRlcl9pZF0ucHVzaCh7IGxhYmVsOiAnY3VzdG9tJywgbXNnOiBqc29uX21zZyB9KTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBmdW5jdGlvbiBjcnlwdG9Qcm92aWRlcihtc2csIGNhbGxiYWNrKSB7XG4gICAgICAgIGppZmZDbGllbnQuaGFuZGxlcnMucmVjZWl2ZV9jcnlwdG9fcHJvdmlkZXIoSlNPTi5wYXJzZShtc2cpKTtcbiAgICAgIH1cblxuICAgICAgZnVuY3Rpb24gb25FcnJvcihtc2cpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBtc2cgPSBKU09OLnBhcnNlKG1zZyk7XG4gICAgICAgICAgamlmZkNsaWVudC5oYW5kbGVycy5lcnJvcihtc2dbJ2xhYmVsJ10sIG1zZ1snZXJyb3InXSk7XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgamlmZkNsaWVudC5oYW5kbGVycy5lcnJvcignc29ja2V0LmlvJywgbXNnKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBmdW5jdGlvbiBzb2NrZXRDbG9zZShyZWFzb24pIHtcbiAgICAgICAgaWYgKHJlYXNvbiAhPT0gJ2lvIGNsaWVudCBkaXNjb25uZWN0Jykge1xuICAgICAgICAgIC8vIGNoZWNrIHRoYXQgdGhlIHJlYXNvbiBpcyBhbiBlcnJvciBhbmQgbm90IGEgdXNlciBpbml0aWF0ZWQgZGlzY29ubmVjdFxuICAgICAgICAgIGNvbnNvbGUubG9nKCdEaXNjb25uZWN0ZWQhJywgamlmZkNsaWVudC5pZCwgcmVhc29uKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGppZmZDbGllbnQuaG9va3MuZXhlY3V0ZV9hcnJheV9ob29rcygnYWZ0ZXJPcGVyYXRpb24nLCBbamlmZkNsaWVudCwgJ2Rpc2Nvbm5lY3QnLCByZWFzb25dLCAtMSk7XG4gICAgICB9XG5cbiAgICAgIHRoaXMuc29ja2V0Lm9uY2xvc2UgPSBmdW5jdGlvbiAocmVhc29uKSB7XG4gICAgICAgIHNvY2tldENsb3NlKHJlYXNvbi5jb2RlKTtcbiAgICAgIH1cblxuICAgICAgLyoqXG4gICAgICAgKiBJbiBldmVyeSBtZXNzYWdlIHNlbnQgb3ZlciB3cywgd2Ugd2lsbCBzZW5kIGFsb25nIHdpdGggaXQgYSBzb2NrZXRQcm90b2NvbCBzdHJpbmdcbiAgICAgICAqIHRoYXQgd2lsbCBiZSBwYXJzZWQgYnkgdGhlIHJlY2VpdmVyIHRvIHJvdXRlIHRoZSByZXF1ZXN0IHRvIHRoZSBjb3JyZWN0IGZ1bmN0aW9uLiBUaGVcbiAgICAgICAqIHByZXZpb3VzIGluZm9ybWF0aW9uIHNlbnQgYnkgc29ja2V0LmlvIHdpbGwgYmUgdW50b3VjaGVkLCBidXQgbm93IHNlbnQgaW5zaWRlIG9mIG1zZy5kYXRhLlxuICAgICAgICovXG4gICAgICB0aGlzLnNvY2tldC5vbm1lc3NhZ2UgPSBmdW5jdGlvbiAobXNnLCBjYWxsYmFjaykge1xuICAgICAgICBtc2cgPSBKU09OLnBhcnNlKG1zZy5kYXRhKTtcblxuICAgICAgICBzd2l0Y2ggKG1zZy5zb2NrZXRQcm90b2NvbCkge1xuICAgICAgICAgIGNhc2UgJ2luaXRpYWxpemF0aW9uJzpcbiAgICAgICAgICAgIGppZmZDbGllbnQuaGFuZGxlcnMuaW5pdGlhbGl6ZWQobXNnLmRhdGEpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgY2FzZSAncHVibGljX2tleXMnOlxuICAgICAgICAgICAgcHVibGljS2V5c0NoYW5nZWQobXNnLmRhdGEsIGNhbGxiYWNrKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIGNhc2UgJ3NoYXJlJzpcbiAgICAgICAgICAgIHNoYXJlKG1zZy5kYXRhLCBjYWxsYmFjayk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBjYXNlICdvcGVuJzpcbiAgICAgICAgICAgIG1wY09wZW4obXNnLmRhdGEsIGNhbGxiYWNrKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIGNhc2UgJ2N1c3RvbSc6XG4gICAgICAgICAgICBzb2NrZXRDdXN0b20obXNnLmRhdGEsIGNhbGxiYWNrKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIGNhc2UgJ2NyeXB0b19wcm92aWRlcic6XG4gICAgICAgICAgICBjcnlwdG9Qcm92aWRlcihtc2cuZGF0YSwgY2FsbGJhY2spO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgY2FzZSAnY2xvc2UnOlxuICAgICAgICAgICAgc29ja2V0Q2xvc2UobXNnLmRhdGEpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgY2FzZSAnZGlzY29ubmVjdCc6XG4gICAgICAgICAgICBzb2NrZXRDbG9zZShtc2cuZGF0YSk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBjYXNlICdlcnJvcic6XG4gICAgICAgICAgICBvbkVycm9yKG1zZy5kYXRhKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICBjb25zb2xlLmxvZygnVWtub3duIHByb3RvY29sLCAnICsgbXNnLnNvY2tldFByb3RvY29sICsgJywgcmVjZWl2ZWQnKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgfTtcblxuICAgIC8qIE92ZXJ3cml0ZSB0aGUgc29ja2V0Q29ubmVjdCBmdW5jdGlvbiBmcm9tIGppZmYtY2xpZW50LmpzICovXG5cbiAgICBqaWZmLnNvY2tldENvbm5lY3QgPSBmdW5jdGlvbiAoSklGRkNsaWVudEluc3RhbmNlKSB7XG5cbiAgICAgIGlmIChvcHRpb25zLl9faW50ZXJuYWxfc29ja2V0ID09IG51bGwpIHtcbiAgICAgICAgLyoqXG4gICAgICAgICAqIFNvY2tldCB3cmFwcGVyIGJldHdlZW4gdGhpcyBpbnN0YW5jZSBhbmQgdGhlIHNlcnZlciwgYmFzZWQgb24gc29ja2V0cy5pb1xuICAgICAgICAgKiBAdHlwZSB7IUd1YXJkZWRTb2NrZXR9XG4gICAgICAgICAqL1xuICAgICAgICBKSUZGQ2xpZW50SW5zdGFuY2Uuc29ja2V0ID0gZ3VhcmRlZFNvY2tldChKSUZGQ2xpZW50SW5zdGFuY2UpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgSklGRkNsaWVudEluc3RhbmNlLnNvY2tldCA9IGludGVybmFsU29ja2V0KEpJRkZDbGllbnRJbnN0YW5jZSwgb3B0aW9ucy5fX2ludGVybmFsX3NvY2tldCk7XG4gICAgICB9XG5cbiAgICAgIC8vIHNldCB1cCBzb2NrZXQgZXZlbnQgaGFuZGxlcnNcbiAgICAgIGhhbmRsZXJzKEpJRkZDbGllbnRJbnN0YW5jZSk7XG5cbiAgICAgIC8vIE92ZXJ3cml0ZSBoYW5kbGVycy5jb25uZWN0ZWQgd2l0aCBvdXIgbmV3IHdzIGNvbm5lY3Rpb24gaGFuZGxlclxuICAgICAgSklGRkNsaWVudEluc3RhbmNlLmhhbmRsZXJzLmNvbm5lY3RlZCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgSklGRkNsaWVudEluc3RhbmNlLmluaXRpYWxpemF0aW9uX2NvdW50ZXIrKztcblxuICAgICAgICBpZiAoSklGRkNsaWVudEluc3RhbmNlLnNlY3JldF9rZXkgPT0gbnVsbCAmJiBKSUZGQ2xpZW50SW5zdGFuY2UucHVibGljX2tleSA9PSBudWxsKSB7XG4gICAgICAgICAgdmFyIGtleSA9IEpJRkZDbGllbnRJbnN0YW5jZS5ob29rcy5nZW5lcmF0ZUtleVBhaXIoSklGRkNsaWVudEluc3RhbmNlKTtcbiAgICAgICAgICBKSUZGQ2xpZW50SW5zdGFuY2Uuc2VjcmV0X2tleSA9IGtleS5zZWNyZXRfa2V5O1xuICAgICAgICAgIEpJRkZDbGllbnRJbnN0YW5jZS5wdWJsaWNfa2V5ID0ga2V5LnB1YmxpY19rZXk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBJbml0aWFsaXphdGlvbiBtZXNzYWdlXG4gICAgICAgIHZhciBtc2cgPSBKSUZGQ2xpZW50SW5zdGFuY2UuaGFuZGxlcnMuYnVpbGRfaW5pdGlhbGl6YXRpb25fbWVzc2FnZSgpO1xuXG4gICAgICAgIC8vIERvdWJsZSB3cmFwIHRoZSBtc2dcbiAgICAgICAgbXNnID0gSlNPTi5zdHJpbmdpZnkobXNnKTtcblxuICAgICAgICAvLyBFbWl0IGluaXRpYWxpemF0aW9uIG1lc3NhZ2UgdG8gc2VydmVyXG4gICAgICAgIEpJRkZDbGllbnRJbnN0YW5jZS5zb2NrZXQuc2VuZChKU09OLnN0cmluZ2lmeSh7IHNvY2tldFByb3RvY29sOiAnaW5pdGlhbGl6YXRpb24nLCBkYXRhOiBtc2cgfSkpO1xuICAgICAgfTtcblxuXG4gICAgICBKSUZGQ2xpZW50SW5zdGFuY2UuaW5pdFNvY2tldCgpO1xuICAgIH1cblxuICAgIC8qIEZ1bmN0aW9ucyB0aGF0IG92ZXJ3cml0ZSBjbGllbnQvc29ja2V0L21haWxib3guanMgZnVuY3Rpb25hbGl0eSAqL1xuXG4gICAgZnVuY3Rpb24gZ3VhcmRlZFNvY2tldChqaWZmQ2xpZW50KSB7XG4gICAgICAvLyBDcmVhdGUgcGxhaW4gc29ja2V0IGlvIG9iamVjdCB3aGljaCB3ZSB3aWxsIHdyYXAgaW4gdGhpc1xuICAgICAgdmFyIHNvY2tldDtcbiAgICAgIGlmIChqaWZmQ2xpZW50Lmhvc3RuYW1lLnN0YXJ0c1dpdGgoXCJodHRwXCIpKSB7XG4gICAgICAgIHZhciBtb2RpZmllZEhvc3ROYW1lID0gXCJ3c1wiICsgamlmZkNsaWVudC5ob3N0bmFtZS5zdWJzdHJpbmcoamlmZkNsaWVudC5ob3N0bmFtZS5pbmRleE9mKFwiOlwiKSlcbiAgICAgICAgc29ja2V0ID0gbmV3IHdzKG1vZGlmaWVkSG9zdE5hbWUpXG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzb2NrZXQgPSBuZXcgd3MoamlmZkNsaWVudC5ob3N0bmFtZSk7XG4gICAgICB9XG5cblxuICAgICAgc29ja2V0Lm9sZF9kaXNjb25uZWN0ID0gc29ja2V0LmNsb3NlO1xuXG4gICAgICBzb2NrZXQubWFpbGJveCA9IGxpbmtlZExpc3QoKTsgLy8gZm9yIG91dGdvaW5nIG1lc3NhZ2VzXG4gICAgICBzb2NrZXQuZW1wdHlfZGVmZXJyZWQgPSBudWxsOyAvLyBnZXRzIHJlc29sdmVkIHdoZW5ldmVyIHRoZSBtYWlsYm94IGlzIGVtcHR5XG4gICAgICBzb2NrZXQuamlmZkNsaWVudCA9IGppZmZDbGllbnQ7XG5cbiAgICAgIC8vIGFkZCBmdW5jdGlvbmFsaXR5IHRvIHNvY2tldFxuICAgICAgc29ja2V0LnNhZmVfZW1pdCA9IHNhZmVfZW1pdC5iaW5kKHNvY2tldCk7XG4gICAgICBzb2NrZXQucmVzZW5kX21haWxib3ggPSByZXNlbmRfbWFpbGJveC5iaW5kKHNvY2tldCk7XG4gICAgICBzb2NrZXQuZGlzY29ubmVjdCA9IGRpc2Nvbm5lY3QuYmluZChzb2NrZXQpO1xuICAgICAgc29ja2V0LnNhZmVfZGlzY29ubmVjdCA9IHNhZmVfZGlzY29ubmVjdC5iaW5kKHNvY2tldCk7XG4gICAgICBzb2NrZXQuaXNfZW1wdHkgPSBpc19lbXB0eS5iaW5kKHNvY2tldCk7XG5cbiAgICAgIHJldHVybiBzb2NrZXQ7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gc2FmZV9lbWl0KGxhYmVsLCBtc2cpIHtcbiAgICAgIC8vIGFkZCBtZXNzYWdlIHRvIG1haWxib3hcbiAgICAgIHZhciBtYWlsYm94X3BvaW50ZXIgPSB0aGlzLm1haWxib3guYWRkKHsgbGFiZWw6IGxhYmVsLCBtc2c6IG1zZyB9KTtcbiAgICAgIGlmICh0aGlzLnJlYWR5U3RhdGUgPT09IDEpIHtcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgICAvLyBlbWl0IHRoZSBtZXNzYWdlLCBpZiBhbiBhY2tub3dsZWRnbWVudCBpcyByZWNlaXZlZCwgcmVtb3ZlIGl0IGZyb20gbWFpbGJveFxuXG4gICAgICAgIHRoaXMuc2VuZChKU09OLnN0cmluZ2lmeSh7IHNvY2tldFByb3RvY29sOiBsYWJlbCwgZGF0YTogbXNnIH0pLCBudWxsLCBmdW5jdGlvbiAoc3RhdHVzKSB7XG5cbiAgICAgICAgICBzZWxmLm1haWxib3gucmVtb3ZlKG1haWxib3hfcG9pbnRlcik7XG5cbiAgICAgICAgICBpZiAoc2VsZi5pc19lbXB0eSgpICYmIHNlbGYuZW1wdHlfZGVmZXJyZWQgIT0gbnVsbCkge1xuICAgICAgICAgICAgc2VsZi5lbXB0eV9kZWZlcnJlZC5yZXNvbHZlKCk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgaWYgKGxhYmVsID09PSAnZnJlZScpIHtcbiAgICAgICAgICAgIHNlbGYuamlmZkNsaWVudC5ob29rcy5leGVjdXRlX2FycmF5X2hvb2tzKCdhZnRlck9wZXJhdGlvbicsIFtzZWxmLmppZmZDbGllbnQsICdmcmVlJywgbXNnXSwgMik7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgIH1cblxuICAgIH1cblxuICAgIGZ1bmN0aW9uIHJlc2VuZF9tYWlsYm94KCkge1xuICAgICAgLy8gQ3JlYXRlIGEgbmV3IG1haWxib3gsIHNpbmNlIHRoZSBjdXJyZW50IG1haWxib3ggd2lsbCBiZSByZXNlbnQgYW5kXG4gICAgICAvLyB3aWxsIGNvbnRhaW4gbmV3IGJhY2t1cHMuXG4gICAgICB2YXIgb2xkX21haWxib3ggPSB0aGlzLm1haWxib3g7XG4gICAgICB0aGlzLm1haWxib3ggPSBsaW5rZWRMaXN0KCk7XG5cbiAgICAgIC8vIGxvb3Agb3ZlciBhbGwgc3RvcmVkIG1lc3NhZ2VzIGFuZCBlbWl0IHRoZW1cbiAgICAgIHZhciBjdXJyZW50X25vZGUgPSBvbGRfbWFpbGJveC5oZWFkO1xuICAgICAgd2hpbGUgKGN1cnJlbnRfbm9kZSAhPSBudWxsKSB7XG4gICAgICAgIHZhciBsYWJlbCA9IGN1cnJlbnRfbm9kZS5vYmplY3QubGFiZWw7XG4gICAgICAgIHZhciBtc2cgPSBjdXJyZW50X25vZGUub2JqZWN0Lm1zZztcbiAgICAgICAgdGhpcy5zYWZlX2VtaXQobGFiZWwsIG1zZyk7XG4gICAgICAgIGN1cnJlbnRfbm9kZSA9IGN1cnJlbnRfbm9kZS5uZXh0O1xuICAgICAgfVxuXG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZGlzY29ubmVjdCgpIHtcblxuICAgICAgdGhpcy5qaWZmQ2xpZW50Lmhvb2tzLmV4ZWN1dGVfYXJyYXlfaG9va3MoJ2JlZm9yZU9wZXJhdGlvbicsIFt0aGlzLmppZmZDbGllbnQsICdkaXNjb25uZWN0Jywge31dLCAtMSk7XG5cblxuICAgICAgdGhpcy5vbGRfZGlzY29ubmVjdC5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHNhZmVfZGlzY29ubmVjdChmcmVlLCBjYWxsYmFjaykge1xuXG4gICAgICBpZiAodGhpcy5pc19lbXB0eSgpKSB7XG5cbiAgICAgICAgaWYgKGZyZWUpIHtcbiAgICAgICAgICB0aGlzLmppZmZDbGllbnQuZnJlZSgpO1xuICAgICAgICAgIGZyZWUgPSBmYWxzZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyBUOiBTaG91bGQgcmVtYWluIFwiZGlzY29ubmVjdFwiIHNpbmNlIHdlIG92ZXJyaWRlIHRoZSAuZGlzY29ubmVjdCwgbm8gbmVlZCB0byBjaGFuZ2UgdG8gY2xvc2VcbiAgICAgICAgICB0aGlzLmRpc2Nvbm5lY3QoKTtcbiAgICAgICAgICBpZiAoY2FsbGJhY2sgIT0gbnVsbCkge1xuICAgICAgICAgICAgY2FsbGJhY2soKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHRoaXMuZW1wdHlfZGVmZXJyZWQgPSBuZXcgdGhpcy5qaWZmQ2xpZW50LmhlbHBlcnMuRGVmZXJyZWQoKTtcbiAgICAgIHRoaXMuZW1wdHlfZGVmZXJyZWQucHJvbWlzZS50aGVuKHRoaXMuc2FmZV9kaXNjb25uZWN0LmJpbmQodGhpcywgZnJlZSwgY2FsbGJhY2spKTtcblxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGlzX2VtcHR5KCkge1xuICAgICAgcmV0dXJuIHRoaXMubWFpbGJveC5oZWFkID09IG51bGwgJiYgdGhpcy5qaWZmQ2xpZW50LmNvdW50ZXJzLnBlbmRpbmdfb3BlbnMgPT09IDA7XG5cbiAgICB9XG5cbiAgICAvKiBQUkVQUk9DRVNTSU5HIElTIFRIRSBTQU1FICovXG4gICAgamlmZi5wcmVwcm9jZXNzaW5nX2Z1bmN0aW9uX21hcFtleHBvcnRzLm5hbWVdID0ge307XG5cblxuICAgIHJldHVybiBqaWZmO1xuICB9XG4gIC8vIEV4cG9zZSB0aGUgQVBJIGZvciB0aGlzIGV4dGVuc2lvbi5cbiAgZXhwb3J0cy5tYWtlX2ppZmYgPSBtYWtlX2ppZmY7XG5cbn0oKHR5cGVvZiBleHBvcnRzID09PSAndW5kZWZpbmVkJyA/IHRoaXMuamlmZl93ZWJzb2NrZXRzID0ge30gOiBleHBvcnRzKSwgdHlwZW9mIGV4cG9ydHMgIT09ICd1bmRlZmluZWQnKSk7XG4iLCIvLyBzaGltIGZvciB1c2luZyBwcm9jZXNzIGluIGJyb3dzZXJcbnZhciBwcm9jZXNzID0gbW9kdWxlLmV4cG9ydHMgPSB7fTtcblxuLy8gY2FjaGVkIGZyb20gd2hhdGV2ZXIgZ2xvYmFsIGlzIHByZXNlbnQgc28gdGhhdCB0ZXN0IHJ1bm5lcnMgdGhhdCBzdHViIGl0XG4vLyBkb24ndCBicmVhayB0aGluZ3MuICBCdXQgd2UgbmVlZCB0byB3cmFwIGl0IGluIGEgdHJ5IGNhdGNoIGluIGNhc2UgaXQgaXNcbi8vIHdyYXBwZWQgaW4gc3RyaWN0IG1vZGUgY29kZSB3aGljaCBkb2Vzbid0IGRlZmluZSBhbnkgZ2xvYmFscy4gIEl0J3MgaW5zaWRlIGFcbi8vIGZ1bmN0aW9uIGJlY2F1c2UgdHJ5L2NhdGNoZXMgZGVvcHRpbWl6ZSBpbiBjZXJ0YWluIGVuZ2luZXMuXG5cbnZhciBjYWNoZWRTZXRUaW1lb3V0O1xudmFyIGNhY2hlZENsZWFyVGltZW91dDtcblxuZnVuY3Rpb24gZGVmYXVsdFNldFRpbW91dCgpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3NldFRpbWVvdXQgaGFzIG5vdCBiZWVuIGRlZmluZWQnKTtcbn1cbmZ1bmN0aW9uIGRlZmF1bHRDbGVhclRpbWVvdXQgKCkge1xuICAgIHRocm93IG5ldyBFcnJvcignY2xlYXJUaW1lb3V0IGhhcyBub3QgYmVlbiBkZWZpbmVkJyk7XG59XG4oZnVuY3Rpb24gKCkge1xuICAgIHRyeSB7XG4gICAgICAgIGlmICh0eXBlb2Ygc2V0VGltZW91dCA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgY2FjaGVkU2V0VGltZW91dCA9IHNldFRpbWVvdXQ7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjYWNoZWRTZXRUaW1lb3V0ID0gZGVmYXVsdFNldFRpbW91dDtcbiAgICAgICAgfVxuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgY2FjaGVkU2V0VGltZW91dCA9IGRlZmF1bHRTZXRUaW1vdXQ7XG4gICAgfVxuICAgIHRyeSB7XG4gICAgICAgIGlmICh0eXBlb2YgY2xlYXJUaW1lb3V0ID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICBjYWNoZWRDbGVhclRpbWVvdXQgPSBjbGVhclRpbWVvdXQ7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjYWNoZWRDbGVhclRpbWVvdXQgPSBkZWZhdWx0Q2xlYXJUaW1lb3V0O1xuICAgICAgICB9XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgICBjYWNoZWRDbGVhclRpbWVvdXQgPSBkZWZhdWx0Q2xlYXJUaW1lb3V0O1xuICAgIH1cbn0gKCkpXG5mdW5jdGlvbiBydW5UaW1lb3V0KGZ1bikge1xuICAgIGlmIChjYWNoZWRTZXRUaW1lb3V0ID09PSBzZXRUaW1lb3V0KSB7XG4gICAgICAgIC8vbm9ybWFsIGVudmlyb21lbnRzIGluIHNhbmUgc2l0dWF0aW9uc1xuICAgICAgICByZXR1cm4gc2V0VGltZW91dChmdW4sIDApO1xuICAgIH1cbiAgICAvLyBpZiBzZXRUaW1lb3V0IHdhc24ndCBhdmFpbGFibGUgYnV0IHdhcyBsYXR0ZXIgZGVmaW5lZFxuICAgIGlmICgoY2FjaGVkU2V0VGltZW91dCA9PT0gZGVmYXVsdFNldFRpbW91dCB8fCAhY2FjaGVkU2V0VGltZW91dCkgJiYgc2V0VGltZW91dCkge1xuICAgICAgICBjYWNoZWRTZXRUaW1lb3V0ID0gc2V0VGltZW91dDtcbiAgICAgICAgcmV0dXJuIHNldFRpbWVvdXQoZnVuLCAwKTtcbiAgICB9XG4gICAgdHJ5IHtcbiAgICAgICAgLy8gd2hlbiB3aGVuIHNvbWVib2R5IGhhcyBzY3Jld2VkIHdpdGggc2V0VGltZW91dCBidXQgbm8gSS5FLiBtYWRkbmVzc1xuICAgICAgICByZXR1cm4gY2FjaGVkU2V0VGltZW91dChmdW4sIDApO1xuICAgIH0gY2F0Y2goZSl7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICAvLyBXaGVuIHdlIGFyZSBpbiBJLkUuIGJ1dCB0aGUgc2NyaXB0IGhhcyBiZWVuIGV2YWxlZCBzbyBJLkUuIGRvZXNuJ3QgdHJ1c3QgdGhlIGdsb2JhbCBvYmplY3Qgd2hlbiBjYWxsZWQgbm9ybWFsbHlcbiAgICAgICAgICAgIHJldHVybiBjYWNoZWRTZXRUaW1lb3V0LmNhbGwobnVsbCwgZnVuLCAwKTtcbiAgICAgICAgfSBjYXRjaChlKXtcbiAgICAgICAgICAgIC8vIHNhbWUgYXMgYWJvdmUgYnV0IHdoZW4gaXQncyBhIHZlcnNpb24gb2YgSS5FLiB0aGF0IG11c3QgaGF2ZSB0aGUgZ2xvYmFsIG9iamVjdCBmb3IgJ3RoaXMnLCBob3BmdWxseSBvdXIgY29udGV4dCBjb3JyZWN0IG90aGVyd2lzZSBpdCB3aWxsIHRocm93IGEgZ2xvYmFsIGVycm9yXG4gICAgICAgICAgICByZXR1cm4gY2FjaGVkU2V0VGltZW91dC5jYWxsKHRoaXMsIGZ1biwgMCk7XG4gICAgICAgIH1cbiAgICB9XG5cblxufVxuZnVuY3Rpb24gcnVuQ2xlYXJUaW1lb3V0KG1hcmtlcikge1xuICAgIGlmIChjYWNoZWRDbGVhclRpbWVvdXQgPT09IGNsZWFyVGltZW91dCkge1xuICAgICAgICAvL25vcm1hbCBlbnZpcm9tZW50cyBpbiBzYW5lIHNpdHVhdGlvbnNcbiAgICAgICAgcmV0dXJuIGNsZWFyVGltZW91dChtYXJrZXIpO1xuICAgIH1cbiAgICAvLyBpZiBjbGVhclRpbWVvdXQgd2Fzbid0IGF2YWlsYWJsZSBidXQgd2FzIGxhdHRlciBkZWZpbmVkXG4gICAgaWYgKChjYWNoZWRDbGVhclRpbWVvdXQgPT09IGRlZmF1bHRDbGVhclRpbWVvdXQgfHwgIWNhY2hlZENsZWFyVGltZW91dCkgJiYgY2xlYXJUaW1lb3V0KSB7XG4gICAgICAgIGNhY2hlZENsZWFyVGltZW91dCA9IGNsZWFyVGltZW91dDtcbiAgICAgICAgcmV0dXJuIGNsZWFyVGltZW91dChtYXJrZXIpO1xuICAgIH1cbiAgICB0cnkge1xuICAgICAgICAvLyB3aGVuIHdoZW4gc29tZWJvZHkgaGFzIHNjcmV3ZWQgd2l0aCBzZXRUaW1lb3V0IGJ1dCBubyBJLkUuIG1hZGRuZXNzXG4gICAgICAgIHJldHVybiBjYWNoZWRDbGVhclRpbWVvdXQobWFya2VyKTtcbiAgICB9IGNhdGNoIChlKXtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIC8vIFdoZW4gd2UgYXJlIGluIEkuRS4gYnV0IHRoZSBzY3JpcHQgaGFzIGJlZW4gZXZhbGVkIHNvIEkuRS4gZG9lc24ndCAgdHJ1c3QgdGhlIGdsb2JhbCBvYmplY3Qgd2hlbiBjYWxsZWQgbm9ybWFsbHlcbiAgICAgICAgICAgIHJldHVybiBjYWNoZWRDbGVhclRpbWVvdXQuY2FsbChudWxsLCBtYXJrZXIpO1xuICAgICAgICB9IGNhdGNoIChlKXtcbiAgICAgICAgICAgIC8vIHNhbWUgYXMgYWJvdmUgYnV0IHdoZW4gaXQncyBhIHZlcnNpb24gb2YgSS5FLiB0aGF0IG11c3QgaGF2ZSB0aGUgZ2xvYmFsIG9iamVjdCBmb3IgJ3RoaXMnLCBob3BmdWxseSBvdXIgY29udGV4dCBjb3JyZWN0IG90aGVyd2lzZSBpdCB3aWxsIHRocm93IGEgZ2xvYmFsIGVycm9yLlxuICAgICAgICAgICAgLy8gU29tZSB2ZXJzaW9ucyBvZiBJLkUuIGhhdmUgZGlmZmVyZW50IHJ1bGVzIGZvciBjbGVhclRpbWVvdXQgdnMgc2V0VGltZW91dFxuICAgICAgICAgICAgcmV0dXJuIGNhY2hlZENsZWFyVGltZW91dC5jYWxsKHRoaXMsIG1hcmtlcik7XG4gICAgICAgIH1cbiAgICB9XG5cblxuXG59XG52YXIgcXVldWUgPSBbXTtcbnZhciBkcmFpbmluZyA9IGZhbHNlO1xudmFyIGN1cnJlbnRRdWV1ZTtcbnZhciBxdWV1ZUluZGV4ID0gLTE7XG5cbmZ1bmN0aW9uIGNsZWFuVXBOZXh0VGljaygpIHtcbiAgICBpZiAoIWRyYWluaW5nIHx8ICFjdXJyZW50UXVldWUpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBkcmFpbmluZyA9IGZhbHNlO1xuICAgIGlmIChjdXJyZW50UXVldWUubGVuZ3RoKSB7XG4gICAgICAgIHF1ZXVlID0gY3VycmVudFF1ZXVlLmNvbmNhdChxdWV1ZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcXVldWVJbmRleCA9IC0xO1xuICAgIH1cbiAgICBpZiAocXVldWUubGVuZ3RoKSB7XG4gICAgICAgIGRyYWluUXVldWUoKTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGRyYWluUXVldWUoKSB7XG4gICAgaWYgKGRyYWluaW5nKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG4gICAgdmFyIHRpbWVvdXQgPSBydW5UaW1lb3V0KGNsZWFuVXBOZXh0VGljayk7XG4gICAgZHJhaW5pbmcgPSB0cnVlO1xuXG4gICAgdmFyIGxlbiA9IHF1ZXVlLmxlbmd0aDtcbiAgICB3aGlsZShsZW4pIHtcbiAgICAgICAgY3VycmVudFF1ZXVlID0gcXVldWU7XG4gICAgICAgIHF1ZXVlID0gW107XG4gICAgICAgIHdoaWxlICgrK3F1ZXVlSW5kZXggPCBsZW4pIHtcbiAgICAgICAgICAgIGlmIChjdXJyZW50UXVldWUpIHtcbiAgICAgICAgICAgICAgICBjdXJyZW50UXVldWVbcXVldWVJbmRleF0ucnVuKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcXVldWVJbmRleCA9IC0xO1xuICAgICAgICBsZW4gPSBxdWV1ZS5sZW5ndGg7XG4gICAgfVxuICAgIGN1cnJlbnRRdWV1ZSA9IG51bGw7XG4gICAgZHJhaW5pbmcgPSBmYWxzZTtcbiAgICBydW5DbGVhclRpbWVvdXQodGltZW91dCk7XG59XG5cbnByb2Nlc3MubmV4dFRpY2sgPSBmdW5jdGlvbiAoZnVuKSB7XG4gICAgdmFyIGFyZ3MgPSBuZXcgQXJyYXkoYXJndW1lbnRzLmxlbmd0aCAtIDEpO1xuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID4gMSkge1xuICAgICAgICBmb3IgKHZhciBpID0gMTsgaSA8IGFyZ3VtZW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgYXJnc1tpIC0gMV0gPSBhcmd1bWVudHNbaV07XG4gICAgICAgIH1cbiAgICB9XG4gICAgcXVldWUucHVzaChuZXcgSXRlbShmdW4sIGFyZ3MpKTtcbiAgICBpZiAocXVldWUubGVuZ3RoID09PSAxICYmICFkcmFpbmluZykge1xuICAgICAgICBydW5UaW1lb3V0KGRyYWluUXVldWUpO1xuICAgIH1cbn07XG5cbi8vIHY4IGxpa2VzIHByZWRpY3RpYmxlIG9iamVjdHNcbmZ1bmN0aW9uIEl0ZW0oZnVuLCBhcnJheSkge1xuICAgIHRoaXMuZnVuID0gZnVuO1xuICAgIHRoaXMuYXJyYXkgPSBhcnJheTtcbn1cbkl0ZW0ucHJvdG90eXBlLnJ1biA9IGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLmZ1bi5hcHBseShudWxsLCB0aGlzLmFycmF5KTtcbn07XG5wcm9jZXNzLnRpdGxlID0gJ2Jyb3dzZXInO1xucHJvY2Vzcy5icm93c2VyID0gdHJ1ZTtcbnByb2Nlc3MuZW52ID0ge307XG5wcm9jZXNzLmFyZ3YgPSBbXTtcbnByb2Nlc3MudmVyc2lvbiA9ICcnOyAvLyBlbXB0eSBzdHJpbmcgdG8gYXZvaWQgcmVnZXhwIGlzc3Vlc1xucHJvY2Vzcy52ZXJzaW9ucyA9IHt9O1xuXG5mdW5jdGlvbiBub29wKCkge31cblxucHJvY2Vzcy5vbiA9IG5vb3A7XG5wcm9jZXNzLmFkZExpc3RlbmVyID0gbm9vcDtcbnByb2Nlc3Mub25jZSA9IG5vb3A7XG5wcm9jZXNzLm9mZiA9IG5vb3A7XG5wcm9jZXNzLnJlbW92ZUxpc3RlbmVyID0gbm9vcDtcbnByb2Nlc3MucmVtb3ZlQWxsTGlzdGVuZXJzID0gbm9vcDtcbnByb2Nlc3MuZW1pdCA9IG5vb3A7XG5wcm9jZXNzLnByZXBlbmRMaXN0ZW5lciA9IG5vb3A7XG5wcm9jZXNzLnByZXBlbmRPbmNlTGlzdGVuZXIgPSBub29wO1xuXG5wcm9jZXNzLmxpc3RlbmVycyA9IGZ1bmN0aW9uIChuYW1lKSB7IHJldHVybiBbXSB9XG5cbnByb2Nlc3MuYmluZGluZyA9IGZ1bmN0aW9uIChuYW1lKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdwcm9jZXNzLmJpbmRpbmcgaXMgbm90IHN1cHBvcnRlZCcpO1xufTtcblxucHJvY2Vzcy5jd2QgPSBmdW5jdGlvbiAoKSB7IHJldHVybiAnLycgfTtcbnByb2Nlc3MuY2hkaXIgPSBmdW5jdGlvbiAoZGlyKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdwcm9jZXNzLmNoZGlyIGlzIG5vdCBzdXBwb3J0ZWQnKTtcbn07XG5wcm9jZXNzLnVtYXNrID0gZnVuY3Rpb24oKSB7IHJldHVybiAwOyB9O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uICgpIHtcbiAgdGhyb3cgbmV3IEVycm9yKFxuICAgICd3cyBkb2VzIG5vdCB3b3JrIGluIHRoZSBicm93c2VyLiBCcm93c2VyIGNsaWVudHMgbXVzdCB1c2UgdGhlIG5hdGl2ZSAnICtcbiAgICAgICdXZWJTb2NrZXQgb2JqZWN0J1xuICApO1xufTtcbiJdfQ==
