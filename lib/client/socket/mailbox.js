var io = require('socket.io-client');

var linked_list = require('../../common/linkedlist.js');
var constants = require('../util/constants.js');

var defaultSocketOptions = {
  reconnectionDelay: constants.reconnectionDelay,
  reconnectionDelayMax: constants.reconnectionDelayMax,
  randomizationFactor: constants.randomizationFactor,
  autoConnect: false
};

function guardedSocket(jiffClient) {
  jiffClient.options.socketOptions = Object.assign({}, defaultSocketOptions, jiffClient.options.socketOptions);

  // Create plain socket io object which we will wrap in this
  var socket = io(jiffClient.hostname, jiffClient.options.socketOptions);
  socket.mailbox = linked_list(); // for outgoing messages
  socket.empty_deferred = null; // gets resolved whenever the mailbox is empty
  socket.jiffClient = jiffClient;

  // add functionality to socket
  socket.safe_emit = safe_emit.bind(socket);
  socket.resend_mailbox = resend_mailbox.bind(socket);
  socket.disconnect = disconnect.bind(socket);
  socket.safe_disconnect = safe_disconnect.bind(socket);

  return socket;
}

// Store message in the mailbox until acknowledgment is received
var safe_emit = function (label, msg) {
  // add message to mailbox
  var mailbox_pointer = this.mailbox.add({ label: label, msg: msg });
  if (this.socket.connected) {
    var self = this;
    // emit the message, if an acknowledgment is received, remove it from mailbox
    this.socket.emit(label, msg, function (status) {
      if (status) {
        self.mailbox.remove(mailbox_pointer);
        if (self.mailbox.head == null && self.empty_deferred != null) {
          self.empty_deferred.resolve();
        }

        if (label === 'free') {
          this.jiffClient.execute_array_hooks('afterOperation', [this.jiffClient, 'free', msg], 2);
        }
      }
    });
  }
};

// Resend all pending messages
var resend_mailbox = function () {
  // Create a new mailbox, since the current mailbox will be resent and
  // will contain new backups.
  var old_mailbox = this.mailbox;
  this.mailbox = linked_list();

  // loop over all stored messages and emit them
  var current_node = old_mailbox.head;
  while (current_node != null) {
    var label = current_node.object.label;
    var msg = current_node.object.msg;
    this.safe_emit(label, msg);
    current_node = current_node.next;
  }
};

// regular disconnect wraps a hook before it disconnects
var disconnect = function () {
  this.jiffClient.execute_array_hooks('beforeOperation', [this.jiffClient, 'disconnect', {}], -1);
  this.socket.disconnect.apply(this.socket, arguments);
};

// Safe disconnect: only after all messages were acknowledged
var safe_disconnect = function (free, callback) {
  if (this.mailbox.head == null && this.jiffClient.counters.pending_opens === 0) {
    if (free) {
      this.jiffClient.free();
      free = false;
    } else {
      this.disconnect();
      if (callback != null) {
        callback();
      }
      return;
    }
  }

  this.empty_deferred = new this.jiffClient.helpers.Deferred();
  this.empty_deferred.promise.then(this.safe_disconnect.bind(this, free, callback));
};

module.exports = guardedSocket;