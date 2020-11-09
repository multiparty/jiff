var WebSocket = require('ws');
const custom = require('../client/handlers/custom.js');
// var io = require('socket.io');


var constants = require('./constants.js');
module.exports = function (JIFFServer) {
  // initializes the socket
  JIFFServer.prototype.initSocket = function () {
    var jiff = this;

    // create socket io server and listen to connection
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
          socket.send(JSON.stringify( { socketProtocol: 'initialization', data: output.message } ));
          //jiff.io.to(socket.id).emit('initialization', output.message);

          // Now that party is connected and has the needed public keys,
          // send the mailbox with pending messages to the party.
          jiff.resend_mailbox(computation_id, party_id);
        } else {
          // Change error to its own protocol type since ws does not support error messages natively
          
          socket.send(JSON.stringify( { socketProtocol: 'error', data: JSON.stringify({ errorProtocol: 'initialization', error: output.error }) }));
          // jiff.io.to(socket.id).emit('error', JSON.stringify({label: 'initialization', error: output.error}));
        }
        // END OF SOCKET SPECIFIC OUTPUT/CLEANUP
      }

      function share(msg, callback) {
        // callback(true); // send ack to client

        var computation_id = jiff.socketMaps.computationId[socket.id];
        var from_id = jiff.socketMaps.partyId[socket.id];


        var output = jiff.handlers.share(computation_id, from_id, msg);
        if (!output.success) {
          var errorMsg = JSON.stringify({label: 'share', error: output.error});
          jiff.emit('error', errorMsg, computation_id, from_id);
        }
      }

      function socketOpen (msg, callback) {
        // callback(true); // send ack to client

        var computation_id = jiff.socketMaps.computationId[socket.id];
        var from_id = jiff.socketMaps.partyId[socket.id];

        var output = jiff.handlers.open(computation_id, from_id, msg);
        if (!output.success) {
          var errorMsg = JSON.stringify({label: 'open', error: output.error});
          jiff.emit('error', errorMsg, computation_id, from_id);
        }
      }

      function socketCustom (msg, callback) {
        // callback(true); // send ack to client

        var computation_id = jiff.socketMaps.computationId[socket.id];
        var from_id = jiff.socketMaps.partyId[socket.id];

        var output = jiff.handlers.custom(computation_id, from_id, msg);
        if (!output.success) {
          var errorMsg = JSON.stringify({label: 'custom', error: output.error});
          jiff.emit('error', errorMsg, computation_id, from_id);
        }
      }

      function crypto_provider(msg, callback) {
        // callback(true); // send ack to client

        var computation_id = jiff.socketMaps.computationId[socket.id];
        var from_id = jiff.socketMaps.partyId[socket.id];

        // msg = JSON.parse(msg);

        var res = jiff.handlers.crypto_provider(computation_id, from_id, msg);
        if (!res.success) {
          var errorMsg = JSON.stringify({label: 'crypto_provider', error: res.error});
          jiff.emit('error', errorMsg, computation_id, from_id);
        }
      }

      function disconnect (reason) {
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

      function free (msg, callback) {
        // callback(true);

        var computation_id = jiff.socketMaps.computationId[socket.id];
        var from_id = jiff.socketMaps.partyId[socket.id];

        var output = jiff.handlers.free(computation_id, from_id, msg);
        if (!output.success) {
          var errorMsg = JSON.stringify({label: 'free', error: output.error});
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

        switch(msg.socketProtocol) {
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
};
