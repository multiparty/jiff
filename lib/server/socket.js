var io = require('socket.io');

var constants = require('./constants.js');

module.exports = function (JIFFServer) {
  // initializes the socket
  JIFFServer.prototype.initSocket = function () {
    var jiff = this;

    // socket io options
    var socketOptions = Object.assign({
      pingTimeout: constants.PING_TIMEOUT,
      pingInterval: constants.PING_INTERVAL
    }, this.options.socketOptions);

    // create socket io server and listen to connection
    this.io = io(this.http, socketOptions);
    this.io.on('connection', function (socket) {
      jiff.hooks.log(jiff, 'user connected');

      socket.on('initialization', function (msg) {
        // START OF SOCKET SPECIFIC SETUP
        msg = JSON.parse(msg);

        // read message
        var computation_id = msg['computation_id'];
        var party_id = msg['party_id'];
        var party_count = msg['party_count'];
        // END OF SOCKET SPECIFIC SETUP

        // COMPUTATION: independent from socket
        msg.socket_id = socket.id; // Hack-ish trick to pass this as a parameter to the default hook.
        var output = jiff.handlers.initializeParty(computation_id, party_id, party_count, msg, false);
        // END OF COMPUTATION

        // START OF SOCKET SPECIFIC OUTPUT/CLEANUP
        if (output.success) {
          jiff.socketMaps.socketId[computation_id][output.message.party_id] = socket.id;
          jiff.socketMaps.computationId[socket.id] = computation_id;
          jiff.socketMaps.partyId[socket.id] = output.message.party_id;

          party_id = output.message.party_id;
          output.message = JSON.stringify(output.message);
          jiff.io.to(socket.id).emit('initialization', output.message);

          // Now that party is connected and has the needed public keys,
          // send the mailbox with pending messages to the party.
          jiff.resend_mailbox(computation_id, party_id);
        } else {
          jiff.io.to(socket.id).emit('error', JSON.stringify({label: 'initialization', error: output.error}));
        }
        // END OF SOCKET SPECIFIC OUTPUT/CLEANUP
      });

      socket.on('share', function (msg, callback) {
        callback(true); // send ack to client

        var json_msg = JSON.parse(msg);
        var computation_id = jiff.socketMaps.computationId[socket.id];
        var from_id = jiff.socketMaps.partyId[socket.id];

        var output = jiff.handlers.share(computation_id, from_id, json_msg);
        if (!output.success) {
          var errorMsg = JSON.stringify({label: 'share', error: output.error});
          jiff.emit('error', errorMsg, computation_id, from_id);
        }
      });

      socket.on('open', function (msg, callback) {
        callback(true); // send ack to client

        var computation_id = jiff.socketMaps.computationId[socket.id];
        var from_id = jiff.socketMaps.partyId[socket.id];
        var json_msg = JSON.parse(msg);

        var output = jiff.handlers.open(computation_id, from_id, json_msg);
        if (!output.success) {
          var errorMsg = JSON.stringify({label: 'open', error: output.error});
          jiff.emit('error', errorMsg, computation_id, from_id);
        }
      });

      socket.on('custom', function (msg, callback) {
        callback(true); // send ack to client

        var computation_id = jiff.socketMaps.computationId[socket.id];
        var from_id = jiff.socketMaps.partyId[socket.id];
        var json_msg = JSON.parse(msg);

        var output = jiff.handlers.custom(computation_id, from_id, json_msg);
        if (!output.success) {
          var errorMsg = JSON.stringify({label: 'custom', error: output.error});
          jiff.emit('error', errorMsg, computation_id, from_id);
        }
      });

      socket.on('crypto_provider', function (msg, callback) {
        callback(true); // send ack to client

        msg = JSON.parse(msg);
        var computation_id = jiff.socketMaps.computationId[socket.id];
        var from_id = jiff.socketMaps.partyId[socket.id];

        var res = jiff.handlers.crypto_provider(computation_id, from_id, msg);
        if (!res.success) {
          var errorMsg = JSON.stringify({label: 'crypto_provider', error: res.error});
          jiff.emit('error', errorMsg, computation_id, from_id);
        }
      });

      socket.on('disconnect', function (reason) {
        var computation_id = jiff.socketMaps.computationId[socket.id];
        var from_id = jiff.socketMaps.partyId[socket.id];

        jiff.hooks.log(jiff, 'user disconnected', computation_id, from_id, 'Reason:', reason);
        jiff.hooks.execute_array_hooks('onDisconnect', [jiff, computation_id, from_id], -1);

        if (jiff.computationMaps.freeParties[computation_id] == null || jiff.computationMaps.freeParties[computation_id][from_id]) {
          delete jiff.socketMaps.computationId[socket.id];
          delete jiff.socketMaps.partyId[socket.id];
        } else {
          socket.__jiff_cleaned = true;
        }
      });

      socket.on('free', function (msg, callback) {
        callback(true);

        msg = JSON.parse(msg);
        var computation_id = jiff.socketMaps.computationId[socket.id];
        var from_id = jiff.socketMaps.partyId[socket.id];

        var output = jiff.handlers.free(computation_id, from_id, msg);
        if (!output.success) {
          var errorMsg = JSON.stringify({label: 'free', error: output.error});
          jiff.emit('error', errorMsg, computation_id, from_id);
        }

        if (socket.__jiff_cleaned) {
          delete jiff.socketMaps.computationId[socket.id];
          delete jiff.socketMaps.partyId[socket.id];
          delete socket.__jiff_cleaned;
        }
      });
    });
  };
};