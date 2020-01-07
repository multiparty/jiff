module.exports = function (jiffClient) {
  /**
   * Called when this party receives a custom tag message from any party (including itself).
   * If a custom listener was setup to listen to the tag, the message is passed to the listener.
   * Otherwise, the message is stored until such a listener is provided.
   * @method
   * @memberof handlers
   * @param {object} json_msg - the parsed json message as received by the custom event.
   */
  jiffClient.handlers.receive_custom = function (json_msg) {
    if (json_msg['party_id'] !== jiffClient.id) {
      if (json_msg['encrypted'] === true) {
        json_msg['message'] = jiffClient.hooks.decryptSign(jiffClient, json_msg['message'], jiffClient.secret_key, jiffClient.keymap[json_msg['party_id']]);
      }

      json_msg = jiffClient.hooks.execute_array_hooks('afterOperation', [jiffClient, 'custom', json_msg], 2);
    }

    var sender_id = json_msg['party_id'];
    var tag = json_msg['tag'];
    var message = json_msg['message'];

    if (jiffClient.listeners[tag] != null) {
      jiffClient.listeners[tag](sender_id, message);
    } else {
      // Store message until listener is provided
      var stored_messages = jiffClient.custom_messages_mailbox[tag];
      if (stored_messages == null) {
        stored_messages = [];
        jiffClient.custom_messages_mailbox[tag] = stored_messages;
      }

      stored_messages.push({sender_id: sender_id, message: message});
    }
  }
};