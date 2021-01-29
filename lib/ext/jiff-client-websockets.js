/**
 * This defines a library extension for for bignumbers in JIFF.
 * This wraps and exposes the jiff-client-bignumber API. Exposed members can be accessed with jiff_bignumber.&lt;member-name&gt;
 * in browser JS, or by using require('<path>/lib/ext/jiff-client-bignumber').&lt;member-name&gt; as usual in nodejs.
 * @namespace jiff_bignumber
 * @version 1.0
 *
 * FEATURES: supports all of the regular JIFF API.
 *
 * EXTENSION DESIGN INSTRUCTIONS AND EXPLANATION:
 *     1) write a top-level function like the one here: [i.e. (function(exports, node) { .... })(typeof(exports) ....)]
 *        this function acts as the scope for the extension, which forbids name conflicts as well as forbid others from
 *        modifying or messing around with the functions and constants inside. Additionally, it makes the code useable
 *        from the browsers and nodejs.
 *
 *     2) In the very last line replace this.jiff_bignumber = {} with this.jiff_<extension_name> = {}. This is the defacto
 *        name space for this extension. Calling code on the user-side will use that name (jiff_<extension_name>) to access the
 *        functions you choose to expose. For nodejs the name space will be ignored and calling code can use the object
 *        returned by the require() call corresponding to this extension.
 *
 *     3) Inside the top-level function, create a function called make_jiff. The function should take two parameters:
 *            (a) base_instance, (b) options.
 *        base_instance: the base instance to wrap the extension around, it can be a basic jiff-client.js instance or
 *            an instance of another extension, you can use this instance to perform the basic operation that build
 *            your extensions (sharing of integers, simple operations on ints, etc)
 *        options: should be an object that provides your extension with whatever options it requires. The options for
 *            the base_instance will be passed to it prior to calling your extensions and may not be inside the options
 *            object, but you can access them using base_instance.
 *
 *     4) If your extension requires other extensions be applied to the base instance, you can force this by performing a
 *        a check, by calling <base_instance>.has_extension(<extension_name>).
 *
 *     5) Adding functionality: You have two options:
 *            (A) use hooks to modify the functionality of the base instance "in place"
 *                and then return the base instance.
 *            (B) Create a new object that contains the base_instance (perhaps as an attribute named "base"), you will
 *                need to recreate the JIFF API at the new object level. The implementation of this API can use functionality
 *                from base_instance. Return the new object.
 *
 *     6) If you need to override any feature in jiff (change how share work, or how open work, or how some primitive
 *        work etc), look at the hooks documentation to see if it is available as a hook. If it is, your best bet would
 *        be to use hooks on top of the base_instance. Another approach could be to override functions inside the base_instance
 *        or to create a new object with brand new functions (that may or may not refer to base_instance). These approaches
 *        can be mixed.
 *
 *     7) If you want to add additional feature that does not override any other feature in jiff, implement that in a
 *        function under a new appropriate name, make sure to document the function properly.
 *
 *     8) at the end of the top-level function and after make_jiff is done, make sure to have an
 *        if(node) { ... } else { ... } block, in which you expose the make_jiff function.
 *
 *     9) do not forget to export the name of the extension.
 *
 * Keep in mind that others may base extensions on your extension, or that clients may want to combine functionality from two extensions
 * together. If you have specific dependencies or if you know that the extension will be incompatible with other extensions, make sure
 * to enforce it by performing checks and throwing errors, as well as potentially overriding the can_apply_extension function
 * which will be called when future extensions are applied after your extension.
 */
