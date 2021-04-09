/**
 * This defines a library extension for using websockets rather than socket.io for communication. This
 * extension primarily edits/overwrites existing socket functions to use and be compatible with the 
 * ws library.
 * @namespace jiffserver_websockets
 * @version 1.0
 *
 * REQUIREMENTS:
 * You must apply this extension to your server and every client must apply jiffclient_websockets as well.
 */

var WebSocket = require('ws');
var $ = require('jquery-deferred');

(function (exports, node) {
  /**
   * The name of this extension: 'websocket'
   * @type {string}
   * @memberOf jiffserver_websockets
   */
  exports.name = 'websocket';


  // Take the jiff-server base instance and options for this extension, and use them
  // to construct an instance for this extension.
  function make_jiff(base_instance, options) {
    var jiff = base_instance;

    // Parse options
    if (options == null) {
      options = {};
    }

    /* socketMaps now stores a reference directly to a socket rather than a socketId 
       To avoid naming confusion, this is still referred to as socketId
      */
    jiff.socketMaps = {
      socketId: {},
      computationId: {},
      partyId: {},
      clientSocket: {}
    }

    /* Edit initComputation and freeComputation to use the new socketMaps structure */
    jiff.initComputation = function (computation_id, party_id, party_count) {
      if (this.computationMaps.clientIds[computation_id] == null) {
        this.computationMaps.clientIds[computation_id] = [];
        this.computationMaps.maxCount[computation_id] = party_count;
        this.computationMaps.freeParties[computation_id] = {};
        this.computationMaps.keys[computation_id] = {};
        this.socketMaps.socketId[computation_id] = {};
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

      delete this.socketMaps.socketId[computation_id];
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


    /* Functions that overwrite server/socket.js functionality */

    /**
     * initSocket's '.on' functions needed to be replaced since ws does
     * not have as many protocols. Instead these functions are routed to
     * when a message is received and a protocol is manually parsed.
     */

    jiff.initSocket = function () {
      var jiff = this;

      // create socket server and listen to connection
      let wss = new WebSocket.Server({ server: this.http, clientTracking: true });
      // cannot just use this.io because scope of this changes inside of connections
      this.io = wss;

      this.io.on('connection', function (socket, req) {

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
          msg.socket = socket;

          var output = jiff.handlers.initializeParty(computation_id, party_id, party_count, msg, false);
          // END OF COMPUTATION

          // START OF SOCKET SPECIFIC OUTPUT/CLEANUP
          if (output.success) {
            jiff.socketMaps.socketId[computation_id][output.message.party_id] = socket;
            jiff.socketMaps.computationId[socket.id] = computation_id;
            jiff.socketMaps.partyId[socket.id] = output.message.party_id;

            party_id = output.message.party_id;
            output.message = JSON.stringify(output.message);
            socket.send(JSON.stringify({ socketProtocol: 'initialization', data: output.message }));

            // Now that party is connected and has the needed public keys,
            // send the mailbox with pending messages to the party.
            jiff.resend_mailbox(computation_id, party_id);
          } else {
            // Change error to its own protocol type since ws does not support error messages natively

            /* Messages sent over socket.io are now under the label 'data' while previously used protocols are sent under 'socketProtocol' */
            socket.send(JSON.stringify({ socketProtocol: 'error', data: JSON.stringify({ errorProtocol: 'initialization', error: output.error }) }));
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

          var res = jiff.handlers.crypto_provider(computation_id, from_id, msg);
          if (!res.success) {
            var errorMsg = JSON.stringify({ label: 'crypto_provider', error: res.error });
            jiff.emit('error', errorMsg, computation_id, from_id);
          }
        }

        function disconnect(reason) {
          var computation_id = jiff.socketMaps.computationId[socket.id];
          if (computation_id) {
            var from_id = jiff.socketMaps.partyId[socket.id];

            jiff.hooks.log(jiff, 'user disconnected', computation_id, from_id, 'Reason:', reason);
            jiff.hooks.execute_array_hooks('onDisconnect', [jiff, computation_id, from_id], -1);

            if (jiff.computationMaps.freeParties[computation_id] == null || jiff.computationMaps.freeParties[computation_id][from_id]) {
              delete jiff.socketMaps.computationId[socket.id];
              delete jiff.socketMaps.partyId[socket.id];              
            } else {
              socket.__jiff_cleaned = true;
            }
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

        /* close is one protocol that is contained in the ws library for when a socket disconnects */
        socket.on('close', function (reason, callback) {
          disconnect(reason);
        });

        /**
         * In every message sent over ws, we will send along with it a socketProtocol string
         * that will be parsed by the receiver to route the request to the correct function. The
         * previous information sent by socket.io will be untouched, but now sent inside of msg.data.
         */

        socket.on('message', function (msg, callback) {
          msg = JSON.parse(msg);

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
              console.log("Unknown protocol received");
          }
        });

      });
    };

    /* Changes made to the hooks functionality */
    jiff.hooks.onInitializeUsedId = function (jiff, computation_id, party_id, party_count, msg) {
      /* socketID structure is replaced with just a reference to the socket */
      var previous_socket = jiff.socketMaps.socketId[computation_id][party_id];

      if (previous_socket !== msg.socket && msg.clients.has(previous_socket)) {
        throw new Error(party_id + ' is already taken');
      }

      return party_id;
    };

    /* Replace changes made to mailbox.js */
    jiff.emit = function (label, msg, computation_id, to_id, callback) {
      if (this.socketMaps.socketId[computation_id] == null) {
        return;
      }

      // get the appropriate socket for the receiving party
      var socket_to_use = this.socketMaps.socketId[computation_id][to_id]; // socket to use
      if (socket_to_use == null) {
        return;
      }

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

}((typeof exports === 'undefined' ? this.jiffserver_websockets = {} : exports), typeof exports !== 'undefined'));