// adds sharing related handlers
module.exports = function (jiffClient) {
  /**
   * Store the received share and resolves the corresponding
   * deferred if needed.
   * @method
   * @memberof handlers
   * @param {object} json_msg - the parsed json message as received.
   */
  jiffClient.handlers.receive_share = function (json_msg) {
    // Decrypt share
    let decrypted = jiffClient.hooks.decryptSign(jiffClient, json_msg['share'], jiffClient.secret_key, jiffClient.keymap[json_msg['party_id']]);
    
    var ready = function (decrypted) {
      json_msg['share'] = decrypted;
      json_msg = jiffClient.hooks.execute_array_hooks('afterOperation', [jiffClient, 'share', json_msg], 2);

      var sender_id = json_msg['party_id'];
      var op_id = json_msg['op_id'];
      var share = json_msg['share'];

      // Call hook
      share = jiffClient.hooks.execute_array_hooks('receiveShare', [jiffClient, sender_id, share], 2);

      // check if a deferred is set up (maybe the share was received early)
      if (jiffClient.deferreds[op_id] == null) {
        jiffClient.deferreds[op_id] = {};
      }
      if (jiffClient.deferreds[op_id][sender_id] == null) {
        // Share is received before deferred was setup, store it.
        jiffClient.deferreds[op_id][sender_id] = new jiffClient.helpers.Deferred();
      }

      // Deferred is already setup, resolve it.
      jiffClient.deferreds[op_id][sender_id].resolve(share);
    }

    if (decrypted.then) {
      return decrypted.then(ready);
    } else {
      ready(decrypted);
      return true;
    }
  };

  /**
   * Resolves the deferred corresponding to operation_id and sender_id.
   * @method
   * @memberof handlers
   * @param {object} json_msg - the json message as received with the open event.
   */
  jiffClient.handlers.receive_open = function (json_msg) {
    // Decrypt share
    if (json_msg['party_id'] !== jiffClient.id) {
      var decrypted = jiffClient.hooks.decryptSign(jiffClient, json_msg['share'], jiffClient.secret_key, jiffClient.keymap[json_msg['party_id']]);
    }

    var ready = function (decrypted) {
      if (json_msg['party_id'] !== jiffClient.id) {
        json_msg['share'] = decrypted;
        json_msg = jiffClient.hooks.execute_array_hooks('afterOperation', [jiffClient, 'open', json_msg], 2);
      }

      var sender_id = json_msg['party_id'];
      var op_id = json_msg['op_id'];
      var share = json_msg['share'];
      var Zp = json_msg['Zp'];

      // call hook
      share = jiffClient.hooks.execute_array_hooks('receiveOpen', [jiffClient, sender_id, share, Zp], 2);

      // Ensure deferred is setup
      if (jiffClient.deferreds[op_id] == null) {
        jiffClient.deferreds[op_id] = {};
      }
      if (jiffClient.deferreds[op_id].shares == null) {
        jiffClient.deferreds[op_id].shares = [];
      }

      // Accumulate received shares
      jiffClient.deferreds[op_id].shares.push({value: share, sender_id: sender_id, Zp: Zp});

      // Resolve when ready
      if (jiffClient.deferreds[op_id].shares.length === jiffClient.deferreds[op_id].threshold) {
        jiffClient.deferreds[op_id].deferred.resolve();
      }

      // Clean up if done
      if (jiffClient.deferreds[op_id] != null && jiffClient.deferreds[op_id].deferred === 'CLEAN' && jiffClient.deferreds[op_id].shares.length === jiffClient.deferreds[op_id].total) {
        delete jiffClient.deferreds[op_id];
      }
    }

    if (decrypted != null && decrypted.then) {
      decrypted.then(ready);
    } else if (decrypted != null) {
      ready(decrypted);
    } else {
      ready(json_msg['share']);
    }
  }
};
