var linked_list = require('../common/linkedlist.js');

// default mailbox hooks used in hooks.js
exports.hooks = {
  putInMailbox: function (jiff, label, msg, computation_id, to_id) {
    var computation_mailbox = jiff.mailbox[computation_id];
    if (computation_mailbox[to_id] == null) {
      computation_mailbox[to_id] = linked_list();
    }

    // add message to mailbox, return pointer
    return computation_mailbox[to_id].add({label: label, msg: msg});
  },
  getFromMailbox: function (jiff, computation_id, party_id) {
    var computation_mailbox = jiff.mailbox[computation_id];
    if (computation_mailbox == null) {
      return [];
    }
    if (computation_mailbox[party_id] == null) {
      computation_mailbox[party_id] = linked_list();
    }

    var result = [];
    var current_node = computation_mailbox[party_id].head;
    while (current_node != null) {
      var ptr = current_node;
      var object = current_node.object;
      result.push({ id: ptr, label: object.label, msg: object.msg });

      current_node = current_node.next;
    }

    return result;
  },
  removeFromMailbox: function (jiff, computation_id, party_id, mailbox_pointer) {
    if (jiff.mailbox[computation_id] != null && jiff.mailbox[computation_id][party_id] != null) {
      jiff.mailbox[computation_id][party_id].remove(mailbox_pointer);
    }
  },
  sliceMailbox: function (jiff, computation_id, party_id, mailbox_pointer) {
    if (jiff.mailbox[computation_id] != null && jiff.mailbox[computation_id][party_id] != null) {
      jiff.mailbox[computation_id][party_id].slice(mailbox_pointer);
    }
  }
};

// Communication Infrastructure - do not modify unless you know what you are doing
exports.initPrototype = function (JIFFServer) {
  JIFFServer.prototype.emit = function (label, msg, computation_id, to_id, callback) {
    if (this.socketMaps.socketId[computation_id] == null) {
      return;
    }

    // get the appropriate socket for the receiving party
    var socket_to_use = this.socketMaps.socketId[computation_id][to_id]; // id of socket to use
    if (socket_to_use == null) {
      return;
    }

    // send message if the socket still *appears* to be connected
    var socket = this.io.sockets.connected[socket_to_use];
    if (socket != null && socket.connected) {
      if (callback == null) {
        socket.emit(label, msg);
      } else {
        // emit the message, if an acknowledgment is received, remove it from mailbox
        socket.emit(label, msg, function (status) {
          if (status) {
            callback();
          }
        });
      }
    }
  };

  JIFFServer.prototype.safe_emit = function (label, msg, computation_id, to_id) {
    var jiff = this;

    if (to_id === 's1' ) {
      this.computation_instances_deferred[computation_id].then(function () {
        jiff.computation_instances_map[computation_id].socket.receive(label, msg);
      });
      return;
    }

    // store message in mailbox so that it can be resent in case of failure.
    var store_id = this.hooks.putInMailbox(this, label, msg, computation_id, to_id);
    this.emit(label, msg, computation_id, to_id, function () {
      jiff.hooks.removeFromMailbox(jiff, computation_id, to_id, store_id);
    });
  };

  // Used to resend saved messages in the mailbox to the party when it reconnects.
  JIFFServer.prototype.resend_mailbox = async function (computation_id, party_id) {
    var callback = function (store_id_scoped) {
      this.hooks.removeFromMailbox(this, computation_id, party_id, store_id_scoped);
    };

    var mailbox = await this.hooks.getFromMailbox(this, computation_id, party_id);
    for (var i = 0; i < mailbox.length; i++) {
      var letter = mailbox[i];
      var store_id = letter.id;
      var label = letter.label;
      var msg = letter.msg;

      this.emit(label, msg, computation_id, party_id, callback.bind(this, store_id));
    }
  };
};