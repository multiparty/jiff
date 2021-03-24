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
(function (process,global){
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
    var socket;
    if(jiffClient.hostname.startsWith("http")) {
      var modifiedHostName = "ws" + jiffClient.hostname.substring(jiffClient.hostname.indexOf(":"))
      console.log(modifiedHostName)
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


module.exports = {make_jiff: make_jiff, name: 'jiff_websockets'};

}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../client/handlers.js":1,"../common/linkedlist.js":6,"_process":9,"ws":8}],8:[function(require,module,exports){
'use strict';

module.exports = function () {
  throw new Error(
    'ws does not work in the browser. Browser clients must use the native ' +
      'WebSocket object'
  );
};

},{}],9:[function(require,module,exports){
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

},{}]},{},[7])(7)
});
