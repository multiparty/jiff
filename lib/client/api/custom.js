module.exports = function (jiffClient) {
  /**
   * Sends a custom message to a subset of parties
   * @memberof module:jiff-client~JIFFClient
   * @method emit
   * @instance
   * @param {string} tag - the tag to attach to the message
   * @param {Array} [receivers=all_parties] - contains the party ids to receive the message, defaults to all parties
   * @param {string} message - the message to send
   * @param {boolean} [encrypt=true] - if true, messages will be encrypted
   */
  jiffClient.emit = function (tag, receivers, message, encrypt) {
    if (typeof(message) !== 'string') {
      throw new Error('Emit: message must be a string');
    }

    if (receivers == null) {
      receivers = [];
      for (var i = 1; i <= jiffClient.party_count; i++) {
        receivers.push(i);
      }
    }

    // send to all other parties
    for (var p = 0; p < receivers.length; p++) {
      if (receivers[p] === jiffClient.id) {
        continue;
      }

      var message_to_send = {tag: tag, party_id: receivers[p], message: message, encrypted: encrypt};
      message_to_send = jiffClient.hooks.execute_array_hooks('beforeOperation', [jiffClient, 'custom', message_to_send], 2);

      if (message_to_send['encrypted'] !== false) {
        message_to_send['message'] = jiffClient.hooks.encryptSign(jiffClient, message_to_send['message'], jiffClient.keymap[message_to_send['party_id']], jiffClient.secret_key);
        message_to_send['encrypted'] = true;
      }

      jiffClient.socket.safe_emit('custom', JSON.stringify(message_to_send));
    }

    // receive our own message if specified
    if (receivers.indexOf(jiffClient.id) > -1) {
      jiffClient.handlers.receive_custom({tag: tag, party_id: jiffClient.id, message: message, encrypted: false});
    }
  };

  /**
   * Registers the given function as a listener for messages with the given tag.
   * Removes any previously set listener for this tag.
   * @memberof module:jiff-client~JIFFClient
   * @method listen
   * @instance
   * @param {string} tag - the tag to listen for.
   * @param {function(party_id, string)} handler - the function that handles the received message: takes the sender id and the message as parameters.
   */
  jiffClient.listen = function (tag, handler) {
    jiffClient.listeners[tag] = handler;

    var stored_messages = jiffClient.custom_messages_mailbox[tag];
    if (stored_messages == null) {
      return;
    }

    for (var i = 0; i < stored_messages.length; i++) {
      var sender_id = stored_messages[i].sender_id;
      var message = stored_messages[i].message;
      handler(sender_id, message);
    }

    delete jiffClient.custom_messages_mailbox[tag];
  };

  /**
   * Removes the custom message listener attached to the given tag
   * @memberof module:jiff-client~JIFFClient
   * @method remove_listener
   * @instance
   * @param {string} tag - the tag of the listener to remove
   */
  jiffClient.remove_listener = function (tag) {
    delete jiffClient.listeners[tag];
  };
};