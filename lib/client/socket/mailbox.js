var io = require('socket.io-client');

var linked_list = require('../../common/linkedlist.js');
var constants = require('../util/constants.js');

var defaultSocketOptions = {
  reconnectionDelay: constants.reconnectionDelay,
  reconnectionDelayMax: constants.reconnectionDelayMax,
  randomizationFactor: constants.randomizationFactor,
  autoConnect: false
};

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

function guardedSocket(jiffClient) {
  jiffClient.options.socketOptions = Object.assign({}, defaultSocketOptions, jiffClient.options.socketOptions);

  // Create plain socket io object which we will wrap in this
  var socket = io(jiffClient.hostname, jiffClient.options.socketOptions);
  socket.old_disconnect = socket.disconnect;
  socket.mailbox = linked_list(); // for outgoing messages
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
var safe_emit = function (label, msg) {
  // add message to mailbox
  var mailbox_pointer = this.mailbox.add({ label: label, msg: msg });
  if (this.connected) {
    var self = this;
    // emit the message, if an acknowledgment is received, remove it from mailbox
    this.emit(label, msg, function (status) {
      if (status) {
        self.mailbox.remove(mailbox_pointer);
        if (this.is_empty() && self.empty_deferred != null) {
          self.empty_deferred.resolve();
        }

        if (label === 'free') {
          this.jiffClient.hooks.execute_array_hooks('afterOperation', [this.jiffClient, 'free', msg], 2);
        }
      }
    });
  }
};

/**
 * Re-sends all pending messages
 * @method resend_mailbox
 * @memberof GuardedSocket
 * @instance
 */
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

/**
 * Wraps socket.io regular disconnect with a call to a hook before disconnection
 * @method disconnect
 * @memberof GuardedSocket
 * @instance
 */
var disconnect = function () {
  this.jiffClient.hooks.execute_array_hooks('beforeOperation', [this.jiffClient, 'disconnect', {}], -1);
  this.old_disconnect.apply(this, arguments);
};

/**
 * Safe disconnect: disconnect only after all messages (including free) were acknowledged and
 * all pending opens were resolved
 * @method safe_disconnect
 * @memberof GuardedSocket
 * @instance
 * @param {boolean} [free=false] - if true, a free message will be issued prior to disconnecting
 * @param {function()} [callback] - given callback will be executed after safe disconnection is complete
  */
var safe_disconnect = function (free, callback) {
  if (this.is_empty()) {
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

/**
 * Checks if the socket mailbox is empty (all communication was done and acknowledged),
 * used in safe_disconnect
 * @method is_empty
 * @memberof GuardedSocket
 * @instance
 */
var is_empty = function () {
  return this.mailbox.head == null && this.jiffClient.counters.pending_opens === 0;
};

module.exports = guardedSocket;