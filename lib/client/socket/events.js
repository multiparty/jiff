class SocketEvent {
  constructor(JIFFClient) {
    this.jiffClient = JIFFClient;
  }
  /**
   * Initialize socket listeners and events
   * @memberof module:jiff-client.JIFFClient
   * @method
   */
  initSocket = function () {
    const jiffClient = this.jiffClient;

    // set on('connect') handler once!
    this.jiffClient.socket.on('connect', jiffClient.handlers.connected);

    // Store the id when server sends it back
    this.jiffClient.socket.on('initialization', jiffClient.handlers.initialized);

    // Public keys were updated on the server, and it sent us the updates
    this.jiffClient.socket.on('public_keys', (msg, callback) => {
      callback(true);

      msg = JSON.parse(msg);
      msg = this.jiffClient.hooks.execute_array_hooks('afterOperation', [jiffClient, 'public_keys', msg], 2);

      this.jiffClient.handlers.store_public_keys(msg.public_keys);
    });

    // Setup receiving matching shares
    this.jiffClient.socket.on('share', (msg, callback) => {
      callback(true); // send ack to server

      // parse message
      const json_msg = JSON.parse(msg);
      const sender_id = json_msg['party_id'];

      if (this.jiffClient.keymap[sender_id] != null) {
        this.jiffClient.handlers.receive_share(json_msg);
      } else {
        if (this.jiffClient.messagesWaitingKeys[sender_id] == null) {
          this.jiffClient.messagesWaitingKeys[String(sender_id)] = [];
        }
        this.jiffClient.messagesWaitingKeys[String(sender_id)].push({ label: 'share', msg: json_msg });
      }
    });

    this.jiffClient.socket.on('open', (msg, callback) => {
      callback(true); // send ack to server

      // parse message
      const json_msg = JSON.parse(msg);
      const sender_id = json_msg['party_id'];

      if (this.jiffClient.keymap[sender_id] != null) {
        this.jiffClient.handlers.receive_open(json_msg);
      } else {
        if (this.jiffClient.messagesWaitingKeys[sender_id] == null) {
          this.jiffClient.messagesWaitingKeys[String(sender_id)] = [];
        }
        this.jiffClient.messagesWaitingKeys[String(sender_id)].push({ label: 'open', msg: json_msg });
      }
    });

    // handle custom messages
    this.jiffClient.socket.on('custom', (msg, callback) => {
      callback(true); // send ack to server

      const json_msg = JSON.parse(msg);
      const sender_id = String(json_msg['party_id']);
      const encrypted = json_msg['encrypted'];

      if (this.jiffClient.keymap[String(sender_id)] != null || encrypted !== true) {
        this.jiffClient.handlers.receive_custom(json_msg);
      } else {
        // key must not exist yet for sender_id, and encrypted must be true
        if (this.jiffClient.messagesWaitingKeys[sender_id] == null) {
          this.jiffClient.messagesWaitingKeys[String(sender_id)] = [];
        }
        this.jiffClient.messagesWaitingKeys[String(sender_id)].push({ label: 'custom', msg: json_msg });
      }
    });

    this.jiffClient.socket.on('crypto_provider', (msg, callback) => {
      callback(true); // send ack to server
      this.jiffClient.handlers.receive_crypto_provider(JSON.parse(msg));
    });

    this.jiffClient.socket.on('error', (msg) => {
      try {
        msg = JSON.parse(msg);
        this.jiffClient.handlers.error(msg['label'], msg['error']);
      } catch (error) {
        this.jiffClient.handlers.error('socket.io', msg);
      }
    });

    this.jiffClient.socket.on('disconnect', (reason) => {
      if (reason !== 'io client disconnect') {
        // check that the reason is an error and not a user initiated disconnect
        console.log('Disconnected!', jiffClient.id, reason);
      }

      this.jiffClient.hooks.execute_array_hooks('afterOperation', [this.jiffClient, 'disconnect', reason], -1);
    });
  };

  /**
   * Executes all callbacks for which the wait condition has been satisfied.
   * Remove all executed callbacks so that they would not be executed in the future.
   * @memberof module:jiff-client.JIFFClient
   * @method
   */
  execute_wait_callbacks() {
    const copy_callbacks = this.jiffClient.wait_callbacks;
    this.jiffClient.wait_callbacks = [];
    for (let i = 0; i < copy_callbacks.length; i++) {
      const wait = copy_callbacks[i];
      const parties = wait.parties;
      const callback = wait.callback;
      const initialization = wait.initialization;

      // Check if the parties to wait for are now known
      let parties_satisfied = this.jiffClient.__initialized || !initialization;
      for (let j = 0; j < parties.length; j++) {
        const party_id = parties[parseInt(j, 10)];
        if (this.jiffClient.keymap == null || this.jiffClient.keymap[String(party_id)] == null) {
          parties_satisfied = false;
          break;
        }
      }

      if (parties_satisfied) {
        callback(this.jiffClient);
      } else {
        this.jiffClient.wait_callbacks.push(wait);
      }
    }
  }

  /**
   * Resolves all messages that were pending because their senders primary key was previously unknown.
   * These messages are decrypted and verified and handled appropriatly before being removed from the wait queue.
   * @memberof module:jiff-client.JIFFClient
   * @method
   */
  resolve_messages_waiting_for_keys() {
    for (let party_id in this.jiffClient.keymap) {
      if (!Object.prototype.hasOwnProperty.call(this.jiffClient.keymap, String(party_id))) {
        continue;
      }

      const messageQueue = this.jiffClient.messagesWaitingKeys[String(party_id)];
      if (messageQueue == null) {
        continue;
      }
      for (let i = 0; i < messageQueue.length; i++) {
        const msg = messageQueue[i];
        if (msg.label === 'share') {
          this.jiffClient.handlers.receive_share(msg.msg);
        } else if (msg.label === 'open') {
          this.jiffClient.handlers.receive_open(msg.msg);
        } else if (msg.label === 'custom') {
          this.jiffClient.handlers.receive_custom(msg.msg);
        } else {
          throw new Error('Error resolving pending message: unknown label ' + msg.label);
        }
      }

      this.jiffClient.messagesWaitingKeys[String(party_id)] = null;
    }
  }
}

module.exports = SocketEvent;
