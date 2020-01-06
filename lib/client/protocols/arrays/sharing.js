/**
 * Share an array of values. Each sender may have an array of different length. This is handled by the lengths parameter.
 * This function will reveal the lengths of the shared array.
 * If parties would like to keep the lengths of their arrays secret, they should agree on some "max" length apriori (either under MPC
 * or as part of the logistics of the computation), all their arrays should be padded to that length by using appropriate default/identity
 * values.
 * @param {jiff-instance} jiff - the jiff instance.
 * @param {Array} array - the array to be shared.
 * @param {null|number|object} lengths - the lengths of the arrays to be shared, has the following options:
 *                                       1. null: lengths are unknown, each sender will publicly reveal the lengths of its own array.
 *                                       2. number: all arrays are of this length
 *                                       3. object: { <sender_party_id>: length }: must specify the length of the array for each sender.
 * @param {number} [threshold=receivers_list.length] - the min number of parties needed to reconstruct the secret, defaults to all the receivers.
 * @param {Array} [receivers_list=all_parties] - array of party ids to share with, by default, this includes all parties.
 * @param {Array} [senders_list=all_parties] - array of party ids to receive from, by default, this includes all parties.
 * @param {number} [Zp=jiff.Zp] - the mod.
 * @param {string|number} [share_id=auto_gen()] - the base tag used to tag the messages sent by this share operation, every element of the array
 *                                   will get a unique id based on the concatenation of base_share_id and the index of the element.
 *                                   This tag is used so that parties distinguish messages belonging to this share operation from
 *                                   other share operations between the same parties (when the order of execution is not
 *                                   deterministic). An automatic id is generated by increasing a local counter, default
 *                                   ids suffice when all parties execute all sharing operations with the same senders
 *                                   and receivers in the same order.
 * @return {promise} if the calling party is a receiver then a promise to the shared arrays is returned, the promise will provide an object
 *                    formatted as follows: { <party_id>: [ <1st_share>, <2nd_share>, ..., <(lengths[party_id])th_share> ] }
 *                    where the party_ids are those of the senders.
 *                    if the calling party is not a receiver, then null is returned.
 */
function jiff_share_array(jiff, array, lengths, threshold, receivers_list, senders_list, Zp, share_id) {
  var i;

  // Check format of lengths
  if (lengths != null && typeof(lengths) !== 'number' && typeof(lengths) !== 'object') {
    throw new Error('share_array: unrecognized lengths');
  }

  // Default values
  if (receivers_list == null) {
    receivers_list = [];
    for (i = 1; i <= jiff.party_count; i++) {
      receivers_list.push(i);
    }
  }
  if (senders_list == null) {
    senders_list = [];
    for (i = 1; i <= jiff.party_count; i++) {
      senders_list.push(i);
    }
  }

  var isReceiving = receivers_list.indexOf(jiff.id) > -1;
  if (senders_list.indexOf(jiff.id) === -1 && !isReceiving) {
    return null;
  } // This party is neither a sender nor a receiver, do nothing!

  // compute operation id
  if (share_id == null) {
    share_id = jiff.counters.gen_op_id2('share_array', receivers_list, senders_list);
  }

  // wrap around result of share_array
  var share_array_deferred = new jiff.helpers.Deferred;
  var share_array_promise = share_array_deferred.promise;

  // figure out lengths by having each party emit their length publicly
  if (lengths == null) {
    lengths = {};
    var total = 0;
    if (senders_list.indexOf(jiff.id) > -1) {
      lengths[jiff.id] = array.length;

      // send the length of this party's array to all receivers
      jiff.emit(share_id + 'length', receivers_list, array.length.toString(10));
    }

    jiff.listen(share_id + 'length', function (sender, message) {
      lengths[sender] = parseInt(message, 10);
      total++;
      if (total === senders_list.length) {
        jiff.remove_listener(share_id + 'length');
        share_array_deferred.resolve(lengths);
      }
    });
  } else if (typeof(lengths) === 'number') {
    // All arrays are of the same length
    var l = lengths;
    lengths = {};
    for (i = 0; i < senders_list.length; i++) {
      lengths[senders_list[i]] = l;
    }

    share_array_deferred.resolve(lengths);
  } else {
    // Lengths of the different arrays are all provided
    for (i = 0; i < senders_list.length; i++) {
      if (lengths[senders_list[i]] == null) {
        throw new Error('share_array: missing length');
      }
    }

    share_array_deferred.resolve(lengths);
  }

  // lengths are now set, start sharing
  share_array_promise = share_array_promise.then(function (lengths) {
    // compute the number of sharing rounds
    var max = 0;
    for (i = 0; i < senders_list.length; i++) {
      var l = lengths[senders_list[i]];
      max = l > max ? l : max;
    }

    // Store results here
    var results = {};
    if (isReceiving) {
      for (i = 0; i < senders_list.length; i++) {
        results[senders_list[i]] = [];
      }
    }

    // share every round
    for (var r = 0; r < max; r++) {
      var round_senders = [];
      for (i = 0; i < senders_list.length; i++) {
        if (lengths[senders_list[i]] > r) {
          round_senders.push(senders_list[i]);
        }
      }

      var value = (senders_list.indexOf(jiff.id) > -1) && (r < array.length) ? array[r] : null;
      var round_results = jiff.share(value, threshold, receivers_list, round_senders, Zp, share_id + 'round:' + r);

      for (var sender_id in round_results) {
        if (round_results.hasOwnProperty(sender_id)) {
          results[sender_id].push(round_results[sender_id]);
        }
      }
    }

    return results;
  });

  return isReceiving ? share_array_promise : null;
}

/**
 * Opens a bunch of secret shares.
 * @param {jiff-instance} jiff - the jiff instance.
 * @param {SecretShare[]} shares - an array containing this party's shares of the secrets to reconstruct.
 * @param {Array} [parties=all_parties] - an array with party ids (1 to n) of receiving parties.
 * @param {string|number} [op_id=auto_gen()] - same as jiff_instance.open
 * @returns {promise} a (JQuery) promise to ALL the open values of the secret, the promise will yield
 *                    an array of values matching the corresponding given secret share by index.
 * @throws error if some shares does not belong to the passed jiff instance.
 */
function jiff_open_array(jiff, shares, parties, op_id) {
  // Default values
  if (parties == null || parties === []) {
    parties = [];
    for (i = 1; i <= jiff.party_count; i++) {
      parties.push(i);
    }
  }

  // Compute operation ids (one for each party that will receive a result
  if (op_id == null) {
    op_id = jiff.counters.gen_op_id2('open_array', parties, shares[0].holders);
  }

  var promises = [];
  for (var i = 0; i < shares.length; i++) {
    var promise = jiff.open(shares[i], parties, op_id + ':' + i);
    if (promise != null) {
      promises.push(promise);
    }
  }

  if (promises.length === 0) {
    return null;
  }

  return Promise.all(promises);
}