(function (exports, node) {
  /**
   * The name of this extension: 'websocket'
   * @type {string}
   * @memberOf jiff_websocket
   */
  exports.name = 'websocket';

  var BigNumber_;
  if (node) {
    // TODO: add node/browser dependency switching for ws and  ws-isomorphic
    // has to be global to make sure BigNumber library sees it.
    global.crypto = require('crypto');
    BigNumber_ = require('bignumber.js');
  } else {
    window.crypto = window.crypto || window.msCrypto;
    BigNumber_ = window.BigNumber;
  }

  // dependencies = { 'BigNumber': <BigNumber.js> }
  exports.dependencies = function (dependencies) {
    BigNumber_ = dependencies['BigNumber'] != null ? dependencies['BigNumber'] : BigNumber_;
  };

  var guardedSocket = require('../client/socket/mailbox.js');
  /**
   * Check that an integer is prime. Used to safely set the modulus Zp.
   * @memberof jiff_bignumber.utils
   * @param {number} p - the prime number candidate.
   * @returns {boolean} true if p is prime, false otherwise.
   */
  function is_prime(p) {
    // AKS Primality Test
    p = new BigNumber_(p);

    if (p.eq(2)) {
      return true;
    } else if (p.eq(3)) {
      return true;
    } else if (p.mod(2).eq(0)) {
      return false;
    } else if (p.mod(3).eq(0)) {
      return false;
    }

    var i = new BigNumber_(5);
    var n = new BigNumber_(2);
    var six6 = new BigNumber_(6);
    while (i.times(i).lte(p)) {
      if (p.mod(i).eq(0)) {
        return false;
      }
      i = i.plus(n);
      n = six6.minus(n);
    }

    return true;
  }



  // Take the jiff-client base instance and options for this extension, and use them
  // to construct an instance for this extension.
  function make_jiff(base_instance, options) {
    var jiff = base_instance;

    // Parse options
    if (options == null) {
      options = {};
    }
    if (options.Zp != null) {
      jiff.Zp = options.Zp;
      if (options.safemod !== false && !is_prime(options.Zp)) {
        throw new Error('Zp = ' + options.Zp.toString() + ' is not prime.  Please use a prime number for the modulus or set safemod to false.');
      }
    }

    if (jiff.has_extension('negativenumber')) {
      throw new Error('Please apply bignumber before negative number extensions');
    }
    if (jiff.has_extension('fixedpoint')) {
      throw new Error('Please apply bignumber before negative number extensions');
    }

    // Turn things into their Websocket equivalent

    /* Functions that overwrite client/socket/events.js functionality */

    /**
     * Initialize socket listeners and events
     * @memberof module:jiff-client.JIFFClient
     * @method
     */
    jiff.initSocket = function () {
      var jiffClient = this;

      // set on('connect') handler once!
      // Change 'connect' to open for ws
      // Therer might be a conflict here because there is another 'open' protocol
      this.socket.on('open', jiffClient.handlers.connected);

      // Store the id when server sends it back
      // this.socket.on('initialization', jiffClient.handlers.initialized);

      // Public keys were updated on the server, and it sent us the updates
      function publicKeysChanged(msg, callback) {
        // callback(true);

        msg = JSON.parse(msg);
        msg = jiffClient.hooks.execute_array_hooks('afterOperation', [jiffClient, 'public_keys', msg], 2);

        jiffClient.handlers.store_public_keys(msg.public_keys);
      }

      // Setup receiving matching shares
      function share(msg, callback) {
        // callback(true); // send ack to server

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
        // callback(true); // send ack to server

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
        // callback(true); // send ack to server

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
        // callback(true); // send ack to server
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
       * We have to restructure these protocols just like on the server side. Messages will
       * be changed to have 2 parts, a socketProtocol and a data part. When a message is received,
       * the socketProtocol will be pulled out to route it to the proper function (previously the
       * "on" functions)
       */
      this.socket.on('message', function (msg, callback) {
        msg = JSON.parse(msg);

        // console.log(msg);

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
            // TODO: Send an error back to the socket that called this
        }
      });

    };

    /**
     * Executes all callbacks for which the wait condition has been satisfied.
     * Remove all executed callbacks so that they would not be executed in the future.
     * @memberof module:jiff-client.JIFFClient
     * @method
     */
    jiff.execute_wait_callbacks = function () {
      var copy_callbacks = this.wait_callbacks;
      this.wait_callbacks = [];
      for (var i = 0; i < copy_callbacks.length; i++) {
        var wait = copy_callbacks[i];
        var parties = wait.parties;
        var callback = wait.callback;
        var initialization = wait.initialization;

        // Check if the parties to wait for are now known
        var parties_satisfied = this.__initialized || !initialization;
        for (var j = 0; j < parties.length; j++) {
          var party_id = parties[j];
          if (this.keymap == null || this.keymap[party_id] == null) {
            parties_satisfied = false;
            break;
          }
        }

        if (parties_satisfied) {
          callback(this);
        } else {
          this.wait_callbacks.push(wait);
        }
      }
    };

    /**
     * Resolves all messages that were pending because their senders primary key was previously unknown.
     * These messages are decrypted and verified and handled appropriatly before being removed from the wait queue.
     * @memberof module:jiff-client.JIFFClient
     * @method
     */
    jiff.resolve_messages_waiting_for_keys = function () {
      for (var party_id in this.keymap) {
        if (!this.keymap.hasOwnProperty(party_id)) {
          continue;
        }

        var messageQueue = this.messagesWaitingKeys[party_id];
        if (messageQueue == null) {
          continue;
        }
        for (var i = 0; i < messageQueue.length; i++) {
          var msg = messageQueue[i];
          if (msg.label === 'share') {
            this.handlers.receive_share(msg.msg);
          } else if (msg.label === 'open') {
            this.handlers.receive_open(msg.msg);
          } else if (msg.label === 'custom') {
            this.handlers.receive_custom(msg.msg);
          } else {
            throw new Error('Error resolving pending message: unknown label ' + msg.label);
          }
        }

        this.messagesWaitingKeys[party_id] = null;
      }
    };
    /* Functions that overwrite client/socket/internal.js functionality */
    console.log(jiff);
    console.log(jiff.options);



    if (options.__internal_socket == null) {
      /**
       * Socket wrapper between this instance and the server, based on sockets.io
       * @type {!GuardedSocket}
       */
      jiff.socket = guardedSocket(jiff);
    } else {
      /* Functions that overwrite jiff-client.js connection logic */
      jiff.options.__internal_socket.safe_emit = function (label, msg) {
        if (label === 'free') {
          jiff.hooks.execute_array_hooks('afterOperation', [this.jiffClient, 'free', msg], 2);
          return;
        }

        jiff.options.__internal_socket.send(JSON.stringify( { socketProtocol: label, data: msg } ));
      };
    }

    return jiff;
  }

  // Expose the API for this extension.
  exports.make_jiff = make_jiff;
  /*
   *exports.sharing_schemes = {shamir_share: jiff_compute_shares, shamir_reconstruct: jiff_lagrange};
   */
  exports.utils = {is_prime: is_prime};
}((typeof exports === 'undefined' ? this.jiff_websockets = {} : exports), typeof exports !== 'undefined'));

