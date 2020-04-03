// add handlers for initialization
module.exports = function (jiffClient) {
  jiffClient.options.initialization = Object.assign({}, jiffClient.options.initialization);

  /**
   * Called when an error occurs
   * @method
   * @memberof handlers
   * @param {string} label - the name of message or operation causing the error
   * @param {error|string} error - the error
   */
  jiffClient.handlers.error = function (label, error) {
    if (jiffClient.options.onError) {
      jiffClient.options.onError(label, error);
    }

    console.log(jiffClient.id, ':', 'Error from server:', label, '---', error); // TODO: remove debugging
    if (label === 'initialization') {
      jiffClient.socket.disconnect();

      if (jiffClient.initialization_counter < jiffClient.options.maxInitializationRetries) {
        console.log(jiffClient.id, ':', 'reconnecting..'); // TODO: remove debugging
        setTimeout(jiffClient.connect, jiffClient.options.socketOptions.reconnectionDelay);
      }
    }
  };

  /**
   * Builds the initialization message for this instance
   * @method
   * @memberof handlers
   * @return {Object}
   */
  jiffClient.handlers.build_initialization_message = function () {
    var msg = {
      computation_id: jiffClient.computation_id,
      party_id: jiffClient.id,
      party_count: jiffClient.party_count,
      public_key: jiffClient.public_key != null ? jiffClient.hooks.dumpKey(jiffClient, jiffClient.public_key) : undefined
    };
    msg = Object.assign(msg, jiffClient.options.initialization);

    // Initialization Hook
    return jiffClient.hooks.execute_array_hooks('beforeOperation', [jiffClient, 'initialization', msg], 2);
  };

  /**
   * Begins initialization of this instance by sending the initialization message to the server.
   * Should only be called after connection is established.
   * Do not call this manually unless you know what you are doing, use <jiff_instance>.connect() instead!
   * @method
   * @memberof handlers
   */
  jiffClient.handlers.connected = function () {
    console.log('Connected!', jiffClient.id); // TODO: remove debugging
    jiffClient.initialization_counter++;

    if (jiffClient.secret_key == null && jiffClient.public_key == null) {
      var key = jiffClient.hooks.generateKeyPair(jiffClient);
      jiffClient.secret_key = key.secret_key;
      jiffClient.public_key = key.public_key;
    }

    // Initialization message
    var msg = jiffClient.handlers.build_initialization_message();

    // Emit initialization message to server
    jiffClient.socket.emit('initialization', JSON.stringify(msg));
  };

  /**
   * Called after the server approves initialization of this instance.
   * Sets the instance id, the count of parties in the computation, and the public keys
   * of initialized parties.
   * @method
   * @memberof handlers
   */
  jiffClient.handlers.initialized = function (msg) {
    jiffClient.__initialized = true;
    jiffClient.initialization_counter = 0;

    msg = JSON.parse(msg);
    msg = jiffClient.hooks.execute_array_hooks('afterOperation', [jiffClient, 'initialization', msg], 2);

    jiffClient.id = msg.party_id;
    jiffClient.party_count = msg.party_count;

    // Now: (1) this party is connect (2) server (and other parties) know this public key
    // Resend all pending messages
    jiffClient.socket.resend_mailbox();

    // store the received public keys and resolve wait callbacks
    jiffClient.handlers.store_public_keys(msg.public_keys);
  };

  /**
   * Parse and store the given public keys
   * @method
   * @memberof handlers
   * @param {object} keymap - maps party id to serialized public key.
   */
  jiffClient.handlers.store_public_keys = function (keymap) {
    var i;
    for (i in keymap) {
      if (keymap.hasOwnProperty(i) && jiffClient.keymap[i] == null) {
        jiffClient.keymap[i] = jiffClient.hooks.parseKey(jiffClient, keymap[i]);
      }
    }

    // Resolve any pending messages that were received before the sender's public key was known
    jiffClient.resolve_messages_waiting_for_keys();

    // Resolve any pending waits that have satisfied conditions
    jiffClient.execute_wait_callbacks();

    // Check if all keys have been received
    if (jiffClient.keymap['s1'] == null) {
      return;
    }
    for (i = 1; i <= jiffClient.party_count; i++) {
      if (jiffClient.keymap[i] == null) {
        return;
      }
    }

    // all parties are connected; execute callback
    if (jiffClient.__ready !== true && jiffClient.__initialized) {
      jiffClient.__ready = true;
      if (jiffClient.options.onConnect != null) {
        jiffClient.options.onConnect(jiffClient);
      }
    }
  };
};