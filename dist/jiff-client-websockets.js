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

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJsaWIvY2xpZW50L2hhbmRsZXJzLmpzIiwibGliL2NsaWVudC9oYW5kbGVycy9jcnlwdG9fcHJvdmlkZXIuanMiLCJsaWIvY2xpZW50L2hhbmRsZXJzL2N1c3RvbS5qcyIsImxpYi9jbGllbnQvaGFuZGxlcnMvaW5pdGlhbGl6YXRpb24uanMiLCJsaWIvY2xpZW50L2hhbmRsZXJzL3NoYXJpbmcuanMiLCJsaWIvY29tbW9uL2xpbmtlZGxpc3QuanMiLCJsaWIvZXh0L2ppZmYtY2xpZW50LXdlYnNvY2tldHMuanMiLCJub2RlX21vZHVsZXMvcHJvY2Vzcy9icm93c2VyLmpzIiwibm9kZV9tb2R1bGVzL3dzL2Jyb3dzZXIuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25CQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNySUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1RUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQzlIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUN4WUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4TEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24oKXtmdW5jdGlvbiByKGUsbix0KXtmdW5jdGlvbiBvKGksZil7aWYoIW5baV0pe2lmKCFlW2ldKXt2YXIgYz1cImZ1bmN0aW9uXCI9PXR5cGVvZiByZXF1aXJlJiZyZXF1aXJlO2lmKCFmJiZjKXJldHVybiBjKGksITApO2lmKHUpcmV0dXJuIHUoaSwhMCk7dmFyIGE9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitpK1wiJ1wiKTt0aHJvdyBhLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsYX12YXIgcD1uW2ldPXtleHBvcnRzOnt9fTtlW2ldWzBdLmNhbGwocC5leHBvcnRzLGZ1bmN0aW9uKHIpe3ZhciBuPWVbaV1bMV1bcl07cmV0dXJuIG8obnx8cil9LHAscC5leHBvcnRzLHIsZSxuLHQpfXJldHVybiBuW2ldLmV4cG9ydHN9Zm9yKHZhciB1PVwiZnVuY3Rpb25cIj09dHlwZW9mIHJlcXVpcmUmJnJlcXVpcmUsaT0wO2k8dC5sZW5ndGg7aSsrKW8odFtpXSk7cmV0dXJuIG99cmV0dXJuIHJ9KSgpIiwidmFyIGluaXRpYWxpemF0aW9uSGFuZGxlcnMgPSByZXF1aXJlKCcuL2hhbmRsZXJzL2luaXRpYWxpemF0aW9uLmpzJyk7XG52YXIgc2hhcmVIYW5kbGVycyA9IHJlcXVpcmUoJy4vaGFuZGxlcnMvc2hhcmluZy5qcycpO1xudmFyIGN1c3RvbUhhbmRsZXJzID0gcmVxdWlyZSgnLi9oYW5kbGVycy9jdXN0b20uanMnKTtcbnZhciBjcnlwdG9Qcm92aWRlckhhbmRsZXJzID0gcmVxdWlyZSgnLi9oYW5kbGVycy9jcnlwdG9fcHJvdmlkZXIuanMnKTtcblxuLyoqXG4gKiBDb250YWlucyBoYW5kbGVycyBmb3IgY29tbXVuaWNhdGlvbiBldmVudHNcbiAqIEBuYW1lIGhhbmRsZXJzXG4gKiBAYWxpYXMgaGFuZGxlcnNcbiAqIEBuYW1lc3BhY2VcbiAqL1xuXG4vLyBBZGQgaGFuZGxlcnMgaW1wbGVtZW50YXRpb25zXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChqaWZmQ2xpZW50KSB7XG4gIC8vIGZpbGwgaW4gaGFuZGxlcnNcbiAgaW5pdGlhbGl6YXRpb25IYW5kbGVycyhqaWZmQ2xpZW50KTtcbiAgc2hhcmVIYW5kbGVycyhqaWZmQ2xpZW50KTtcbiAgY3VzdG9tSGFuZGxlcnMoamlmZkNsaWVudCk7XG4gIGNyeXB0b1Byb3ZpZGVySGFuZGxlcnMoamlmZkNsaWVudCk7XG59OyIsIi8vIHNldHVwIGhhbmRsZXIgZm9yIHJlY2VpdmluZyBtZXNzYWdlcyBmcm9tIHRoZSBjcnlwdG8gcHJvdmlkZXJcbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKGppZmZDbGllbnQpIHtcbiAgLyoqXG4gICAqIFBhcnNlIGNyeXB0byBwcm92aWRlciBtZXNzYWdlIGFuZCByZXNvbHZlIGFzc29jaWF0ZWQgcHJvbWlzZS5cbiAgICogQG1ldGhvZFxuICAgKiBAbWVtYmVyb2YgaGFuZGxlcnNcbiAgICogQHBhcmFtIHtvYmplY3R9IGpzb25fbXNnIC0gdGhlIHBhcnNlZCBqc29uIG1lc3NhZ2UgYXMgcmVjZWl2ZWQgYnkgdGhlIGNyeXB0b19wcm92aWRlciBldmVudCwgY29udGFpbnMgJ3ZhbHVlcycgYW5kICdzaGFyZXMnIGF0dHJpYnV0ZXMuXG4gICAqL1xuICBqaWZmQ2xpZW50LmhhbmRsZXJzLnJlY2VpdmVfY3J5cHRvX3Byb3ZpZGVyID0gZnVuY3Rpb24gKGpzb25fbXNnKSB7XG4gICAgLy8gSG9va1xuICAgIGpzb25fbXNnID0gamlmZkNsaWVudC5ob29rcy5leGVjdXRlX2FycmF5X2hvb2tzKCdhZnRlck9wZXJhdGlvbicsIFtqaWZmQ2xpZW50LCAnY3J5cHRvX3Byb3ZpZGVyJywganNvbl9tc2ddLCAyKTtcblxuICAgIHZhciBvcF9pZCA9IGpzb25fbXNnWydvcF9pZCddO1xuICAgIGlmIChqaWZmQ2xpZW50LmRlZmVycmVkc1tvcF9pZF0gPT0gbnVsbCkge1xuICAgICAgcmV0dXJuOyAvLyBkdXBsaWNhdGUgbWVzc2FnZTogaWdub3JlXG4gICAgfVxuXG4gICAgLy8gcGFyc2UgbXNnXG4gICAgdmFyIHJlY2VpdmVyc19saXN0ID0ganNvbl9tc2dbJ3JlY2VpdmVycyddO1xuICAgIHZhciB0aHJlc2hvbGQgPSBqc29uX21zZ1sndGhyZXNob2xkJ107XG4gICAgdmFyIFpwID0ganNvbl9tc2dbJ1pwJ107XG5cbiAgICAvLyBjb25zdHJ1Y3Qgc2VjcmV0IHNoYXJlIG9iamVjdHNcbiAgICB2YXIgcmVzdWx0ID0ge307XG4gICAgaWYgKGpzb25fbXNnWyd2YWx1ZXMnXSAhPSBudWxsKSB7XG4gICAgICByZXN1bHQudmFsdWVzID0ganNvbl9tc2dbJ3ZhbHVlcyddO1xuICAgIH1cbiAgICBpZiAoanNvbl9tc2dbJ3NoYXJlcyddICE9IG51bGwpIHtcbiAgICAgIHJlc3VsdC5zaGFyZXMgPSBbXTtcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwganNvbl9tc2dbJ3NoYXJlcyddLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHJlc3VsdC5zaGFyZXMucHVzaChuZXcgamlmZkNsaWVudC5TZWNyZXRTaGFyZShqc29uX21zZ1snc2hhcmVzJ11baV0sIHJlY2VpdmVyc19saXN0LCB0aHJlc2hvbGQsIFpwKSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gcmVzb2x2ZSBkZWZlcnJlZFxuICAgIGppZmZDbGllbnQuZGVmZXJyZWRzW29wX2lkXS5yZXNvbHZlKHJlc3VsdCk7XG4gICAgZGVsZXRlIGppZmZDbGllbnQuZGVmZXJyZWRzW29wX2lkXTtcbiAgfTtcbn07IiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAoamlmZkNsaWVudCkge1xuICAvKipcbiAgICogQ2FsbGVkIHdoZW4gdGhpcyBwYXJ0eSByZWNlaXZlcyBhIGN1c3RvbSB0YWcgbWVzc2FnZSBmcm9tIGFueSBwYXJ0eSAoaW5jbHVkaW5nIGl0c2VsZikuXG4gICAqIElmIGEgY3VzdG9tIGxpc3RlbmVyIHdhcyBzZXR1cCB0byBsaXN0ZW4gdG8gdGhlIHRhZywgdGhlIG1lc3NhZ2UgaXMgcGFzc2VkIHRvIHRoZSBsaXN0ZW5lci5cbiAgICogT3RoZXJ3aXNlLCB0aGUgbWVzc2FnZSBpcyBzdG9yZWQgdW50aWwgc3VjaCBhIGxpc3RlbmVyIGlzIHByb3ZpZGVkLlxuICAgKiBAbWV0aG9kXG4gICAqIEBtZW1iZXJvZiBoYW5kbGVyc1xuICAgKiBAcGFyYW0ge29iamVjdH0ganNvbl9tc2cgLSB0aGUgcGFyc2VkIGpzb24gbWVzc2FnZSBhcyByZWNlaXZlZCBieSB0aGUgY3VzdG9tIGV2ZW50LlxuICAgKi9cbiAgamlmZkNsaWVudC5oYW5kbGVycy5yZWNlaXZlX2N1c3RvbSA9IGZ1bmN0aW9uIChqc29uX21zZykge1xuICAgIGlmIChqc29uX21zZ1sncGFydHlfaWQnXSAhPT0gamlmZkNsaWVudC5pZCkge1xuICAgICAgaWYgKGpzb25fbXNnWydlbmNyeXB0ZWQnXSA9PT0gdHJ1ZSkge1xuICAgICAgICBqc29uX21zZ1snbWVzc2FnZSddID0gamlmZkNsaWVudC5ob29rcy5kZWNyeXB0U2lnbihqaWZmQ2xpZW50LCBqc29uX21zZ1snbWVzc2FnZSddLCBqaWZmQ2xpZW50LnNlY3JldF9rZXksIGppZmZDbGllbnQua2V5bWFwW2pzb25fbXNnWydwYXJ0eV9pZCddXSk7XG4gICAgICB9XG5cbiAgICAgIGpzb25fbXNnID0gamlmZkNsaWVudC5ob29rcy5leGVjdXRlX2FycmF5X2hvb2tzKCdhZnRlck9wZXJhdGlvbicsIFtqaWZmQ2xpZW50LCAnY3VzdG9tJywganNvbl9tc2ddLCAyKTtcbiAgICB9XG5cbiAgICB2YXIgc2VuZGVyX2lkID0ganNvbl9tc2dbJ3BhcnR5X2lkJ107XG4gICAgdmFyIHRhZyA9IGpzb25fbXNnWyd0YWcnXTtcbiAgICB2YXIgbWVzc2FnZSA9IGpzb25fbXNnWydtZXNzYWdlJ107XG5cbiAgICBpZiAoamlmZkNsaWVudC5saXN0ZW5lcnNbdGFnXSAhPSBudWxsKSB7XG4gICAgICBqaWZmQ2xpZW50Lmxpc3RlbmVyc1t0YWddKHNlbmRlcl9pZCwgbWVzc2FnZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIFN0b3JlIG1lc3NhZ2UgdW50aWwgbGlzdGVuZXIgaXMgcHJvdmlkZWRcbiAgICAgIHZhciBzdG9yZWRfbWVzc2FnZXMgPSBqaWZmQ2xpZW50LmN1c3RvbV9tZXNzYWdlc19tYWlsYm94W3RhZ107XG4gICAgICBpZiAoc3RvcmVkX21lc3NhZ2VzID09IG51bGwpIHtcbiAgICAgICAgc3RvcmVkX21lc3NhZ2VzID0gW107XG4gICAgICAgIGppZmZDbGllbnQuY3VzdG9tX21lc3NhZ2VzX21haWxib3hbdGFnXSA9IHN0b3JlZF9tZXNzYWdlcztcbiAgICAgIH1cblxuICAgICAgc3RvcmVkX21lc3NhZ2VzLnB1c2goe3NlbmRlcl9pZDogc2VuZGVyX2lkLCBtZXNzYWdlOiBtZXNzYWdlfSk7XG4gICAgfVxuICB9XG59OyIsIi8vIGFkZCBoYW5kbGVycyBmb3IgaW5pdGlhbGl6YXRpb25cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKGppZmZDbGllbnQpIHtcbiAgamlmZkNsaWVudC5vcHRpb25zLmluaXRpYWxpemF0aW9uID0gT2JqZWN0LmFzc2lnbih7fSwgamlmZkNsaWVudC5vcHRpb25zLmluaXRpYWxpemF0aW9uKTtcblxuICAvKipcbiAgICogQ2FsbGVkIHdoZW4gYW4gZXJyb3Igb2NjdXJzXG4gICAqIEBtZXRob2RcbiAgICogQG1lbWJlcm9mIGhhbmRsZXJzXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBsYWJlbCAtIHRoZSBuYW1lIG9mIG1lc3NhZ2Ugb3Igb3BlcmF0aW9uIGNhdXNpbmcgdGhlIGVycm9yXG4gICAqIEBwYXJhbSB7ZXJyb3J8c3RyaW5nfSBlcnJvciAtIHRoZSBlcnJvclxuICAgKi9cbiAgamlmZkNsaWVudC5oYW5kbGVycy5lcnJvciA9IGZ1bmN0aW9uIChsYWJlbCwgZXJyb3IpIHtcbiAgICBpZiAoamlmZkNsaWVudC5vcHRpb25zLm9uRXJyb3IpIHtcbiAgICAgIGppZmZDbGllbnQub3B0aW9ucy5vbkVycm9yKGxhYmVsLCBlcnJvcik7XG4gICAgfVxuXG4gICAgY29uc29sZS5sb2coamlmZkNsaWVudC5pZCwgJzonLCAnRXJyb3IgZnJvbSBzZXJ2ZXI6JywgbGFiZWwsICctLS0nLCBlcnJvcik7IC8vIFRPRE86IHJlbW92ZSBkZWJ1Z2dpbmdcbiAgICBpZiAobGFiZWwgPT09ICdpbml0aWFsaXphdGlvbicpIHtcbiAgICAgIGppZmZDbGllbnQuc29ja2V0LmRpc2Nvbm5lY3QoKTtcblxuICAgICAgaWYgKGppZmZDbGllbnQuaW5pdGlhbGl6YXRpb25fY291bnRlciA8IGppZmZDbGllbnQub3B0aW9ucy5tYXhJbml0aWFsaXphdGlvblJldHJpZXMpIHtcbiAgICAgICAgY29uc29sZS5sb2coamlmZkNsaWVudC5pZCwgJzonLCAncmVjb25uZWN0aW5nLi4nKTsgLy8gVE9ETzogcmVtb3ZlIGRlYnVnZ2luZ1xuICAgICAgICBzZXRUaW1lb3V0KGppZmZDbGllbnQuY29ubmVjdCwgamlmZkNsaWVudC5vcHRpb25zLnNvY2tldE9wdGlvbnMucmVjb25uZWN0aW9uRGVsYXkpO1xuICAgICAgfVxuICAgIH1cbiAgfTtcblxuICAvKipcbiAgICogQnVpbGRzIHRoZSBpbml0aWFsaXphdGlvbiBtZXNzYWdlIGZvciB0aGlzIGluc3RhbmNlXG4gICAqIEBtZXRob2RcbiAgICogQG1lbWJlcm9mIGhhbmRsZXJzXG4gICAqIEByZXR1cm4ge09iamVjdH1cbiAgICovXG4gIGppZmZDbGllbnQuaGFuZGxlcnMuYnVpbGRfaW5pdGlhbGl6YXRpb25fbWVzc2FnZSA9IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgbXNnID0ge1xuICAgICAgY29tcHV0YXRpb25faWQ6IGppZmZDbGllbnQuY29tcHV0YXRpb25faWQsXG4gICAgICBwYXJ0eV9pZDogamlmZkNsaWVudC5pZCxcbiAgICAgIHBhcnR5X2NvdW50OiBqaWZmQ2xpZW50LnBhcnR5X2NvdW50LFxuICAgICAgcHVibGljX2tleTogamlmZkNsaWVudC5wdWJsaWNfa2V5ICE9IG51bGwgPyBqaWZmQ2xpZW50Lmhvb2tzLmR1bXBLZXkoamlmZkNsaWVudCwgamlmZkNsaWVudC5wdWJsaWNfa2V5KSA6IHVuZGVmaW5lZFxuICAgIH07XG4gICAgbXNnID0gT2JqZWN0LmFzc2lnbihtc2csIGppZmZDbGllbnQub3B0aW9ucy5pbml0aWFsaXphdGlvbik7XG5cbiAgICAvLyBJbml0aWFsaXphdGlvbiBIb29rXG4gICAgcmV0dXJuIGppZmZDbGllbnQuaG9va3MuZXhlY3V0ZV9hcnJheV9ob29rcygnYmVmb3JlT3BlcmF0aW9uJywgW2ppZmZDbGllbnQsICdpbml0aWFsaXphdGlvbicsIG1zZ10sIDIpO1xuICB9O1xuXG4gIC8qKlxuICAgKiBCZWdpbnMgaW5pdGlhbGl6YXRpb24gb2YgdGhpcyBpbnN0YW5jZSBieSBzZW5kaW5nIHRoZSBpbml0aWFsaXphdGlvbiBtZXNzYWdlIHRvIHRoZSBzZXJ2ZXIuXG4gICAqIFNob3VsZCBvbmx5IGJlIGNhbGxlZCBhZnRlciBjb25uZWN0aW9uIGlzIGVzdGFibGlzaGVkLlxuICAgKiBEbyBub3QgY2FsbCB0aGlzIG1hbnVhbGx5IHVubGVzcyB5b3Uga25vdyB3aGF0IHlvdSBhcmUgZG9pbmcsIHVzZSA8amlmZl9pbnN0YW5jZT4uY29ubmVjdCgpIGluc3RlYWQhXG4gICAqIEBtZXRob2RcbiAgICogQG1lbWJlcm9mIGhhbmRsZXJzXG4gICAqL1xuICBqaWZmQ2xpZW50LmhhbmRsZXJzLmNvbm5lY3RlZCA9IGZ1bmN0aW9uICgpIHtcbiAgICBjb25zb2xlLmxvZygnQ29ubmVjdGVkIScsIGppZmZDbGllbnQuaWQpOyAvLyBUT0RPOiByZW1vdmUgZGVidWdnaW5nXG4gICAgamlmZkNsaWVudC5pbml0aWFsaXphdGlvbl9jb3VudGVyKys7XG5cbiAgICBpZiAoamlmZkNsaWVudC5zZWNyZXRfa2V5ID09IG51bGwgJiYgamlmZkNsaWVudC5wdWJsaWNfa2V5ID09IG51bGwpIHtcbiAgICAgIHZhciBrZXkgPSBqaWZmQ2xpZW50Lmhvb2tzLmdlbmVyYXRlS2V5UGFpcihqaWZmQ2xpZW50KTtcbiAgICAgIGppZmZDbGllbnQuc2VjcmV0X2tleSA9IGtleS5zZWNyZXRfa2V5O1xuICAgICAgamlmZkNsaWVudC5wdWJsaWNfa2V5ID0ga2V5LnB1YmxpY19rZXk7XG4gICAgfVxuXG4gICAgLy8gSW5pdGlhbGl6YXRpb24gbWVzc2FnZVxuICAgIHZhciBtc2cgPSBqaWZmQ2xpZW50LmhhbmRsZXJzLmJ1aWxkX2luaXRpYWxpemF0aW9uX21lc3NhZ2UoKTtcblxuICAgIC8vIEVtaXQgaW5pdGlhbGl6YXRpb24gbWVzc2FnZSB0byBzZXJ2ZXJcbiAgICBqaWZmQ2xpZW50LnNvY2tldC5lbWl0KCdpbml0aWFsaXphdGlvbicsIEpTT04uc3RyaW5naWZ5KG1zZykpO1xuICB9O1xuXG4gIC8qKlxuICAgKiBDYWxsZWQgYWZ0ZXIgdGhlIHNlcnZlciBhcHByb3ZlcyBpbml0aWFsaXphdGlvbiBvZiB0aGlzIGluc3RhbmNlLlxuICAgKiBTZXRzIHRoZSBpbnN0YW5jZSBpZCwgdGhlIGNvdW50IG9mIHBhcnRpZXMgaW4gdGhlIGNvbXB1dGF0aW9uLCBhbmQgdGhlIHB1YmxpYyBrZXlzXG4gICAqIG9mIGluaXRpYWxpemVkIHBhcnRpZXMuXG4gICAqIEBtZXRob2RcbiAgICogQG1lbWJlcm9mIGhhbmRsZXJzXG4gICAqL1xuICBqaWZmQ2xpZW50LmhhbmRsZXJzLmluaXRpYWxpemVkID0gZnVuY3Rpb24gKG1zZykge1xuICAgIGppZmZDbGllbnQuX19pbml0aWFsaXplZCA9IHRydWU7XG4gICAgamlmZkNsaWVudC5pbml0aWFsaXphdGlvbl9jb3VudGVyID0gMDtcblxuICAgIG1zZyA9IEpTT04ucGFyc2UobXNnKTtcbiAgICBtc2cgPSBqaWZmQ2xpZW50Lmhvb2tzLmV4ZWN1dGVfYXJyYXlfaG9va3MoJ2FmdGVyT3BlcmF0aW9uJywgW2ppZmZDbGllbnQsICdpbml0aWFsaXphdGlvbicsIG1zZ10sIDIpO1xuXG4gICAgamlmZkNsaWVudC5pZCA9IG1zZy5wYXJ0eV9pZDtcbiAgICBqaWZmQ2xpZW50LnBhcnR5X2NvdW50ID0gbXNnLnBhcnR5X2NvdW50O1xuXG4gICAgLy8gTm93OiAoMSkgdGhpcyBwYXJ0eSBpcyBjb25uZWN0ICgyKSBzZXJ2ZXIgKGFuZCBvdGhlciBwYXJ0aWVzKSBrbm93IHRoaXMgcHVibGljIGtleVxuICAgIC8vIFJlc2VuZCBhbGwgcGVuZGluZyBtZXNzYWdlc1xuICAgIGppZmZDbGllbnQuc29ja2V0LnJlc2VuZF9tYWlsYm94KCk7XG5cbiAgICAvLyBzdG9yZSB0aGUgcmVjZWl2ZWQgcHVibGljIGtleXMgYW5kIHJlc29sdmUgd2FpdCBjYWxsYmFja3NcbiAgICBqaWZmQ2xpZW50LmhhbmRsZXJzLnN0b3JlX3B1YmxpY19rZXlzKG1zZy5wdWJsaWNfa2V5cyk7XG4gIH07XG5cbiAgLyoqXG4gICAqIFBhcnNlIGFuZCBzdG9yZSB0aGUgZ2l2ZW4gcHVibGljIGtleXNcbiAgICogQG1ldGhvZFxuICAgKiBAbWVtYmVyb2YgaGFuZGxlcnNcbiAgICogQHBhcmFtIHtvYmplY3R9IGtleW1hcCAtIG1hcHMgcGFydHkgaWQgdG8gc2VyaWFsaXplZCBwdWJsaWMga2V5LlxuICAgKi9cbiAgamlmZkNsaWVudC5oYW5kbGVycy5zdG9yZV9wdWJsaWNfa2V5cyA9IGZ1bmN0aW9uIChrZXltYXApIHtcbiAgICB2YXIgaTtcbiAgICBmb3IgKGkgaW4ga2V5bWFwKSB7XG4gICAgICBpZiAoa2V5bWFwLmhhc093blByb3BlcnR5KGkpICYmIGppZmZDbGllbnQua2V5bWFwW2ldID09IG51bGwpIHtcbiAgICAgICAgamlmZkNsaWVudC5rZXltYXBbaV0gPSBqaWZmQ2xpZW50Lmhvb2tzLnBhcnNlS2V5KGppZmZDbGllbnQsIGtleW1hcFtpXSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gUmVzb2x2ZSBhbnkgcGVuZGluZyBtZXNzYWdlcyB0aGF0IHdlcmUgcmVjZWl2ZWQgYmVmb3JlIHRoZSBzZW5kZXIncyBwdWJsaWMga2V5IHdhcyBrbm93blxuICAgIGppZmZDbGllbnQucmVzb2x2ZV9tZXNzYWdlc193YWl0aW5nX2Zvcl9rZXlzKCk7XG5cbiAgICAvLyBSZXNvbHZlIGFueSBwZW5kaW5nIHdhaXRzIHRoYXQgaGF2ZSBzYXRpc2ZpZWQgY29uZGl0aW9uc1xuICAgIGppZmZDbGllbnQuZXhlY3V0ZV93YWl0X2NhbGxiYWNrcygpO1xuXG4gICAgLy8gQ2hlY2sgaWYgYWxsIGtleXMgaGF2ZSBiZWVuIHJlY2VpdmVkXG4gICAgaWYgKGppZmZDbGllbnQua2V5bWFwWydzMSddID09IG51bGwpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgZm9yIChpID0gMTsgaSA8PSBqaWZmQ2xpZW50LnBhcnR5X2NvdW50OyBpKyspIHtcbiAgICAgIGlmIChqaWZmQ2xpZW50LmtleW1hcFtpXSA9PSBudWxsKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBhbGwgcGFydGllcyBhcmUgY29ubmVjdGVkOyBleGVjdXRlIGNhbGxiYWNrXG4gICAgaWYgKGppZmZDbGllbnQuX19yZWFkeSAhPT0gdHJ1ZSAmJiBqaWZmQ2xpZW50Ll9faW5pdGlhbGl6ZWQpIHtcbiAgICAgIGppZmZDbGllbnQuX19yZWFkeSA9IHRydWU7XG4gICAgICBpZiAoamlmZkNsaWVudC5vcHRpb25zLm9uQ29ubmVjdCAhPSBudWxsKSB7XG4gICAgICAgIGppZmZDbGllbnQub3B0aW9ucy5vbkNvbm5lY3QoamlmZkNsaWVudCk7XG4gICAgICB9XG4gICAgfVxuICB9O1xufTsiLCIvLyBhZGRzIHNoYXJpbmcgcmVsYXRlZCBoYW5kbGVyc1xubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAoamlmZkNsaWVudCkge1xuICAvKipcbiAgICogU3RvcmUgdGhlIHJlY2VpdmVkIHNoYXJlIGFuZCByZXNvbHZlcyB0aGUgY29ycmVzcG9uZGluZ1xuICAgKiBkZWZlcnJlZCBpZiBuZWVkZWQuXG4gICAqIEBtZXRob2RcbiAgICogQG1lbWJlcm9mIGhhbmRsZXJzXG4gICAqIEBwYXJhbSB7b2JqZWN0fSBqc29uX21zZyAtIHRoZSBwYXJzZWQganNvbiBtZXNzYWdlIGFzIHJlY2VpdmVkLlxuICAgKi9cbiAgamlmZkNsaWVudC5oYW5kbGVycy5yZWNlaXZlX3NoYXJlID0gZnVuY3Rpb24gKGpzb25fbXNnKSB7XG4gICAgLy8gRGVjcnlwdCBzaGFyZVxuICAgIGpzb25fbXNnWydzaGFyZSddID0gamlmZkNsaWVudC5ob29rcy5kZWNyeXB0U2lnbihqaWZmQ2xpZW50LCBqc29uX21zZ1snc2hhcmUnXSwgamlmZkNsaWVudC5zZWNyZXRfa2V5LCBqaWZmQ2xpZW50LmtleW1hcFtqc29uX21zZ1sncGFydHlfaWQnXV0pO1xuICAgIGpzb25fbXNnID0gamlmZkNsaWVudC5ob29rcy5leGVjdXRlX2FycmF5X2hvb2tzKCdhZnRlck9wZXJhdGlvbicsIFtqaWZmQ2xpZW50LCAnc2hhcmUnLCBqc29uX21zZ10sIDIpO1xuXG4gICAgdmFyIHNlbmRlcl9pZCA9IGpzb25fbXNnWydwYXJ0eV9pZCddO1xuICAgIHZhciBvcF9pZCA9IGpzb25fbXNnWydvcF9pZCddO1xuICAgIHZhciBzaGFyZSA9IGpzb25fbXNnWydzaGFyZSddO1xuXG4gICAgLy8gQ2FsbCBob29rXG4gICAgc2hhcmUgPSBqaWZmQ2xpZW50Lmhvb2tzLmV4ZWN1dGVfYXJyYXlfaG9va3MoJ3JlY2VpdmVTaGFyZScsIFtqaWZmQ2xpZW50LCBzZW5kZXJfaWQsIHNoYXJlXSwgMik7XG5cbiAgICAvLyBjaGVjayBpZiBhIGRlZmVycmVkIGlzIHNldCB1cCAobWF5YmUgdGhlIHNoYXJlIHdhcyByZWNlaXZlZCBlYXJseSlcbiAgICBpZiAoamlmZkNsaWVudC5kZWZlcnJlZHNbb3BfaWRdID09IG51bGwpIHtcbiAgICAgIGppZmZDbGllbnQuZGVmZXJyZWRzW29wX2lkXSA9IHt9O1xuICAgIH1cbiAgICBpZiAoamlmZkNsaWVudC5kZWZlcnJlZHNbb3BfaWRdW3NlbmRlcl9pZF0gPT0gbnVsbCkge1xuICAgICAgLy8gU2hhcmUgaXMgcmVjZWl2ZWQgYmVmb3JlIGRlZmVycmVkIHdhcyBzZXR1cCwgc3RvcmUgaXQuXG4gICAgICBqaWZmQ2xpZW50LmRlZmVycmVkc1tvcF9pZF1bc2VuZGVyX2lkXSA9IG5ldyBqaWZmQ2xpZW50LmhlbHBlcnMuRGVmZXJyZWQoKTtcbiAgICB9XG5cbiAgICAvLyBEZWZlcnJlZCBpcyBhbHJlYWR5IHNldHVwLCByZXNvbHZlIGl0LlxuICAgIGppZmZDbGllbnQuZGVmZXJyZWRzW29wX2lkXVtzZW5kZXJfaWRdLnJlc29sdmUoc2hhcmUpO1xuICB9O1xuXG4gIC8qKlxuICAgKiBSZXNvbHZlcyB0aGUgZGVmZXJyZWQgY29ycmVzcG9uZGluZyB0byBvcGVyYXRpb25faWQgYW5kIHNlbmRlcl9pZC5cbiAgICogQG1ldGhvZFxuICAgKiBAbWVtYmVyb2YgaGFuZGxlcnNcbiAgICogQHBhcmFtIHtvYmplY3R9IGpzb25fbXNnIC0gdGhlIGpzb24gbWVzc2FnZSBhcyByZWNlaXZlZCB3aXRoIHRoZSBvcGVuIGV2ZW50LlxuICAgKi9cbiAgamlmZkNsaWVudC5oYW5kbGVycy5yZWNlaXZlX29wZW4gPSBmdW5jdGlvbiAoanNvbl9tc2cpIHtcbiAgICAvLyBEZWNyeXB0IHNoYXJlXG4gICAgaWYgKGpzb25fbXNnWydwYXJ0eV9pZCddICE9PSBqaWZmQ2xpZW50LmlkKSB7XG4gICAgICBqc29uX21zZ1snc2hhcmUnXSA9IGppZmZDbGllbnQuaG9va3MuZGVjcnlwdFNpZ24oamlmZkNsaWVudCwganNvbl9tc2dbJ3NoYXJlJ10sIGppZmZDbGllbnQuc2VjcmV0X2tleSwgamlmZkNsaWVudC5rZXltYXBbanNvbl9tc2dbJ3BhcnR5X2lkJ11dKTtcbiAgICAgIGpzb25fbXNnID0gamlmZkNsaWVudC5ob29rcy5leGVjdXRlX2FycmF5X2hvb2tzKCdhZnRlck9wZXJhdGlvbicsIFtqaWZmQ2xpZW50LCAnb3BlbicsIGpzb25fbXNnXSwgMik7XG4gICAgfVxuXG4gICAgdmFyIHNlbmRlcl9pZCA9IGpzb25fbXNnWydwYXJ0eV9pZCddO1xuICAgIHZhciBvcF9pZCA9IGpzb25fbXNnWydvcF9pZCddO1xuICAgIHZhciBzaGFyZSA9IGpzb25fbXNnWydzaGFyZSddO1xuICAgIHZhciBacCA9IGpzb25fbXNnWydacCddO1xuXG4gICAgLy8gY2FsbCBob29rXG4gICAgc2hhcmUgPSBqaWZmQ2xpZW50Lmhvb2tzLmV4ZWN1dGVfYXJyYXlfaG9va3MoJ3JlY2VpdmVPcGVuJywgW2ppZmZDbGllbnQsIHNlbmRlcl9pZCwgc2hhcmUsIFpwXSwgMik7XG5cbiAgICAvLyBFbnN1cmUgZGVmZXJyZWQgaXMgc2V0dXBcbiAgICBpZiAoamlmZkNsaWVudC5kZWZlcnJlZHNbb3BfaWRdID09IG51bGwpIHtcbiAgICAgIGppZmZDbGllbnQuZGVmZXJyZWRzW29wX2lkXSA9IHt9O1xuICAgIH1cbiAgICBpZiAoamlmZkNsaWVudC5kZWZlcnJlZHNbb3BfaWRdLnNoYXJlcyA9PSBudWxsKSB7XG4gICAgICBqaWZmQ2xpZW50LmRlZmVycmVkc1tvcF9pZF0uc2hhcmVzID0gW107XG4gICAgfVxuXG4gICAgLy8gQWNjdW11bGF0ZSByZWNlaXZlZCBzaGFyZXNcbiAgICBqaWZmQ2xpZW50LmRlZmVycmVkc1tvcF9pZF0uc2hhcmVzLnB1c2goe3ZhbHVlOiBzaGFyZSwgc2VuZGVyX2lkOiBzZW5kZXJfaWQsIFpwOiBacH0pO1xuXG4gICAgLy8gUmVzb2x2ZSB3aGVuIHJlYWR5XG4gICAgaWYgKGppZmZDbGllbnQuZGVmZXJyZWRzW29wX2lkXS5zaGFyZXMubGVuZ3RoID09PSBqaWZmQ2xpZW50LmRlZmVycmVkc1tvcF9pZF0udGhyZXNob2xkKSB7XG4gICAgICBqaWZmQ2xpZW50LmRlZmVycmVkc1tvcF9pZF0uZGVmZXJyZWQucmVzb2x2ZSgpO1xuICAgIH1cblxuICAgIC8vIENsZWFuIHVwIGlmIGRvbmVcbiAgICBpZiAoamlmZkNsaWVudC5kZWZlcnJlZHNbb3BfaWRdICE9IG51bGwgJiYgamlmZkNsaWVudC5kZWZlcnJlZHNbb3BfaWRdLmRlZmVycmVkID09PSAnQ0xFQU4nICYmIGppZmZDbGllbnQuZGVmZXJyZWRzW29wX2lkXS5zaGFyZXMubGVuZ3RoID09PSBqaWZmQ2xpZW50LmRlZmVycmVkc1tvcF9pZF0udG90YWwpIHtcbiAgICAgIGRlbGV0ZSBqaWZmQ2xpZW50LmRlZmVycmVkc1tvcF9pZF07XG4gICAgfVxuICB9XG59OyIsIi8qKiBEb3VibHkgbGlua2VkIGxpc3Qgd2l0aCBhZGQgYW5kIHJlbW92ZSBmdW5jdGlvbnMgYW5kIHBvaW50ZXJzIHRvIGhlYWQgYW5kIHRhaWwqKi9cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKCkge1xuICAvLyBhdHRyaWJ1dGVzOiBsaXN0LmhlYWQgYW5kIGxpc3QudGFpbFxuICAvLyBmdW5jdGlvbnM6IGxpc3QuYWRkKG9iamVjdCkgKHJldHVybnMgcG9pbnRlciksIGxpc3QucmVtb3ZlKHBvaW50ZXIpXG4gIC8vIGxpc3QuaGVhZC9saXN0LnRhaWwvYW55IGVsZW1lbnQgY29udGFpbnM6XG4gIC8vICAgIG5leHQ6IHBvaW50ZXIgdG8gbmV4dCxcbiAgLy8gICAgcHJldmlvdXM6IHBvaW50ZXIgdG8gcHJldmlvdXMsXG4gIC8vICAgIG9iamVjdDogc3RvcmVkIG9iamVjdC5cbiAgdmFyIGxpc3QgPSB7aGVhZDogbnVsbCwgdGFpbDogbnVsbH07XG4gIC8vIFRPRE8gcmVuYW1lIHRoaXMgdG8gcHVzaFRhaWwgfHwgcHVzaFxuICBsaXN0LmFkZCA9IGZ1bmN0aW9uIChvYmopIHtcbiAgICB2YXIgbm9kZSA9IHsgb2JqZWN0OiBvYmosIG5leHQ6IG51bGwsIHByZXZpb3VzOiBudWxsIH07XG4gICAgaWYgKGxpc3QuaGVhZCA9PSBudWxsKSB7XG4gICAgICBsaXN0LmhlYWQgPSBub2RlO1xuICAgICAgbGlzdC50YWlsID0gbm9kZTtcbiAgICB9IGVsc2Uge1xuICAgICAgbGlzdC50YWlsLm5leHQgPSBub2RlO1xuICAgICAgbm9kZS5wcmV2aW91cyA9IGxpc3QudGFpbDtcbiAgICAgIGxpc3QudGFpbCA9IG5vZGU7XG4gICAgfVxuICAgIHJldHVybiBub2RlO1xuICB9O1xuXG4gIGxpc3QucHVzaEhlYWQgPSBmdW5jdGlvbiAob2JqKSB7XG4gICAgbGlzdC5oZWFkID0ge29iamVjdDogb2JqLCBuZXh0IDogbGlzdC5oZWFkLCBwcmV2aW91cyA6IG51bGx9O1xuICAgIGlmIChsaXN0LmhlYWQubmV4dCAhPSBudWxsKSB7XG4gICAgICBsaXN0LmhlYWQubmV4dC5wcmV2aW91cyA9IGxpc3QuaGVhZDtcbiAgICB9IGVsc2Uge1xuICAgICAgbGlzdC50YWlsID0gbGlzdC5oZWFkO1xuICAgIH1cbiAgfTtcblxuICBsaXN0LnBvcEhlYWQgPSBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHJlc3VsdCA9IGxpc3QuaGVhZDtcbiAgICBpZiAobGlzdC5oZWFkICE9IG51bGwpIHtcbiAgICAgIGxpc3QuaGVhZCA9IGxpc3QuaGVhZC5uZXh0O1xuICAgICAgaWYgKGxpc3QuaGVhZCA9PSBudWxsKSB7XG4gICAgICAgIGxpc3QudGFpbCA9IG51bGw7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBsaXN0LmhlYWQucHJldmlvdXMgID0gbnVsbDtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfTtcblxuICAvLyBtZXJnZXMgdHdvIGxpbmtlZCBsaXN0cyBhbmQgcmV0dXJuIGEgcG9pbnRlciB0byB0aGUgaGVhZCBvZiB0aGUgbWVyZ2VkIGxpc3RcbiAgLy8gdGhlIGhlYWQgd2lsbCBiZSB0aGUgaGVhZCBvZiBsaXN0IGFuZCB0aGUgdGFpbCB0aGUgdGFpbCBvZiBsMlxuICBsaXN0LmV4dGVuZCA9IGZ1bmN0aW9uIChsMikge1xuICAgIGlmIChsaXN0LmhlYWQgPT0gbnVsbCkge1xuICAgICAgcmV0dXJuIGwyO1xuICAgIH1cbiAgICBpZiAobDIuaGVhZCA9PSBudWxsKSB7XG4gICAgICByZXR1cm4gbGlzdDtcbiAgICB9XG4gICAgbGlzdC50YWlsLm5leHQgPSBsMi5oZWFkO1xuICAgIGwyLmhlYWQucHJldmlvdXMgPSBsaXN0LnRhaWw7XG4gICAgbGlzdC50YWlsID0gbDIudGFpbDtcblxuICAgIHJldHVybiBsaXN0O1xuICB9O1xuXG4gIGxpc3QucmVtb3ZlID0gZnVuY3Rpb24gKHB0cikge1xuICAgIHZhciBwcmV2ID0gcHRyLnByZXZpb3VzO1xuICAgIHZhciBuZXh0ID0gcHRyLm5leHQ7XG5cbiAgICBpZiAocHJldiA9PSBudWxsICYmIGxpc3QuaGVhZCAhPT0gcHRyKSB7XG4gICAgICByZXR1cm47XG4gICAgfSBlbHNlIGlmIChuZXh0ID09IG51bGwgJiYgbGlzdC50YWlsICE9PSBwdHIpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAocHJldiA9PSBudWxsKSB7IC8vIHB0ciBpcyBoZWFkIChvciBib3RoIGhlYWQgYW5kIHRhaWwpXG4gICAgICBsaXN0LmhlYWQgPSBuZXh0O1xuICAgICAgaWYgKGxpc3QuaGVhZCAhPSBudWxsKSB7XG4gICAgICAgIGxpc3QuaGVhZC5wcmV2aW91cyA9IG51bGw7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBsaXN0LnRhaWwgPSBudWxsO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAobmV4dCA9PSBudWxsKSB7IC8vIHB0ciBpcyB0YWlsIChhbmQgbm90IGhlYWQpXG4gICAgICBsaXN0LnRhaWwgPSBwcmV2O1xuICAgICAgcHJldi5uZXh0ID0gbnVsbDtcbiAgICB9IGVsc2UgeyAvLyBwdHIgaXMgaW5zaWRlXG4gICAgICBwcmV2Lm5leHQgPSBuZXh0O1xuICAgICAgbmV4dC5wcmV2aW91cyA9IHByZXY7XG4gICAgfVxuICB9O1xuICBsaXN0LnNsaWNlID0gZnVuY3Rpb24gKHB0cikgeyAvLyByZW1vdmUgYWxsIGVsZW1lbnRzIGZyb20gaGVhZCB0byBwdHIgKGluY2x1ZGluZyBwdHIpLlxuICAgIGlmIChwdHIgPT0gbnVsbCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8qIENPTlNFUlZBVElWRTogbWFrZSBzdXJlIHB0ciBpcyBwYXJ0IG9mIHRoZSBsaXN0IHRoZW4gcmVtb3ZlICovXG4gICAgdmFyIGN1cnJlbnQgPSBsaXN0LmhlYWQ7XG4gICAgd2hpbGUgKGN1cnJlbnQgIT0gbnVsbCkge1xuICAgICAgaWYgKGN1cnJlbnQgPT09IHB0cikge1xuICAgICAgICBsaXN0LmhlYWQgPSBwdHIubmV4dDtcbiAgICAgICAgaWYgKGxpc3QuaGVhZCA9PSBudWxsKSB7XG4gICAgICAgICAgbGlzdC50YWlsID0gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIGN1cnJlbnQgPSBjdXJyZW50Lm5leHQ7XG4gICAgfVxuXG4gICAgLyogTU9SRSBBR0dSRVNTSVZFIFZFUlNJT046IHdpbGwgYmUgaW5jb3JyZWN0IGlmIHB0ciBpcyBub3QgaW4gdGhlIGxpc3QgKi9cbiAgICAvKlxuICAgIGxpc3QuaGVhZCA9IHB0ci5uZXh0O1xuICAgIGlmIChsaXN0LmhlYWQgPT0gbnVsbCkge1xuICAgICAgbGlzdC50YWlsID0gbnVsbDtcbiAgICB9XG4gICAgKi9cbiAgfTtcbiAgLypcbiAgbGlzdC5fZGVidWdfbGVuZ3RoID0gZnVuY3Rpb24gKCkge1xuICAgIHZhciBsID0gMDtcbiAgICB2YXIgY3VycmVudCA9IGxpc3QuaGVhZDtcbiAgICB3aGlsZSAoY3VycmVudCAhPSBudWxsKSB7XG4gICAgICBjdXJyZW50ID0gY3VycmVudC5uZXh0O1xuICAgICAgbCsrO1xuICAgIH1cbiAgICByZXR1cm4gbDtcbiAgfTtcbiAgKi9cbiAgcmV0dXJuIGxpc3Q7XG59O1xuIiwiLyoqXG4gKiBUaGlzIGRlZmluZXMgYSBsaWJyYXJ5IGV4dGVuc2lvbiBmb3IgdXNpbmcgd2Vic29ja2V0cyByYXRoZXIgdGhhbiBzb2NrZXQuaW8gZm9yIGNvbW11bmljYXRpb24uIFRoaXNcbiAqIGV4dGVuc2lvbiBwcmltYXJpbHkgZWRpdHMvb3ZlcndyaXRlcyBleGlzdGluZyBzb2NrZXQgZnVuY3Rpb25zIHRvIHVzZSBhbmQgYmUgY29tcGF0aWJsZSB3aXRoIHRoZVxuICogd3MgbGlicmFyeS5cbiAqIEBuYW1lc3BhY2UgamlmZmNsaWVudF93ZWJzb2NrZXRzXG4gKiBAdmVyc2lvbiAxLjBcbiAqXG4gKiBSRVFVSVJFTUVOVFM6XG4gKiBZb3UgbXVzdCBhcHBseSB0aGlzIGV4dGVuc2lvbiB0byB5b3VyIGNsaWVudCBhbmQgdGhlIHNlcnZlciB5b3UncmUgY29tbXVuaWNhdGluZyB3aXRoIG11c3QgYXBwbHkgamlmZnNlcnZlcl93ZWJzb2NrZXRzLlxuICovXG5cblxuXG5cbi8qKlxuICogVGhlIG5hbWUgb2YgdGhpcyBleHRlbnNpb246ICd3ZWJzb2NrZXQnXG4gKiBAdHlwZSB7c3RyaW5nfVxuICogQG1lbWJlck9mIGppZmZjbGllbnRfd2Vic29ja2V0c1xuICovXG5cbnZhciB3cztcbnZhciBsaW5rZWRMaXN0O1xudmFyIGhhbmRsZXJzO1xuXG5saW5rZWRMaXN0ID0gcmVxdWlyZSgnLi4vY29tbW9uL2xpbmtlZGxpc3QuanMnKTtcbmhhbmRsZXJzID0gcmVxdWlyZSgnLi4vY2xpZW50L2hhbmRsZXJzLmpzJyk7XG5pZiAoIXByb2Nlc3MuYnJvd3Nlcikge1xuICB3cyA9IHJlcXVpcmUoJ3dzJyk7XG59IGVsc2Uge1xuICBpZiAodHlwZW9mIFdlYlNvY2tldCAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICB3cyA9IFdlYlNvY2tldFxuICB9IGVsc2UgaWYgKHR5cGVvZiBNb3pXZWJTb2NrZXQgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgd3MgPSBNb3pXZWJTb2NrZXRcbiAgfSBlbHNlIGlmICh0eXBlb2YgZ2xvYmFsICE9PSAndW5kZWZpbmVkJykge1xuICAgIHdzID0gZ2xvYmFsLldlYlNvY2tldCB8fCBnbG9iYWwuTW96V2ViU29ja2V0XG4gIH0gZWxzZSBpZiAodHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICB3cyA9IHdpbmRvdy5XZWJTb2NrZXQgfHwgd2luZG93Lk1veldlYlNvY2tldFxuICB9IGVsc2UgaWYgKHR5cGVvZiBzZWxmICE9PSAndW5kZWZpbmVkJykge1xuICAgIHdzID0gc2VsZi5XZWJTb2NrZXQgfHwgc2VsZi5Nb3pXZWJTb2NrZXRcbiAgfVxufVxuXG5cbi8vIFRha2UgdGhlIGppZmYtY2xpZW50IGJhc2UgaW5zdGFuY2UgYW5kIG9wdGlvbnMgZm9yIHRoaXMgZXh0ZW5zaW9uLCBhbmQgdXNlIHRoZW1cbi8vIHRvIGNvbnN0cnVjdCBhbiBpbnN0YW5jZSBmb3IgdGhpcyBleHRlbnNpb24uXG5mdW5jdGlvbiBtYWtlX2ppZmYoYmFzZV9pbnN0YW5jZSwgb3B0aW9ucykge1xuICB2YXIgamlmZiA9IGJhc2VfaW5zdGFuY2U7XG5cbiAgLy8gUGFyc2Ugb3B0aW9uc1xuICBpZiAob3B0aW9ucyA9PSBudWxsKSB7XG4gICAgb3B0aW9ucyA9IHt9O1xuICB9XG5cbiAgLyogRnVuY3Rpb25zIHRoYXQgb3ZlcndyaXRlIGNsaWVudC9zb2NrZXQvZXZlbnRzLmpzIGZ1bmN0aW9uYWxpdHkgKi9cblxuICAvKipcbiAgICogaW5pdFNvY2tldCdzICcub24nIGZ1bmN0aW9ucyBuZWVkZWQgdG8gYmUgcmVwbGFjZWQgc2luY2Ugd3MgZG9lc1xuICAgKiBub3QgaGF2ZSBhcyBtYW55IHByb3RvY29scy4gSW5zdGVhZCB0aGVzZSBmdW5jdGlvbnMgYXJlIHJvdXRlZCB0b1xuICAgKiB3aGVuIGEgbWVzc2FnZSBpcyByZWNlaXZlZCBhbmQgYSBwcm90b2NvbCBpcyBtYW51YWxseSBwYXJzZWQuXG4gICAqL1xuICBqaWZmLmluaXRTb2NrZXQgPSBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIGppZmZDbGllbnQgPSB0aGlzO1xuXG4gICAgLyogd3MgdXNlcyB0aGUgJ29wZW4nIHByb3RvY29sIG9uIGNvbm5lY3Rpb24uIFNob3VsZCBub3QgY29uZmxpY3Qgd2l0aCB0aGVcbiAgICAgICAgIEpJRkYgb3BlbiBwcm90b2NsIGFzIHRoYXQgd2lsbCBiZSBzZW50IGFzIGEgbWVzc2FnZSBhbmQgd3NcbiAgICAgICAgIHdpbGwgc2VlIGl0IGFzIGEgJ21lc3NhZ2UnIHByb3RvY29sLiAqL1xuICAgIHRoaXMuc29ja2V0Lm9ub3BlbiA9IGppZmZDbGllbnQuaGFuZGxlcnMuY29ubmVjdGVkO1xuXG4gICAgLy8gUHVibGljIGtleXMgd2VyZSB1cGRhdGVkIG9uIHRoZSBzZXJ2ZXIsIGFuZCBpdCBzZW50IHVzIHRoZSB1cGRhdGVzXG4gICAgZnVuY3Rpb24gcHVibGljS2V5c0NoYW5nZWQobXNnLCBjYWxsYmFjaykge1xuXG4gICAgICBtc2cgPSBKU09OLnBhcnNlKG1zZyk7XG4gICAgICBtc2cgPSBqaWZmQ2xpZW50Lmhvb2tzLmV4ZWN1dGVfYXJyYXlfaG9va3MoJ2FmdGVyT3BlcmF0aW9uJywgW2ppZmZDbGllbnQsICdwdWJsaWNfa2V5cycsIG1zZ10sIDIpO1xuXG4gICAgICBqaWZmQ2xpZW50LmhhbmRsZXJzLnN0b3JlX3B1YmxpY19rZXlzKG1zZy5wdWJsaWNfa2V5cyk7XG4gICAgfVxuXG4gICAgLy8gU2V0dXAgcmVjZWl2aW5nIG1hdGNoaW5nIHNoYXJlc1xuICAgIGZ1bmN0aW9uIHNoYXJlKG1zZywgY2FsbGJhY2spIHtcblxuICAgICAgLy8gcGFyc2UgbWVzc2FnZVxuICAgICAgdmFyIGpzb25fbXNnID0gSlNPTi5wYXJzZShtc2cpO1xuICAgICAgdmFyIHNlbmRlcl9pZCA9IGpzb25fbXNnWydwYXJ0eV9pZCddO1xuXG4gICAgICBpZiAoamlmZkNsaWVudC5rZXltYXBbc2VuZGVyX2lkXSAhPSBudWxsKSB7XG4gICAgICAgIGppZmZDbGllbnQuaGFuZGxlcnMucmVjZWl2ZV9zaGFyZShqc29uX21zZyk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBpZiAoamlmZkNsaWVudC5tZXNzYWdlc1dhaXRpbmdLZXlzW3NlbmRlcl9pZF0gPT0gbnVsbCkge1xuICAgICAgICAgIGppZmZDbGllbnQubWVzc2FnZXNXYWl0aW5nS2V5c1tzZW5kZXJfaWRdID0gW107XG4gICAgICAgIH1cbiAgICAgICAgamlmZkNsaWVudC5tZXNzYWdlc1dhaXRpbmdLZXlzW3NlbmRlcl9pZF0ucHVzaCh7bGFiZWw6ICdzaGFyZScsIG1zZzoganNvbl9tc2d9KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBtcGNPcGVuKG1zZywgY2FsbGJhY2spIHtcbiAgICAgIC8vIHBhcnNlIG1lc3NhZ2VcbiAgICAgIHZhciBqc29uX21zZyA9IEpTT04ucGFyc2UobXNnKTtcbiAgICAgIHZhciBzZW5kZXJfaWQgPSBqc29uX21zZ1sncGFydHlfaWQnXTtcblxuICAgICAgaWYgKGppZmZDbGllbnQua2V5bWFwW3NlbmRlcl9pZF0gIT0gbnVsbCkge1xuICAgICAgICBqaWZmQ2xpZW50LmhhbmRsZXJzLnJlY2VpdmVfb3Blbihqc29uX21zZyk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBpZiAoamlmZkNsaWVudC5tZXNzYWdlc1dhaXRpbmdLZXlzW3NlbmRlcl9pZF0gPT0gbnVsbCkge1xuICAgICAgICAgIGppZmZDbGllbnQubWVzc2FnZXNXYWl0aW5nS2V5c1tzZW5kZXJfaWRdID0gW107XG4gICAgICAgIH1cbiAgICAgICAgamlmZkNsaWVudC5tZXNzYWdlc1dhaXRpbmdLZXlzW3NlbmRlcl9pZF0ucHVzaCh7bGFiZWw6ICdvcGVuJywgbXNnOiBqc29uX21zZ30pO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIGhhbmRsZSBjdXN0b20gbWVzc2FnZXNcbiAgICBmdW5jdGlvbiBzb2NrZXRDdXN0b20obXNnLCBjYWxsYmFjaykge1xuICAgICAgdmFyIGpzb25fbXNnID0gSlNPTi5wYXJzZShtc2cpO1xuICAgICAgdmFyIHNlbmRlcl9pZCA9IGpzb25fbXNnWydwYXJ0eV9pZCddO1xuICAgICAgdmFyIGVuY3J5cHRlZCA9IGpzb25fbXNnWydlbmNyeXB0ZWQnXTtcblxuICAgICAgaWYgKGppZmZDbGllbnQua2V5bWFwW3NlbmRlcl9pZF0gIT0gbnVsbCB8fCBlbmNyeXB0ZWQgIT09IHRydWUpIHtcbiAgICAgICAgamlmZkNsaWVudC5oYW5kbGVycy5yZWNlaXZlX2N1c3RvbShqc29uX21zZyk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBrZXkgbXVzdCBub3QgZXhpc3QgeWV0IGZvciBzZW5kZXJfaWQsIGFuZCBlbmNyeXB0ZWQgbXVzdCBiZSB0cnVlXG4gICAgICAgIGlmIChqaWZmQ2xpZW50Lm1lc3NhZ2VzV2FpdGluZ0tleXNbc2VuZGVyX2lkXSA9PSBudWxsKSB7XG4gICAgICAgICAgamlmZkNsaWVudC5tZXNzYWdlc1dhaXRpbmdLZXlzW3NlbmRlcl9pZF0gPSBbXTtcbiAgICAgICAgfVxuICAgICAgICBqaWZmQ2xpZW50Lm1lc3NhZ2VzV2FpdGluZ0tleXNbc2VuZGVyX2lkXS5wdXNoKHtsYWJlbDogJ2N1c3RvbScsIG1zZzoganNvbl9tc2d9KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBjcnlwdG9Qcm92aWRlcihtc2csIGNhbGxiYWNrKSB7XG4gICAgICBqaWZmQ2xpZW50LmhhbmRsZXJzLnJlY2VpdmVfY3J5cHRvX3Byb3ZpZGVyKEpTT04ucGFyc2UobXNnKSk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gb25FcnJvcihtc2cpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIG1zZyA9IEpTT04ucGFyc2UobXNnKTtcbiAgICAgICAgamlmZkNsaWVudC5oYW5kbGVycy5lcnJvcihtc2dbJ2xhYmVsJ10sIG1zZ1snZXJyb3InXSk7XG4gICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBqaWZmQ2xpZW50LmhhbmRsZXJzLmVycm9yKCdzb2NrZXQuaW8nLCBtc2cpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIHNvY2tldENsb3NlKHJlYXNvbikge1xuICAgICAgaWYgKHJlYXNvbiAhPT0gJ2lvIGNsaWVudCBkaXNjb25uZWN0Jykge1xuICAgICAgICAvLyBjaGVjayB0aGF0IHRoZSByZWFzb24gaXMgYW4gZXJyb3IgYW5kIG5vdCBhIHVzZXIgaW5pdGlhdGVkIGRpc2Nvbm5lY3RcbiAgICAgICAgY29uc29sZS5sb2coJ0Rpc2Nvbm5lY3RlZCEnLCBqaWZmQ2xpZW50LmlkLCByZWFzb24pO1xuICAgICAgfVxuXG4gICAgICBqaWZmQ2xpZW50Lmhvb2tzLmV4ZWN1dGVfYXJyYXlfaG9va3MoJ2FmdGVyT3BlcmF0aW9uJywgW2ppZmZDbGllbnQsICdkaXNjb25uZWN0JywgcmVhc29uXSwgLTEpO1xuICAgIH1cblxuICAgIHRoaXMuc29ja2V0Lm9uY2xvc2UgPSBmdW5jdGlvbiAocmVhc29uKSB7XG4gICAgICBzb2NrZXRDbG9zZShyZWFzb24uY29kZSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSW4gZXZlcnkgbWVzc2FnZSBzZW50IG92ZXIgd3MsIHdlIHdpbGwgc2VuZCBhbG9uZyB3aXRoIGl0IGEgc29ja2V0UHJvdG9jb2wgc3RyaW5nXG4gICAgICogdGhhdCB3aWxsIGJlIHBhcnNlZCBieSB0aGUgcmVjZWl2ZXIgdG8gcm91dGUgdGhlIHJlcXVlc3QgdG8gdGhlIGNvcnJlY3QgZnVuY3Rpb24uIFRoZVxuICAgICAqIHByZXZpb3VzIGluZm9ybWF0aW9uIHNlbnQgYnkgc29ja2V0LmlvIHdpbGwgYmUgdW50b3VjaGVkLCBidXQgbm93IHNlbnQgaW5zaWRlIG9mIG1zZy5kYXRhLlxuICAgICAqL1xuICAgIHRoaXMuc29ja2V0Lm9ubWVzc2FnZSA9IGZ1bmN0aW9uIChtc2csIGNhbGxiYWNrKSB7XG4gICAgICBtc2cgPSBKU09OLnBhcnNlKG1zZy5kYXRhKTtcblxuICAgICAgc3dpdGNoIChtc2cuc29ja2V0UHJvdG9jb2wpIHtcbiAgICAgICAgY2FzZSAnaW5pdGlhbGl6YXRpb24nOlxuICAgICAgICAgIGppZmZDbGllbnQuaGFuZGxlcnMuaW5pdGlhbGl6ZWQobXNnLmRhdGEpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdwdWJsaWNfa2V5cyc6XG4gICAgICAgICAgcHVibGljS2V5c0NoYW5nZWQobXNnLmRhdGEsIGNhbGxiYWNrKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnc2hhcmUnOlxuICAgICAgICAgIHNoYXJlKG1zZy5kYXRhLCBjYWxsYmFjayk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ29wZW4nOlxuICAgICAgICAgIG1wY09wZW4obXNnLmRhdGEsIGNhbGxiYWNrKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnY3VzdG9tJzpcbiAgICAgICAgICBzb2NrZXRDdXN0b20obXNnLmRhdGEsIGNhbGxiYWNrKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnY3J5cHRvX3Byb3ZpZGVyJzpcbiAgICAgICAgICBjcnlwdG9Qcm92aWRlcihtc2cuZGF0YSwgY2FsbGJhY2spO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdjbG9zZSc6XG4gICAgICAgICAgc29ja2V0Q2xvc2UobXNnLmRhdGEpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdkaXNjb25uZWN0JzpcbiAgICAgICAgICBzb2NrZXRDbG9zZShtc2cuZGF0YSk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ2Vycm9yJzpcbiAgICAgICAgICBvbkVycm9yKG1zZy5kYXRhKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICBjb25zb2xlLmxvZygnVWtub3duIHByb3RvY29sLCAnICsgbXNnLnNvY2tldFByb3RvY29sICsgJywgcmVjZWl2ZWQnKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgfTtcblxuICAvKiBPdmVyd3JpdGUgdGhlIHNvY2tldENvbm5lY3QgZnVuY3Rpb24gZnJvbSBqaWZmLWNsaWVudC5qcyAqL1xuXG4gIGppZmYuc29ja2V0Q29ubmVjdCA9IGZ1bmN0aW9uIChKSUZGQ2xpZW50SW5zdGFuY2UpIHtcbiAgICBKSUZGQ2xpZW50SW5zdGFuY2Uuc29ja2V0ID0gZ3VhcmRlZFNvY2tldChKSUZGQ2xpZW50SW5zdGFuY2UpO1xuXG4gICAgLy8gc2V0IHVwIHNvY2tldCBldmVudCBoYW5kbGVyc1xuICAgIGhhbmRsZXJzKEpJRkZDbGllbnRJbnN0YW5jZSk7XG5cbiAgICAvLyBPdmVyd3JpdGUgaGFuZGxlcnMuY29ubmVjdGVkIHdpdGggb3VyIG5ldyB3cyBjb25uZWN0aW9uIGhhbmRsZXJcbiAgICBKSUZGQ2xpZW50SW5zdGFuY2UuaGFuZGxlcnMuY29ubmVjdGVkID0gZnVuY3Rpb24gKCkge1xuICAgICAgSklGRkNsaWVudEluc3RhbmNlLmluaXRpYWxpemF0aW9uX2NvdW50ZXIrKztcblxuICAgICAgaWYgKEpJRkZDbGllbnRJbnN0YW5jZS5zZWNyZXRfa2V5ID09IG51bGwgJiYgSklGRkNsaWVudEluc3RhbmNlLnB1YmxpY19rZXkgPT0gbnVsbCkge1xuICAgICAgICB2YXIga2V5ID0gSklGRkNsaWVudEluc3RhbmNlLmhvb2tzLmdlbmVyYXRlS2V5UGFpcihKSUZGQ2xpZW50SW5zdGFuY2UpO1xuICAgICAgICBKSUZGQ2xpZW50SW5zdGFuY2Uuc2VjcmV0X2tleSA9IGtleS5zZWNyZXRfa2V5O1xuICAgICAgICBKSUZGQ2xpZW50SW5zdGFuY2UucHVibGljX2tleSA9IGtleS5wdWJsaWNfa2V5O1xuICAgICAgfVxuXG4gICAgICAvLyBJbml0aWFsaXphdGlvbiBtZXNzYWdlXG4gICAgICB2YXIgbXNnID0gSklGRkNsaWVudEluc3RhbmNlLmhhbmRsZXJzLmJ1aWxkX2luaXRpYWxpemF0aW9uX21lc3NhZ2UoKTtcblxuICAgICAgLy8gRG91YmxlIHdyYXAgdGhlIG1zZ1xuICAgICAgbXNnID0gSlNPTi5zdHJpbmdpZnkobXNnKTtcblxuICAgICAgLy8gRW1pdCBpbml0aWFsaXphdGlvbiBtZXNzYWdlIHRvIHNlcnZlclxuICAgICAgSklGRkNsaWVudEluc3RhbmNlLnNvY2tldC5zZW5kKEpTT04uc3RyaW5naWZ5KCB7IHNvY2tldFByb3RvY29sOiAnaW5pdGlhbGl6YXRpb24nLCBkYXRhOiBtc2cgfSkpO1xuICAgIH07XG5cblxuICAgIEpJRkZDbGllbnRJbnN0YW5jZS5pbml0U29ja2V0KCk7XG4gIH1cbiAgLyoqXG4gICAqIEEgZ3VhcmRlZCBzb2NrZXQgd2l0aCBhbiBhdHRhY2hlZCBtYWlsYm94LlxuICAgKlxuICAgKiBUaGUgc29ja2V0IHVzZXMgdGhlIG1haWxib3ggdG8gc3RvcmUgYWxsIG91dGdvaW5nIG1lc3NhZ2VzLCBhbmQgcmVtb3ZlcyB0aGVtIGZyb20gdGhlIG1haWxib3ggb25seSB3aGVuXG4gICAqIHRoZSBzZXJ2ZXIgYWNrbm93bGVkZ2VzIHRoZWlyIHJlY2VpcHQuIFRoZSBzb2NrZXQgcmVzZW5kcyBtYWlsYm94IHVwb24gcmUtY29ubmVjdGlvbi4gRXh0ZW5kcyB7QGxpbmsgaHR0cHM6Ly9zb2NrZXQuaW8vZG9jcy9jbGllbnQtYXBpLyNTb2NrZXR9LlxuICAgKiBAc2VlIHtAbGluayBtb2R1bGU6amlmZi1jbGllbnR+SklGRkNsaWVudCNzb2NrZXR9XG4gICAqIEBuYW1lIEd1YXJkZWRTb2NrZXRcbiAgICogQGFsaWFzIEd1YXJkZWRTb2NrZXRcbiAgICogQGNvbnN0cnVjdG9yXG4gICAqL1xuXG4gIC8qIEZ1bmN0aW9ucyB0aGF0IG92ZXJ3cml0ZSBjbGllbnQvc29ja2V0L21haWxib3guanMgZnVuY3Rpb25hbGl0eSAqL1xuXG4gIGZ1bmN0aW9uIGd1YXJkZWRTb2NrZXQoamlmZkNsaWVudCkge1xuICAgIC8vIENyZWF0ZSBwbGFpbiBzb2NrZXQgaW8gb2JqZWN0IHdoaWNoIHdlIHdpbGwgd3JhcCBpbiB0aGlzXG4gICAgdmFyIHNvY2tldDtcbiAgICBpZihqaWZmQ2xpZW50Lmhvc3RuYW1lLnN0YXJ0c1dpdGgoXCJodHRwXCIpKSB7XG4gICAgICB2YXIgbW9kaWZpZWRIb3N0TmFtZSA9IFwid3NcIiArIGppZmZDbGllbnQuaG9zdG5hbWUuc3Vic3RyaW5nKGppZmZDbGllbnQuaG9zdG5hbWUuaW5kZXhPZihcIjpcIikpXG4gICAgICBjb25zb2xlLmxvZyhtb2RpZmllZEhvc3ROYW1lKVxuICAgICAgc29ja2V0ID0gbmV3IHdzKG1vZGlmaWVkSG9zdE5hbWUpXG4gICAgfSBlbHNlIHtcbiAgICAgIHNvY2tldCA9IG5ldyB3cyhqaWZmQ2xpZW50Lmhvc3RuYW1lKTtcbiAgICB9XG5cblxuICAgIHNvY2tldC5vbGRfZGlzY29ubmVjdCA9IHNvY2tldC5jbG9zZTtcblxuICAgIHNvY2tldC5tYWlsYm94ID0gbGlua2VkTGlzdCgpOyAvLyBmb3Igb3V0Z29pbmcgbWVzc2FnZXNcbiAgICBzb2NrZXQuZW1wdHlfZGVmZXJyZWQgPSBudWxsOyAvLyBnZXRzIHJlc29sdmVkIHdoZW5ldmVyIHRoZSBtYWlsYm94IGlzIGVtcHR5XG4gICAgc29ja2V0LmppZmZDbGllbnQgPSBqaWZmQ2xpZW50O1xuXG4gICAgLy8gYWRkIGZ1bmN0aW9uYWxpdHkgdG8gc29ja2V0XG4gICAgc29ja2V0LnNhZmVfZW1pdCA9IHNhZmVfZW1pdC5iaW5kKHNvY2tldCk7XG4gICAgc29ja2V0LnJlc2VuZF9tYWlsYm94ID0gcmVzZW5kX21haWxib3guYmluZChzb2NrZXQpO1xuICAgIHNvY2tldC5kaXNjb25uZWN0ID0gZGlzY29ubmVjdC5iaW5kKHNvY2tldCk7XG4gICAgc29ja2V0LnNhZmVfZGlzY29ubmVjdCA9IHNhZmVfZGlzY29ubmVjdC5iaW5kKHNvY2tldCk7XG4gICAgc29ja2V0LmlzX2VtcHR5ID0gaXNfZW1wdHkuYmluZChzb2NrZXQpO1xuXG4gICAgcmV0dXJuIHNvY2tldDtcbiAgfVxuXG4gIC8qKlxuICAgKiBTYWZlIGVtaXQ6IHN0b3JlcyBtZXNzYWdlIGluIHRoZSBtYWlsYm94IHVudGlsIGFja25vd2xlZGdtZW50IGlzIHJlY2VpdmVkLCByZXN1bHRzIGluIHNvY2tldC5lbWl0KGxhYmVsLCBtc2cpIGNhbGwocylcbiAgICogQG1ldGhvZCBzYWZlX2VtaXRcbiAgICogQG1lbWJlcm9mIEd1YXJkZWRTb2NrZXRcbiAgICogQGluc3RhbmNlXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBsYWJlbCAtIHRoZSBsYWJlbCBnaXZlbiB0byB0aGUgbWVzc2FnZVxuICAgKiBAcGFyYW0ge3N0cmluZ30gbXNnIC0gdGhlIG1lc3NhZ2UgdG8gc2VuZFxuICAgKi9cbiAgZnVuY3Rpb24gc2FmZV9lbWl0KGxhYmVsLCBtc2cpIHtcbiAgICAvLyBhZGQgbWVzc2FnZSB0byBtYWlsYm94XG4gICAgdmFyIG1haWxib3hfcG9pbnRlciA9IHRoaXMubWFpbGJveC5hZGQoeyBsYWJlbDogbGFiZWwsIG1zZzogbXNnIH0pO1xuICAgIGlmICh0aGlzLnJlYWR5U3RhdGUgPT09IDEpIHtcbiAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgIC8vIGVtaXQgdGhlIG1lc3NhZ2UsIGlmIGFuIGFja25vd2xlZGdtZW50IGlzIHJlY2VpdmVkLCByZW1vdmUgaXQgZnJvbSBtYWlsYm94XG5cbiAgICAgIHRoaXMuc2VuZChKU09OLnN0cmluZ2lmeSggeyBzb2NrZXRQcm90b2NvbDogbGFiZWwsIGRhdGE6IG1zZyB9ICksIG51bGwsIGZ1bmN0aW9uIChzdGF0dXMpIHtcblxuICAgICAgICBzZWxmLm1haWxib3gucmVtb3ZlKG1haWxib3hfcG9pbnRlcik7XG5cbiAgICAgICAgaWYgKHNlbGYuaXNfZW1wdHkoKSAmJiBzZWxmLmVtcHR5X2RlZmVycmVkICE9IG51bGwpIHtcbiAgICAgICAgICBzZWxmLmVtcHR5X2RlZmVycmVkLnJlc29sdmUoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChsYWJlbCA9PT0gJ2ZyZWUnKSB7XG4gICAgICAgICAgc2VsZi5qaWZmQ2xpZW50Lmhvb2tzLmV4ZWN1dGVfYXJyYXlfaG9va3MoJ2FmdGVyT3BlcmF0aW9uJywgW3NlbGYuamlmZkNsaWVudCwgJ2ZyZWUnLCBtc2ddLCAyKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuXG4gIH1cblxuXG4gIC8qKlxuICAgKiBSZS1zZW5kcyBhbGwgcGVuZGluZyBtZXNzYWdlc1xuICAgKiBAbWV0aG9kIHJlc2VuZF9tYWlsYm94XG4gICAqIEBtZW1iZXJvZiBHdWFyZGVkU29ja2V0XG4gICAqIEBpbnN0YW5jZVxuICAgKi9cbiAgZnVuY3Rpb24gcmVzZW5kX21haWxib3goKSB7XG4gICAgLy8gQ3JlYXRlIGEgbmV3IG1haWxib3gsIHNpbmNlIHRoZSBjdXJyZW50IG1haWxib3ggd2lsbCBiZSByZXNlbnQgYW5kXG4gICAgLy8gd2lsbCBjb250YWluIG5ldyBiYWNrdXBzLlxuICAgIHZhciBvbGRfbWFpbGJveCA9IHRoaXMubWFpbGJveDtcbiAgICB0aGlzLm1haWxib3ggPSBsaW5rZWRMaXN0KCk7XG5cbiAgICAvLyBsb29wIG92ZXIgYWxsIHN0b3JlZCBtZXNzYWdlcyBhbmQgZW1pdCB0aGVtXG4gICAgdmFyIGN1cnJlbnRfbm9kZSA9IG9sZF9tYWlsYm94LmhlYWQ7XG4gICAgd2hpbGUgKGN1cnJlbnRfbm9kZSAhPSBudWxsKSB7XG4gICAgICB2YXIgbGFiZWwgPSBjdXJyZW50X25vZGUub2JqZWN0LmxhYmVsO1xuICAgICAgdmFyIG1zZyA9IGN1cnJlbnRfbm9kZS5vYmplY3QubXNnO1xuICAgICAgdGhpcy5zYWZlX2VtaXQobGFiZWwsIG1zZyk7XG4gICAgICBjdXJyZW50X25vZGUgPSBjdXJyZW50X25vZGUubmV4dDtcbiAgICB9XG5cbiAgfVxuXG5cbiAgLyoqXG4gICAqIFdyYXBzIHNvY2tldCByZWd1bGFyIGRpc2Nvbm5lY3Qgd2l0aCBhIGNhbGwgdG8gYSBob29rIGJlZm9yZSBkaXNjb25uZWN0aW9uXG4gICAqIEBtZXRob2QgZGlzY29ubmVjdFxuICAgKiBAbWVtYmVyb2YgR3VhcmRlZFNvY2tldFxuICAgKiBAaW5zdGFuY2VcbiAgICovXG4gIGZ1bmN0aW9uIGRpc2Nvbm5lY3QoKSB7XG5cbiAgICB0aGlzLmppZmZDbGllbnQuaG9va3MuZXhlY3V0ZV9hcnJheV9ob29rcygnYmVmb3JlT3BlcmF0aW9uJywgW3RoaXMuamlmZkNsaWVudCwgJ2Rpc2Nvbm5lY3QnLCB7fV0sIC0xKTtcblxuXG4gICAgdGhpcy5vbGRfZGlzY29ubmVjdC5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICB9XG5cblxuICAvKipcbiAgICogU2FmZSBkaXNjb25uZWN0OiBkaXNjb25uZWN0IG9ubHkgYWZ0ZXIgYWxsIG1lc3NhZ2VzIChpbmNsdWRpbmcgZnJlZSkgd2VyZSBhY2tub3dsZWRnZWQgYW5kXG4gICAqIGFsbCBwZW5kaW5nIG9wZW5zIHdlcmUgcmVzb2x2ZWRcbiAgICogQG1ldGhvZCBzYWZlX2Rpc2Nvbm5lY3RcbiAgICogQG1lbWJlcm9mIEd1YXJkZWRTb2NrZXRcbiAgICogQGluc3RhbmNlXG4gICAqIEBwYXJhbSB7Ym9vbGVhbn0gW2ZyZWU9ZmFsc2VdIC0gaWYgdHJ1ZSwgYSBmcmVlIG1lc3NhZ2Ugd2lsbCBiZSBpc3N1ZWQgcHJpb3IgdG8gZGlzY29ubmVjdGluZ1xuICAgKiBAcGFyYW0ge2Z1bmN0aW9uKCl9IFtjYWxsYmFja10gLSBnaXZlbiBjYWxsYmFjayB3aWxsIGJlIGV4ZWN1dGVkIGFmdGVyIHNhZmUgZGlzY29ubmVjdGlvbiBpcyBjb21wbGV0ZVxuICAgKi9cbiAgZnVuY3Rpb24gc2FmZV9kaXNjb25uZWN0KGZyZWUsIGNhbGxiYWNrKSB7XG5cbiAgICBpZiAodGhpcy5pc19lbXB0eSgpKSB7XG5cbiAgICAgIGlmIChmcmVlKSB7XG4gICAgICAgIHRoaXMuamlmZkNsaWVudC5mcmVlKCk7XG4gICAgICAgIGZyZWUgPSBmYWxzZTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIFQ6IFNob3VsZCByZW1haW4gXCJkaXNjb25uZWN0XCIgc2luY2Ugd2Ugb3ZlcnJpZGUgdGhlIC5kaXNjb25uZWN0LCBubyBuZWVkIHRvIGNoYW5nZSB0byBjbG9zZVxuICAgICAgICB0aGlzLmRpc2Nvbm5lY3QoKTtcbiAgICAgICAgaWYgKGNhbGxiYWNrICE9IG51bGwpIHtcbiAgICAgICAgICBjYWxsYmFjaygpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICB9XG5cbiAgICB0aGlzLmVtcHR5X2RlZmVycmVkID0gbmV3IHRoaXMuamlmZkNsaWVudC5oZWxwZXJzLkRlZmVycmVkKCk7XG4gICAgdGhpcy5lbXB0eV9kZWZlcnJlZC5wcm9taXNlLnRoZW4odGhpcy5zYWZlX2Rpc2Nvbm5lY3QuYmluZCh0aGlzLCBmcmVlLCBjYWxsYmFjaykpO1xuXG4gIH1cblxuXG4gIC8qKlxuICAgKiBDaGVja3MgaWYgdGhlIHNvY2tldCBtYWlsYm94IGlzIGVtcHR5IChhbGwgY29tbXVuaWNhdGlvbiB3YXMgZG9uZSBhbmQgYWNrbm93bGVkZ2VkKSxcbiAgICogdXNlZCBpbiBzYWZlX2Rpc2Nvbm5lY3RcbiAgICogQG1ldGhvZCBpc19lbXB0eVxuICAgKiBAbWVtYmVyb2YgR3VhcmRlZFNvY2tldFxuICAgKiBAaW5zdGFuY2VcbiAgICovXG4gIGZ1bmN0aW9uIGlzX2VtcHR5KCkge1xuICAgIHJldHVybiB0aGlzLm1haWxib3guaGVhZCA9PSBudWxsICYmIHRoaXMuamlmZkNsaWVudC5jb3VudGVycy5wZW5kaW5nX29wZW5zID09PSAwO1xuXG4gIH1cblxuICAvKiBQUkVQUk9DRVNTSU5HIElTIFRIRSBTQU1FICovXG4gIGppZmYucHJlcHJvY2Vzc2luZ19mdW5jdGlvbl9tYXBbZXhwb3J0cy5uYW1lXSA9IHt9O1xuXG5cbiAgcmV0dXJuIGppZmY7XG59XG4vLyBFeHBvc2UgdGhlIEFQSSBmb3IgdGhpcyBleHRlbnNpb24uXG5cblxubW9kdWxlLmV4cG9ydHMgPSB7bWFrZV9qaWZmOiBtYWtlX2ppZmYsIG5hbWU6ICdqaWZmX3dlYnNvY2tldHMnfTtcbiIsIi8vIHNoaW0gZm9yIHVzaW5nIHByb2Nlc3MgaW4gYnJvd3NlclxudmFyIHByb2Nlc3MgPSBtb2R1bGUuZXhwb3J0cyA9IHt9O1xuXG4vLyBjYWNoZWQgZnJvbSB3aGF0ZXZlciBnbG9iYWwgaXMgcHJlc2VudCBzbyB0aGF0IHRlc3QgcnVubmVycyB0aGF0IHN0dWIgaXRcbi8vIGRvbid0IGJyZWFrIHRoaW5ncy4gIEJ1dCB3ZSBuZWVkIHRvIHdyYXAgaXQgaW4gYSB0cnkgY2F0Y2ggaW4gY2FzZSBpdCBpc1xuLy8gd3JhcHBlZCBpbiBzdHJpY3QgbW9kZSBjb2RlIHdoaWNoIGRvZXNuJ3QgZGVmaW5lIGFueSBnbG9iYWxzLiAgSXQncyBpbnNpZGUgYVxuLy8gZnVuY3Rpb24gYmVjYXVzZSB0cnkvY2F0Y2hlcyBkZW9wdGltaXplIGluIGNlcnRhaW4gZW5naW5lcy5cblxudmFyIGNhY2hlZFNldFRpbWVvdXQ7XG52YXIgY2FjaGVkQ2xlYXJUaW1lb3V0O1xuXG5mdW5jdGlvbiBkZWZhdWx0U2V0VGltb3V0KCkge1xuICAgIHRocm93IG5ldyBFcnJvcignc2V0VGltZW91dCBoYXMgbm90IGJlZW4gZGVmaW5lZCcpO1xufVxuZnVuY3Rpb24gZGVmYXVsdENsZWFyVGltZW91dCAoKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdjbGVhclRpbWVvdXQgaGFzIG5vdCBiZWVuIGRlZmluZWQnKTtcbn1cbihmdW5jdGlvbiAoKSB7XG4gICAgdHJ5IHtcbiAgICAgICAgaWYgKHR5cGVvZiBzZXRUaW1lb3V0ID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICBjYWNoZWRTZXRUaW1lb3V0ID0gc2V0VGltZW91dDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNhY2hlZFNldFRpbWVvdXQgPSBkZWZhdWx0U2V0VGltb3V0O1xuICAgICAgICB9XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgICBjYWNoZWRTZXRUaW1lb3V0ID0gZGVmYXVsdFNldFRpbW91dDtcbiAgICB9XG4gICAgdHJ5IHtcbiAgICAgICAgaWYgKHR5cGVvZiBjbGVhclRpbWVvdXQgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgIGNhY2hlZENsZWFyVGltZW91dCA9IGNsZWFyVGltZW91dDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNhY2hlZENsZWFyVGltZW91dCA9IGRlZmF1bHRDbGVhclRpbWVvdXQ7XG4gICAgICAgIH1cbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIGNhY2hlZENsZWFyVGltZW91dCA9IGRlZmF1bHRDbGVhclRpbWVvdXQ7XG4gICAgfVxufSAoKSlcbmZ1bmN0aW9uIHJ1blRpbWVvdXQoZnVuKSB7XG4gICAgaWYgKGNhY2hlZFNldFRpbWVvdXQgPT09IHNldFRpbWVvdXQpIHtcbiAgICAgICAgLy9ub3JtYWwgZW52aXJvbWVudHMgaW4gc2FuZSBzaXR1YXRpb25zXG4gICAgICAgIHJldHVybiBzZXRUaW1lb3V0KGZ1biwgMCk7XG4gICAgfVxuICAgIC8vIGlmIHNldFRpbWVvdXQgd2Fzbid0IGF2YWlsYWJsZSBidXQgd2FzIGxhdHRlciBkZWZpbmVkXG4gICAgaWYgKChjYWNoZWRTZXRUaW1lb3V0ID09PSBkZWZhdWx0U2V0VGltb3V0IHx8ICFjYWNoZWRTZXRUaW1lb3V0KSAmJiBzZXRUaW1lb3V0KSB7XG4gICAgICAgIGNhY2hlZFNldFRpbWVvdXQgPSBzZXRUaW1lb3V0O1xuICAgICAgICByZXR1cm4gc2V0VGltZW91dChmdW4sIDApO1xuICAgIH1cbiAgICB0cnkge1xuICAgICAgICAvLyB3aGVuIHdoZW4gc29tZWJvZHkgaGFzIHNjcmV3ZWQgd2l0aCBzZXRUaW1lb3V0IGJ1dCBubyBJLkUuIG1hZGRuZXNzXG4gICAgICAgIHJldHVybiBjYWNoZWRTZXRUaW1lb3V0KGZ1biwgMCk7XG4gICAgfSBjYXRjaChlKXtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIC8vIFdoZW4gd2UgYXJlIGluIEkuRS4gYnV0IHRoZSBzY3JpcHQgaGFzIGJlZW4gZXZhbGVkIHNvIEkuRS4gZG9lc24ndCB0cnVzdCB0aGUgZ2xvYmFsIG9iamVjdCB3aGVuIGNhbGxlZCBub3JtYWxseVxuICAgICAgICAgICAgcmV0dXJuIGNhY2hlZFNldFRpbWVvdXQuY2FsbChudWxsLCBmdW4sIDApO1xuICAgICAgICB9IGNhdGNoKGUpe1xuICAgICAgICAgICAgLy8gc2FtZSBhcyBhYm92ZSBidXQgd2hlbiBpdCdzIGEgdmVyc2lvbiBvZiBJLkUuIHRoYXQgbXVzdCBoYXZlIHRoZSBnbG9iYWwgb2JqZWN0IGZvciAndGhpcycsIGhvcGZ1bGx5IG91ciBjb250ZXh0IGNvcnJlY3Qgb3RoZXJ3aXNlIGl0IHdpbGwgdGhyb3cgYSBnbG9iYWwgZXJyb3JcbiAgICAgICAgICAgIHJldHVybiBjYWNoZWRTZXRUaW1lb3V0LmNhbGwodGhpcywgZnVuLCAwKTtcbiAgICAgICAgfVxuICAgIH1cblxuXG59XG5mdW5jdGlvbiBydW5DbGVhclRpbWVvdXQobWFya2VyKSB7XG4gICAgaWYgKGNhY2hlZENsZWFyVGltZW91dCA9PT0gY2xlYXJUaW1lb3V0KSB7XG4gICAgICAgIC8vbm9ybWFsIGVudmlyb21lbnRzIGluIHNhbmUgc2l0dWF0aW9uc1xuICAgICAgICByZXR1cm4gY2xlYXJUaW1lb3V0KG1hcmtlcik7XG4gICAgfVxuICAgIC8vIGlmIGNsZWFyVGltZW91dCB3YXNuJ3QgYXZhaWxhYmxlIGJ1dCB3YXMgbGF0dGVyIGRlZmluZWRcbiAgICBpZiAoKGNhY2hlZENsZWFyVGltZW91dCA9PT0gZGVmYXVsdENsZWFyVGltZW91dCB8fCAhY2FjaGVkQ2xlYXJUaW1lb3V0KSAmJiBjbGVhclRpbWVvdXQpIHtcbiAgICAgICAgY2FjaGVkQ2xlYXJUaW1lb3V0ID0gY2xlYXJUaW1lb3V0O1xuICAgICAgICByZXR1cm4gY2xlYXJUaW1lb3V0KG1hcmtlcik7XG4gICAgfVxuICAgIHRyeSB7XG4gICAgICAgIC8vIHdoZW4gd2hlbiBzb21lYm9keSBoYXMgc2NyZXdlZCB3aXRoIHNldFRpbWVvdXQgYnV0IG5vIEkuRS4gbWFkZG5lc3NcbiAgICAgICAgcmV0dXJuIGNhY2hlZENsZWFyVGltZW91dChtYXJrZXIpO1xuICAgIH0gY2F0Y2ggKGUpe1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgLy8gV2hlbiB3ZSBhcmUgaW4gSS5FLiBidXQgdGhlIHNjcmlwdCBoYXMgYmVlbiBldmFsZWQgc28gSS5FLiBkb2Vzbid0ICB0cnVzdCB0aGUgZ2xvYmFsIG9iamVjdCB3aGVuIGNhbGxlZCBub3JtYWxseVxuICAgICAgICAgICAgcmV0dXJuIGNhY2hlZENsZWFyVGltZW91dC5jYWxsKG51bGwsIG1hcmtlcik7XG4gICAgICAgIH0gY2F0Y2ggKGUpe1xuICAgICAgICAgICAgLy8gc2FtZSBhcyBhYm92ZSBidXQgd2hlbiBpdCdzIGEgdmVyc2lvbiBvZiBJLkUuIHRoYXQgbXVzdCBoYXZlIHRoZSBnbG9iYWwgb2JqZWN0IGZvciAndGhpcycsIGhvcGZ1bGx5IG91ciBjb250ZXh0IGNvcnJlY3Qgb3RoZXJ3aXNlIGl0IHdpbGwgdGhyb3cgYSBnbG9iYWwgZXJyb3IuXG4gICAgICAgICAgICAvLyBTb21lIHZlcnNpb25zIG9mIEkuRS4gaGF2ZSBkaWZmZXJlbnQgcnVsZXMgZm9yIGNsZWFyVGltZW91dCB2cyBzZXRUaW1lb3V0XG4gICAgICAgICAgICByZXR1cm4gY2FjaGVkQ2xlYXJUaW1lb3V0LmNhbGwodGhpcywgbWFya2VyKTtcbiAgICAgICAgfVxuICAgIH1cblxuXG5cbn1cbnZhciBxdWV1ZSA9IFtdO1xudmFyIGRyYWluaW5nID0gZmFsc2U7XG52YXIgY3VycmVudFF1ZXVlO1xudmFyIHF1ZXVlSW5kZXggPSAtMTtcblxuZnVuY3Rpb24gY2xlYW5VcE5leHRUaWNrKCkge1xuICAgIGlmICghZHJhaW5pbmcgfHwgIWN1cnJlbnRRdWV1ZSkge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuICAgIGRyYWluaW5nID0gZmFsc2U7XG4gICAgaWYgKGN1cnJlbnRRdWV1ZS5sZW5ndGgpIHtcbiAgICAgICAgcXVldWUgPSBjdXJyZW50UXVldWUuY29uY2F0KHF1ZXVlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBxdWV1ZUluZGV4ID0gLTE7XG4gICAgfVxuICAgIGlmIChxdWV1ZS5sZW5ndGgpIHtcbiAgICAgICAgZHJhaW5RdWV1ZSgpO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gZHJhaW5RdWV1ZSgpIHtcbiAgICBpZiAoZHJhaW5pbmcpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICB2YXIgdGltZW91dCA9IHJ1blRpbWVvdXQoY2xlYW5VcE5leHRUaWNrKTtcbiAgICBkcmFpbmluZyA9IHRydWU7XG5cbiAgICB2YXIgbGVuID0gcXVldWUubGVuZ3RoO1xuICAgIHdoaWxlKGxlbikge1xuICAgICAgICBjdXJyZW50UXVldWUgPSBxdWV1ZTtcbiAgICAgICAgcXVldWUgPSBbXTtcbiAgICAgICAgd2hpbGUgKCsrcXVldWVJbmRleCA8IGxlbikge1xuICAgICAgICAgICAgaWYgKGN1cnJlbnRRdWV1ZSkge1xuICAgICAgICAgICAgICAgIGN1cnJlbnRRdWV1ZVtxdWV1ZUluZGV4XS5ydW4oKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBxdWV1ZUluZGV4ID0gLTE7XG4gICAgICAgIGxlbiA9IHF1ZXVlLmxlbmd0aDtcbiAgICB9XG4gICAgY3VycmVudFF1ZXVlID0gbnVsbDtcbiAgICBkcmFpbmluZyA9IGZhbHNlO1xuICAgIHJ1bkNsZWFyVGltZW91dCh0aW1lb3V0KTtcbn1cblxucHJvY2Vzcy5uZXh0VGljayA9IGZ1bmN0aW9uIChmdW4pIHtcbiAgICB2YXIgYXJncyA9IG5ldyBBcnJheShhcmd1bWVudHMubGVuZ3RoIC0gMSk7XG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPiAxKSB7XG4gICAgICAgIGZvciAodmFyIGkgPSAxOyBpIDwgYXJndW1lbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBhcmdzW2kgLSAxXSA9IGFyZ3VtZW50c1tpXTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBxdWV1ZS5wdXNoKG5ldyBJdGVtKGZ1biwgYXJncykpO1xuICAgIGlmIChxdWV1ZS5sZW5ndGggPT09IDEgJiYgIWRyYWluaW5nKSB7XG4gICAgICAgIHJ1blRpbWVvdXQoZHJhaW5RdWV1ZSk7XG4gICAgfVxufTtcblxuLy8gdjggbGlrZXMgcHJlZGljdGlibGUgb2JqZWN0c1xuZnVuY3Rpb24gSXRlbShmdW4sIGFycmF5KSB7XG4gICAgdGhpcy5mdW4gPSBmdW47XG4gICAgdGhpcy5hcnJheSA9IGFycmF5O1xufVxuSXRlbS5wcm90b3R5cGUucnVuID0gZnVuY3Rpb24gKCkge1xuICAgIHRoaXMuZnVuLmFwcGx5KG51bGwsIHRoaXMuYXJyYXkpO1xufTtcbnByb2Nlc3MudGl0bGUgPSAnYnJvd3Nlcic7XG5wcm9jZXNzLmJyb3dzZXIgPSB0cnVlO1xucHJvY2Vzcy5lbnYgPSB7fTtcbnByb2Nlc3MuYXJndiA9IFtdO1xucHJvY2Vzcy52ZXJzaW9uID0gJyc7IC8vIGVtcHR5IHN0cmluZyB0byBhdm9pZCByZWdleHAgaXNzdWVzXG5wcm9jZXNzLnZlcnNpb25zID0ge307XG5cbmZ1bmN0aW9uIG5vb3AoKSB7fVxuXG5wcm9jZXNzLm9uID0gbm9vcDtcbnByb2Nlc3MuYWRkTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5vbmNlID0gbm9vcDtcbnByb2Nlc3Mub2ZmID0gbm9vcDtcbnByb2Nlc3MucmVtb3ZlTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5yZW1vdmVBbGxMaXN0ZW5lcnMgPSBub29wO1xucHJvY2Vzcy5lbWl0ID0gbm9vcDtcbnByb2Nlc3MucHJlcGVuZExpc3RlbmVyID0gbm9vcDtcbnByb2Nlc3MucHJlcGVuZE9uY2VMaXN0ZW5lciA9IG5vb3A7XG5cbnByb2Nlc3MubGlzdGVuZXJzID0gZnVuY3Rpb24gKG5hbWUpIHsgcmV0dXJuIFtdIH1cblxucHJvY2Vzcy5iaW5kaW5nID0gZnVuY3Rpb24gKG5hbWUpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3Byb2Nlc3MuYmluZGluZyBpcyBub3Qgc3VwcG9ydGVkJyk7XG59O1xuXG5wcm9jZXNzLmN3ZCA9IGZ1bmN0aW9uICgpIHsgcmV0dXJuICcvJyB9O1xucHJvY2Vzcy5jaGRpciA9IGZ1bmN0aW9uIChkaXIpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3Byb2Nlc3MuY2hkaXIgaXMgbm90IHN1cHBvcnRlZCcpO1xufTtcbnByb2Nlc3MudW1hc2sgPSBmdW5jdGlvbigpIHsgcmV0dXJuIDA7IH07XG4iLCIndXNlIHN0cmljdCc7XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKCkge1xuICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgJ3dzIGRvZXMgbm90IHdvcmsgaW4gdGhlIGJyb3dzZXIuIEJyb3dzZXIgY2xpZW50cyBtdXN0IHVzZSB0aGUgbmF0aXZlICcgK1xuICAgICAgJ1dlYlNvY2tldCBvYmplY3QnXG4gICk7XG59O1xuIl19
