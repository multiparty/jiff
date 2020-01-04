// Main functionality

module.exports = function (jiffServer) {
  // do not use prototype: jiffServer is rarely defined but its functions are frequently used!
  jiffServer.handlers = {};

  // initialize a party: either return an initialization message with the party id or an error message (e.g. if computation is full or requested id is taken)
  jiffServer.handlers.initializeParty = function (computation_id, party_id, party_count, msg, _s1) {
    jiffServer.hooks.log(jiffServer, 'initialize with ', computation_id, '-', party_id, ' #', party_count, ' : ', msg, '::', _s1);

    // s1 is reserved for server use only!
    if (_s1 !== true && party_id === 's1') {
      return {
        success: false,
        error: 'Party id s1 is reserved for server computation instances. This incident will be reported!'
      };
    }

    // First: check that a valid party_count is defined internally or provided in the message for this computation
    if (party_count == null) {
      party_count = jiffServer.computationMaps.maxCount[computation_id];
    }

    // Second: initialize intervals structure to keep track of spare/free party ids if uninitialized
    if (jiffServer.computationMaps.spareIds[computation_id] == null) {
      jiffServer.computationMaps.spareIds[computation_id] = jiffServer.hooks.trackFreeIds(jiffServer, party_count);
    }

    // Third: Valid parameters via hook
    try {
      var params = { party_id: party_id, party_count: party_count };
      var hook_result = jiffServer.hooks.execute_array_hooks('beforeInitialization', [jiffServer, computation_id, msg, params], 3);
      party_count = hook_result.party_count;
      party_id = hook_result.party_id;
    } catch (err) {
      return { success: false, error: typeof(err) === 'string' ? err : err.message };
    }

    // Fourth: Make sure party id is fine.
    // if party_id is given, try to reserve it if free.
    // if no party_id is given, generate a new free one.
    if (party_id != null) { // party_id is given, check validity
      if (party_id !== 's1' && !jiffServer.computationMaps.spareIds[computation_id].is_free(party_id)) {
        // ID is not spare, but maybe it has disconnected and trying to reconnect? maybe a mistaken client? maybe malicious?
        // Cannot handle all possible applications logic, rely on hooks to allow developers to inject case-specific logic.
        try {
          party_id = jiffServer.hooks.onInitializeUsedId(jiffServer, computation_id, party_id, party_count, msg);
        } catch (err) {
          return { success: false, error: typeof(err) === 'string' ? err : err.message };
        }
      }
    } else { // generate spare party_id
      party_id = jiffServer.computationMaps.spareIds[computation_id].create_free(computation_id, msg);
    }

    // All is good: begin initialization
    // reserve id
    if (party_id !== 's1') {
      jiffServer.computationMaps.spareIds[computation_id].reserve(party_id);
    }

    // make sure the computation meta-info objects are defined for this computation id
    jiffServer.initComputation(computation_id, party_id, party_count);

    // Finally: create return initialization message to the client
    var keymap_to_send = jiffServer.handlers.storeAndSendPublicKey(computation_id, party_id, msg);
    var message = { party_id: party_id, party_count: party_count, public_keys: keymap_to_send };
    message = jiffServer.hooks.execute_array_hooks('afterInitialization', [jiffServer, computation_id, message], 2);

    return { success: true, message: message };
  };

  // store public key in given msg and return serialized public keys
  jiffServer.handlers.storeAndSendPublicKey = function (computation_id, party_id, msg) {
    // store public key in key map
    var tmp = jiffServer.computationMaps.keys[computation_id];
    if (tmp['s1'] == null) { // generate public and secret key for server if they don't exist
      var genkey = jiffServer.hooks.generateKeyPair(jiffServer);
      jiffServer.computationMaps.secretKeys[computation_id] = genkey.secret_key;
      tmp['s1'] = genkey.public_key;
    }

    if (party_id !== 's1') {
      tmp[party_id] = jiffServer.hooks.parseKey(jiffServer, msg.public_key);
    }

    // Gather and format keys
    var keymap_to_send = {};
    for (var key in tmp) {
      if (jiffServer.computationMaps.keys[computation_id].hasOwnProperty(key)) {
        keymap_to_send[key] = jiffServer.hooks.dumpKey(jiffServer, jiffServer.computationMaps.keys[computation_id][key]);
      }
    }
    var broadcast_message = JSON.stringify({public_keys: keymap_to_send});

    // Send the public keys to all previously connected parties, except the party that caused this update
    var send_to_parties = jiffServer.computationMaps.clientIds[computation_id];
    for (var i = 0; i < send_to_parties.length; i++) {
      if (send_to_parties[i] !== party_id) {
        jiffServer.safe_emit('public_keys', broadcast_message, computation_id, send_to_parties[i]);
      }
    }

    return keymap_to_send;
  };

  jiffServer.handlers.share = function (computation_id, from_id, msg) {
    jiffServer.hooks.log(jiffServer, 'share from', computation_id, '-', from_id, ' : ', msg);

    try {
      msg = jiffServer.hooks.execute_array_hooks('beforeOperation', [jiffServer, 'share', computation_id, from_id, msg], 4);
    } catch (err) {
      return { success: false, error: typeof(err) === 'string' ? err : err.message };
    }

    var to_id = msg['party_id'];
    msg['party_id'] = from_id;

    msg = jiffServer.hooks.execute_array_hooks('afterOperation', [jiffServer, 'share', computation_id, from_id, msg], 4);
    jiffServer.safe_emit('share', JSON.stringify(msg), computation_id, to_id);

    return { success: true };
  };

  jiffServer.handlers.open = function (computation_id, from_id, msg) {
    jiffServer.hooks.log(jiffServer, 'open from', computation_id, '-', from_id, ' : ', msg);

    try {
      msg = jiffServer.hooks.execute_array_hooks('beforeOperation', [jiffServer, 'open', computation_id, from_id, msg], 4);
    } catch (err) {
      return { success: false, error: typeof(err) === 'string' ? err : err.message };
    }

    var to_id = msg['party_id'];
    msg['party_id'] = from_id;

    msg = jiffServer.hooks.execute_array_hooks('afterOperation', [jiffServer, 'open', computation_id, from_id, msg], 4);
    jiffServer.safe_emit('open', JSON.stringify(msg), computation_id, to_id);

    return { success: true };
  };

  jiffServer.handlers.crypto_provider = function (computation_id, from_id, msg) {
    jiffServer.hooks.log(jiffServer, 'crypto_provider from', computation_id, '-', from_id, ':', msg);

    try {
      msg = jiffServer.hooks.execute_array_hooks('beforeOperation', [jiffServer, 'crypto_provider', computation_id, from_id, msg], 4);
    } catch (err) {
      return {success: false, error: typeof(err) === 'string' ? err : err.message};
    }

    // request/generate triplet share
    var label = msg['label'];
    var params = msg['params'];
    var op_id = msg['op_id'];
    var receivers_list = msg['receivers'];
    var threshold = msg['threshold'];
    var Zp = msg['Zp'];

    // Try to find stored result in map, or compute it if it does not exist!
    var result = jiffServer.cryptoMap[computation_id][op_id];
    if (result == null) {
      var output = jiffServer.cryptoProviderHandlers[label](jiffServer, computation_id, receivers_list, threshold, Zp, params);

      // Share secrets into plain shares (not secret share objects) and copy values
      var shares = {};
      if (output['secrets'] != null) {
        for (var j = 0; j < receivers_list.length; j++) {
          shares[receivers_list[j]] = [];
        }

        for (var i = 0; i < output['secrets'].length; i++) {
          var oneShare = jiffServer.hooks.computeShares(jiffServer, output['secrets'][i], receivers_list, threshold, Zp);
          for (j = 0; j < receivers_list.length; j++) {
            shares[receivers_list[j]].push(oneShare[receivers_list[j]]);
          }
        }
      }

      // Store result in map
      result = { values: output['values'], shares: shares, markers: {} };
      jiffServer.cryptoMap[computation_id][op_id] = result;
    }

    // construct response
    var response = {
      op_id: op_id,
      receivers: receivers_list,
      threshold: threshold,
      Zp: Zp,
      values: result.values,
      shares: result.shares[from_id]  // send only shares allocated to requesting party
    };

    // clean up memory
    result.markers[from_id] = true;
    delete result.shares[from_id];
    if (Object.keys(result.markers).length === receivers_list.length) {
      delete jiffServer.cryptoMap[computation_id][op_id];
    }

    // hook and serialize
    response = jiffServer.hooks.execute_array_hooks('afterOperation', [jiffServer, 'crypto_provider', computation_id, from_id, response], 4);
    response = JSON.stringify(response);

    // send
    jiffServer.safe_emit('crypto_provider', response, computation_id, from_id);

    return { success: true };
  };

  jiffServer.handlers.custom = function (computation_id, from_id, msg) {
    jiffServer.hooks.log(jiffServer, 'custom from', computation_id, '-', from_id, ':', msg);

    try {
      msg = jiffServer.hooks.execute_array_hooks('beforeOperation', [jiffServer, 'custom', computation_id, from_id, msg], 4);
    } catch (err) {
      return { success: false, error: typeof(err) === 'string' ? err : err.message };
    }

    //message already parsed
    var receiver = msg['party_id'];
    msg['party_id'] = from_id;

    msg = jiffServer.hooks.execute_array_hooks('afterOperation', [jiffServer, 'custom', computation_id, from_id, msg], 4);
    jiffServer.safe_emit('custom', JSON.stringify(msg), computation_id, receiver);

    return { success: true };
  };

  jiffServer.handlers.free = function (computation_id, party_id, msg) {
    jiffServer.hooks.log(jiffServer, 'free', computation_id, '-', party_id);

    try {
      jiffServer.hooks.execute_array_hooks('beforeFree', [jiffServer, computation_id, party_id, msg], -1);
    } catch (err) {
      return { success: false, error: typeof(err) === 'string' ? err : err.message };
    }

    jiffServer.computationMaps.freeParties[computation_id][party_id] = true;

    // free up all resources related to the computation
    if (Object.keys(jiffServer.computationMaps.freeParties[computation_id]).length === jiffServer.computationMaps.maxCount[computation_id]) {
      jiffServer.freeComputation(computation_id);
      jiffServer.hooks.execute_array_hooks('afterFree', [jiffServer, computation_id, party_id, msg], -1);
    }

    return { success: true };
  };
};