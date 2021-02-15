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
var WebSocket = require('ws');
var linked_list = require('../common/linkedlist.js');
var $ = require('jquery-deferred');

(function (exports, node) {
  /**
   * The name of this extension: 'websocket'
   * @type {string}
   * @memberOf jiffclient_websocket
   */
  exports.name = 'websocket';

  if (node) {
    // TODO: add node/browser dependency switching for ws and  ws-isomorphic
    // has to be global to make sure BigNumber library sees it.
    // global.crypto = require('crypto');
  } else {
    // window.crypto = window.crypto || window.msCrypto;
  }


  var linked_list = require('../common/linkedlist.js');
  var WebSocket = require('ws');


  // Take the jiff-client base instance and options for this extension, and use them
  // to construct an instance for this extension.
  function make_jiff(base_instance, options) {
    var jiff = base_instance;

    jiff.socketMaps = {
      socket: {},
      computationId: {},
      partyId: {}
    }

    jiff.initComputation = function (computation_id, party_id, party_count) {
      if (this.computationMaps.clientIds[computation_id] == null) {
        this.computationMaps.clientIds[computation_id] = [];
        this.computationMaps.maxCount[computation_id] = party_count;
        this.computationMaps.freeParties[computation_id] = {};
        this.computationMaps.keys[computation_id] = {};
        this.socketMaps.socket[computation_id] = {};
        this.mailbox[computation_id] = {};
        this.cryptoMap[computation_id] = {};

        if (this.computation_instances_deferred[computation_id] == null) {
          this.computation_instances_deferred[computation_id] = $.Deferred();
        }
      }

      if (this.computationMaps.clientIds[computation_id].indexOf(party_id) === -1) {
        this.computationMaps.clientIds[computation_id].push(party_id);
      }
    };

    jiff.freeComputation = function (computation_id) {
      this.hooks.log(this, 'free computation', computation_id);

      delete this.socketMaps.socket[computation_id];
      delete this.computationMaps.clientIds[computation_id];
      delete this.computationMaps.spareIds[computation_id];
      delete this.computationMaps.maxCount[computation_id];
      delete this.computationMaps.freeParties[computation_id];
      delete this.computationMaps.keys[computation_id];
      delete this.computationMaps.secretKeys[computation_id];
      delete this.mailbox[computation_id];
      delete this.computation_instances_deferred[computation_id];
      delete this.computation_instances_map[computation_id];
      delete this.cryptoMap[computation_id];
    };

    // Parse options
    if (options == null) {
      options = {};
    }

    // Turn things into their Websocket equivalent

    /* Functions that overwrite server/socket.js functionality */
    jiff.initSocket = function () {
      var jiff = this;

      // create socket server and listen to connection
      let wss = new WebSocket.Server({ server: this.http, clientTracking: true });
      // cannot just use this.io because scope of this changes inside of connections
      this.io = wss;

      this.io.on('connection', function (socket, req) {

        // TODO: replace socket.id with a direct map to the socket object instead
        // console.log("Connected To");
        // TODO: If you reconnect and disconnect, want socket to be considered the same
        // Can check if it is in the server.clients list


        jiff.hooks.log(jiff, 'user connected');

        socket.id = req.headers['sec-websocket-key'];

        function initialization(msg) {
          // START OF SOCKET SPECIFIC SETUP

          // read message
          var computation_id = msg['computation_id'];
          var party_id = msg['party_id'];
          var party_count = msg['party_count'];
          // END OF SOCKET SPECIFIC SETUP

          msg.clients = wss.clients;

          // COMPUTATION: independent from socket
          // msg.socket_id = socket.id; // Hack-ish trick to pass this as a parameter to the default hook.
          msg.socket = socket;

          var output = jiff.handlers.initializeParty(computation_id, party_id, party_count, msg, false);
          // END OF COMPUTATION

          // START OF SOCKET SPECIFIC OUTPUT/CLEANUP
          if (output.success) {
            jiff.socketMaps.socket[computation_id][output.message.party_id] = socket;
            jiff.socketMaps.computationId[socket.id] = computation_id;
            jiff.socketMaps.partyId[socket.id] = output.message.party_id;

            party_id = output.message.party_id;
            output.message = JSON.stringify(output.message);
            socket.send(JSON.stringify({ socketProtocol: 'initialization', data: output.message }));
            //jiff.io.to(socket.id).emit('initialization', output.message);

            // Now that party is connected and has the needed public keys,
            // send the mailbox with pending messages to the party.
            jiff.resend_mailbox(computation_id, party_id);
          } else {
            // Change error to its own protocol type since ws does not support error messages natively

            socket.send(JSON.stringify({ socketProtocol: 'error', data: JSON.stringify({ errorProtocol: 'initialization', error: output.error }) }));
            // jiff.io.to(socket.id).emit('error', JSON.stringify({label: 'initialization', error: output.error}));
          }
          // END OF SOCKET SPECIFIC OUTPUT/CLEANUP
        }

        function share(msg, callback) {
          var computation_id = jiff.socketMaps.computationId[socket.id];
          var from_id = jiff.socketMaps.partyId[socket.id];


          var output = jiff.handlers.share(computation_id, from_id, msg);
          if (!output.success) {
            var errorMsg = JSON.stringify({ label: 'share', error: output.error });
            jiff.emit('error', errorMsg, computation_id, from_id);
          }
        }

        function socketOpen(msg, callback) {
          var computation_id = jiff.socketMaps.computationId[socket.id];
          var from_id = jiff.socketMaps.partyId[socket.id];

          var output = jiff.handlers.open(computation_id, from_id, msg);
          if (!output.success) {
            var errorMsg = JSON.stringify({ label: 'open', error: output.error });
            jiff.emit('error', errorMsg, computation_id, from_id);
          }
        }

        function socketCustom(msg, callback) {
          var computation_id = jiff.socketMaps.computationId[socket.id];
          var from_id = jiff.socketMaps.partyId[socket.id];

          var output = jiff.handlers.custom(computation_id, from_id, msg);
          if (!output.success) {
            var errorMsg = JSON.stringify({ label: 'custom', error: output.error });
            jiff.emit('error', errorMsg, computation_id, from_id);
          }
        }

        function crypto_provider(msg, callback) {
          var computation_id = jiff.socketMaps.computationId[socket.id];
          var from_id = jiff.socketMaps.partyId[socket.id];

          // msg = JSON.parse(msg);

          var res = jiff.handlers.crypto_provider(computation_id, from_id, msg);
          if (!res.success) {
            var errorMsg = JSON.stringify({ label: 'crypto_provider', error: res.error });
            jiff.emit('error', errorMsg, computation_id, from_id);
          }
        }

        function disconnect(reason) {
          var computation_id = jiff.socketMaps.computationId[socket.id];
          var from_id = jiff.socketMaps.partyId[socket.id];

          jiff.hooks.log(jiff, 'user disconnected', computation_id, from_id, 'Reason:', reason);
          jiff.hooks.execute_array_hooks('onDisconnect', [jiff, computation_id, from_id], -1);

          if (jiff.computationMaps.freeParties[computation_id] == null || jiff.computationMaps.freeParties[computation_id][from_id]) {
            delete jiff.socketMaps.computationId[socket];
            delete jiff.socketMaps.partyId[socket];
          } else {
            socket.__jiff_cleaned = true;
          }
        }

        function free(msg, callback) {
          var computation_id = jiff.socketMaps.computationId[socket.id];
          var from_id = jiff.socketMaps.partyId[socket.id];

          var output = jiff.handlers.free(computation_id, from_id, msg);
          if (!output.success) {
            var errorMsg = JSON.stringify({ label: 'free', error: output.error });
            jiff.emit('error', errorMsg, computation_id, from_id);
          }

          if (socket.__jiff_cleaned) {
            delete jiff.socketMaps.computationId[socket];
            delete jiff.socketMaps.partyId[socket];
            delete socket.__jiff_cleaned;
          }
        }

        /**
         * Transition from socket.io:
         * socket.io allows you to easily define your own protocols but the ws library does not.
         * Instead, we will include a socketProtocol string in every incoming/outgoing message
         * that will be parsed by the receiver to route the request to the correct function. The
         * previous information sent by socket.io will be untouched, but now sent inside of msg.data.
         * TODO: Include this socketProtocol in every message sent with sockets through jiff
         * */

        // msg is sent as a string that needs to be parsed into a json object
        socket.on('message', function (msg, callback) {
          msg = JSON.parse(msg);

          // console.log(msg);

          msg.data = JSON.parse(msg.data);

          switch (msg.socketProtocol) {
            case 'initialization':
              initialization(msg.data);
              break;
            case 'share':
              share(msg.data, callback);
              break;
            case 'open':
              socketOpen(msg.data, callback);
              break;
            case 'custom':
              socketCustom(msg.data, callback);
              break;
            case 'crypto_provider':
              crypto_provider(msg.data, callback);
              break;
            case 'disconnect':
              disconnect(msg.data);
              break;
            case 'close':
              disconnect(msg.data);
              break;
            case 'free':
              free(msg.data, callback);
              break;
            default:
              console.log("Uknown protocol received");
            // TODO: Send an error back to the socket that called this
          }
        });

        /**
         * Pretty sure disconnect and open protocol won't be called above, but
         * just keeping them both for now just in case
         */
        socket.on('close', function (reason, callback) {
          disconnect(reason);
        });

      });
    };

    /* Changes made to the hooks functionality */
    jiff.hooks.onInitializeUsedId = function (jiff, computation_id, party_id, party_count, msg) {
      // Replace the id structure with just putting in the socket object instead
      var previous_socket = jiff.socketMaps.socket[computation_id][party_id];

      if (previous_socket !== msg.socket && msg.clients.has(previous_socket)) { // && previous_socket.connected) {
        throw new Error(party_id + ' is already taken');
      }

      return party_id;
    };

    /* Replace changes made to mailbox.js */
    jiff.emit = function (label, msg, computation_id, to_id, callback) {
      if (this.socketMaps.socket[computation_id] == null) {
        return;
      }

      // get the appropriate socket for the receiving party
      var socket_to_use = this.socketMaps.socket[computation_id][to_id]; // socket to use
      if (socket_to_use == null) {
        return;
      }

      // send message if the socket still *appears* to be connected
      // TODO: Check if it is in the server.clients list
      // var socket = this.io.sockets.connected[socket_to_use];
      var socket = socket_to_use;
      var message = { socketProtocol: label, data: msg };
      if (socket != null) {
        if (callback == null) {
          socket.send(JSON.stringify(message));
        } else {
          // emit the message, if an acknowledgment is received, remove it from mailbox
          socket.send(JSON.stringify(message), null, function () {
            callback();
          });
        }
      }
    };




    /** Make sure that our socket is closed in case one was created 
     * before the exension was able to execute. Then, open the server
     * for connections to clients.
     */

    jiff.io.close();

    jiff.initSocket();

    return jiff;
  }
  // Expose the API for this extension.
  exports.make_jiff = make_jiff;

}((typeof exports === 'undefined' ? this.jiffclient_websockets = {} : exports), typeof exports !== 'undefined'));