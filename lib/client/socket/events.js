module.exports = function (JIFFClient) {
  /**
   * Initialize socket listeners and events
   * @memberof module:jiff-client.JIFFClient
   * @method
   */
  JIFFClient.prototype.initSocket = function () {
    var jiffClient = this;

    // set on('connect') handler once!
    this.socket.on('connect', jiffClient.handlers.connected);

    // Store the id when server sends it back
    this.socket.on('initialization', jiffClient.handlers.initialized);

    // Public keys were updated on the server, and it sent us the updates
    jiffClient.socket.on('public_keys', function (msg, callback) {
      callback(true);

      msg = JSON.parse(msg);
      msg = jiffClient.hooks.execute_array_hooks('afterOperation', [jiffClient, 'public_keys', msg], 2);

      jiffClient.handlers.store_public_keys(msg.public_keys);
    });

    // Setup receiving matching shares
    this.socket.on('share', function (msg, callback) {
      callback(true); // send ack to server

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
    });

    this.socket.on('open', function (msg, callback) {
      callback(true); // send ack to server

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
    });

    // handle custom messages
    this.socket.on('custom', function (msg, callback) {
      callback(true); // send ack to server

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
    });

    this.socket.on('crypto_provider', function (msg, callback) {
      callback(true); // send ack to server
      jiffClient.handlers.receive_crypto_provider(JSON.parse(msg));
    });

    this.socket.on('error', function (msg) {
      try {
        msg = JSON.parse(msg);
        jiffClient.handlers.error(msg['label'], msg['error']);
      } catch (error) {
        jiffClient.handlers.error('socket.io', msg);
      }
    });

    this.socket.on('disconnect', function (reason) {
      if (reason !== 'io client disconnect') {
        // check that the reason is an error and not a user initiated disconnect
        console.log('Disconnected!', jiffClient.id, reason);
      }

      jiffClient.hooks.execute_array_hooks('afterOperation', [jiffClient, 'disconnect', reason], -1);
    });
  };

  /**
   * Executes all callbacks for which the wait condition has been satisfied.
   * Remove all executed callbacks so that they would not be executed in the future.
   * @memberof module:jiff-client.JIFFClient
   * @method
   */
  JIFFClient.prototype.execute_wait_callbacks = function () {
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
  JIFFClient.prototype.resolve_messages_waiting_for_keys = function () {
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
};