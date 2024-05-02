const util = require('./util.js');

const share_array = function (jiff, array, lengths, threshold, receivers_list, senders_list, Zp, share_id) {
  let skeletons = null;
  if (lengths != null) {
    // Check format of lengths
    if (lengths != null && typeof lengths !== 'number' && typeof lengths !== 'object') {
      throw new Error('share_array: unrecognized lengths');
    }

    // Get senders list for later checking
    if (senders_list == null) {
      senders_list = [];
      for (let i = 1; i <= jiff.party_count; i++) {
        senders_list.push(i);
      }
    }

    // Generate skeletons from lengths
    skeletons = {};
    if (typeof lengths === 'number') {
      // All arrays are of the same length
      let skeleton = [];
      for (let i = 0; i < lengths; i++) {
        skeleton.push(null);
      }
      for (let i = 0; i < senders_list.length; i++) {
        skeletons[senders_list[i]] = skeleton;
      }
    } else {
      // Lengths of the different arrays are all provided
      for (let i = 0; i < senders_list.length; i++) {
        if (lengths[senders_list[i]] == null) {
          throw new Error('share_array: missing length');
        } else {
          skeletons[senders_list[i]] = [];
          for (let j = 0; j < lengths[senders_list[i]]; j++) {
            skeletons[senders_list[i]].push(null);
          }
        }
      }
    }
  }

  return share_ND_array(jiff, array, skeletons, threshold, receivers_list, senders_list, Zp, share_id);
};

const share_2D_array = function (jiff, array, lengths, threshold, receivers_list, senders_list, Zp, share_id) {
  // Check format of lengths
  if (lengths != null && typeof lengths !== 'object') {
    throw new Error('share_array: unrecognized lengths');
  }

  // Default values
  if (receivers_list == null) {
    receivers_list = [];
    for (let i = 1; i <= jiff.party_count; i++) {
      receivers_list.push(i);
    }
  }
  if (senders_list == null) {
    senders_list = [];
    for (let i = 1; i <= jiff.party_count; i++) {
      senders_list.push(i);
    }
  }

  const isReceiving = receivers_list.indexOf(jiff.id) > -1;
  if (senders_list.indexOf(jiff.id) === -1 && !isReceiving) {
    // This party is neither a sender nor a receiver, do nothing!
    return null;
  }

  // compute operation id
  receivers_list.sort(); // sort to get the same order
  senders_list.sort();
  if (share_id == null) {
    share_id = jiff.counters.gen_share_id(receivers_list, senders_list) + ':array:';
  }

  // wrap around result of share_array
  let lengths_deferred = new jiff.helpers.Deferred();
  let lengths_promise = lengths_deferred.promise;

  // figure out lengths by having each party emit their length publicly
  if (lengths == null) {
    lengths = {};
    let total = 0;
    if (senders_list.indexOf(jiff.id) > -1) {
      lengths[jiff.id] = array.length;

      // send the length of this party's array to all receivers
      jiff.emit(share_id + 'length', receivers_list, array.length.toString(10));
    }

    jiff.listen(share_id + 'length', function (sender, message) {
      lengths[sender] = { rows: parseInt(message, 10) };
      total++;
      if (total === senders_list.length) {
        jiff.remove_listener(share_id + 'length');
        lengths_deferred.resolve(lengths);
      }
    });
  } else if (typeof lengths.rows === 'number') {
    // All arrays are of the same length
    let l = lengths;
    lengths = {};
    for (let i = 0; i < senders_list.length; i++) {
      lengths[senders_list[i]] = l;
    }

    lengths_deferred.resolve(lengths);
  } else {
    // Lengths of the different arrays are all provided
    for (let i = 0; i < senders_list.length; i++) {
      if (lengths[senders_list[i]] == null || lengths[senders_list[i]].rows == null) {
        throw new Error('share_2D_array: missing rows length');
      }
    }

    lengths_deferred.resolve(lengths);
  }

  // Final results
  const share_array_deferred = new jiff.helpers.Deferred();
  const share_array_promise = share_array_deferred.promise;

  // lengths are now set, start sharing
  lengths_promise.then(function (lengths) {
    // compute the number of sharing rounds
    let max = 0;
    for (let i = 0; i < senders_list.length; i++) {
      let l = lengths[senders_list[i]].rows;
      max = l > max ? l : max;
    }

    // share every round
    let promises = [];
    for (let r = 0; r < max; r++) {
      let round_senders = [];
      for (let i = 0; i < senders_list.length; i++) {
        if (lengths[senders_list[i]].rows > r) {
          round_senders.push(senders_list[i]);
        }
      }

      let row_lengths = {};
      let empty = false;
      for (let p = 0; p < round_senders.length; p++) {
        let pid = round_senders[p];
        row_lengths[pid] = lengths[pid].cols;
        if (lengths[pid][r] != null) {
          row_lengths[pid] = lengths[pid][r];
        }
        if (row_lengths[pid] == null) {
          empty = true;
        }
      }

      let row = r < array.length ? array[r] : [];
      row_lengths = empty ? null : row_lengths;
      let round_results = share_array(jiff, row, row_lengths, threshold, receivers_list, round_senders, Zp, share_id + 'row' + r + ':');
      promises.push(round_results);
    }

    // Wait for every promises corresponding to every row
    return Promise.all(promises).then(function (intermediate_results) {
      // Store results here
      let results = {};
      if (isReceiving) {
        for (let i = 0; i < senders_list.length; i++) {
          results[senders_list[i]] = [];
        }
      }

      for (let i = 0; i < intermediate_results.length; i++) {
        const round = intermediate_results[i];
        for (let sender_id in round) {
          if (round.hasOwnProperty(sender_id)) {
            results[sender_id].push(round[sender_id]);
          }
        }
      }

      share_array_deferred.resolve(results);
    });
  });

  return isReceiving ? share_array_promise : null;
};

const share_from_skeleton_unbound = function (jiff, that, sender, skeleton) {
  const shares = typeof skeleton === 'string' ? JSON.parse(skeleton) : skeleton;

  const promise = share_array_single_sender(jiff, shares, that.threshold, that.receivers_list, sender, that.Zp, that.share_id + ':p_id_' + sender);

  promise.then(
    function (sender, array) {
      that.deferreds[sender].resolve(array);
    }.bind(null, sender)
  );
};

const share_array_single_sender = function (jiff, secrets, threshold, receivers_list, sender, Zp, share_id) {
  if (secrets != null && secrets.length === 0) {
    return Promise.resolve([]);
  } else if (secrets != null && Array.isArray(secrets)) {
    let promised_array = [];
    for (let j = 0; j < secrets.length; j++) {
      promised_array.push(share_array_single_sender(jiff, secrets[j], threshold, receivers_list, sender, Zp, share_id + ':' + j));
    }

    const isReceiving = receivers_list.indexOf(jiff.id) > -1;

    if (isReceiving) {
      var deferred_array = new jiff.helpers.Deferred();
      Promise.all(promised_array).then(function (array) {
        deferred_array.resolve(array);
      });
    }

    return isReceiving ? deferred_array.promise : Promise.resolve({});
  } else {
    // Create and distribute the share - Note: Senders are reorganized in the final array.
    // The return value of jiff.share is an array, [sender: share], and we only need to return share by itself.
    return Promise.resolve(jiff.share(secrets, threshold, receivers_list, [sender], Zp, 'share:' + share_id)[sender]);
  }
};

const share_ND_array_deferred = function (jiff, secrets, skeletons, threshold, receivers_list, senders_list, Zp, share_id) {
  const parameters = [receivers_list, senders_list, threshold, Zp, share_id];
  [receivers_list, senders_list, threshold, Zp, share_id] = util.sanitize_array_params.bind(null, jiff).apply(null, parameters);

  let skeleton;
  const isReceiving = receivers_list.indexOf(jiff.id) > -1;
  const isSending = senders_list.indexOf(jiff.id) > -1;
  if (!isSending && !isReceiving) {
    return null; // This party is neither a sender nor a receiver, do nothing!
  }

  // Setup deferreds: required because we don't yet know how many shares to account for
  let final_deferreds = [];
  for (let i = 0; i < senders_list.length; i++) {
    const p_id = senders_list[i];
    final_deferreds[p_id] = new jiff.helpers.Deferred();
  }

  const share_from_skeleton = share_from_skeleton_unbound.bind(null, jiff).bind(null, {
    deferreds: final_deferreds,
    threshold: threshold,
    receivers_list: receivers_list,
    Zp: Zp,
    share_id: share_id
  });

  if (skeletons == null) {
    if (isSending) {
      // Send the shape and lengths of this party's array to all receivers
      skeleton = jiff.skeleton_of(secrets); // All secrets are removed while maintaing the array's orginial structure.
      const skeleton_str = JSON.stringify(skeleton); // serialize for emit
      jiff.emit(share_id + 'skeleton', receivers_list, skeleton_str);
      share_from_skeleton(jiff.id, secrets); // Share the real values matching the emitted skeleton
    }
    if (isReceiving) {
      jiff.listen(share_id + 'skeleton', share_from_skeleton); // Receive shares when dimensions are known
    }
  } else {
    senders_list = Array.from(senders_list); // remove jiff helpers' internal properties
    util.match_skeletons(jiff, skeletons, senders_list); // Saftey check array dimention presets
    for (let i in senders_list) {
      // Share each party's array
      const p_id = senders_list[i];
      const myself = p_id === jiff.id;
      skeleton = skeletons[p_id];
      share_from_skeleton(p_id, myself ? secrets : skeleton);
    }
  }

  // Combine all promises and re-index final array map
  const final_deferred = new jiff.helpers.Deferred();
  const final_promise = isReceiving ? final_deferred.promise : Promise.resolve({});
  Promise.all(
    (function () {
      let all_promises = [];
      for (let i = 0; i < senders_list.length; i++) {
        const p_id = senders_list[i];
        all_promises.push(final_deferreds[p_id].promise);
      }
      return all_promises;
    })()
  ).then(function (array) {
    let shares = {};
    for (let i = 0; i < senders_list.length; i++) {
      const p_id = senders_list[i];
      shares[p_id] = array[i];
    }
    final_deferred.resolve(shares);
    jiff.remove_listener(share_id + 'skeleton');
  });

  return final_promise; // Return promise to map of secret-shared arrays
};

const share_ND_array_static = function (jiff, secrets, skeletons, threshold, receivers_list, senders_list, Zp, share_id) {
  const parameters = [receivers_list, senders_list, threshold, Zp, share_id];
  [receivers_list, senders_list, threshold, Zp, share_id] = util.sanitize_array_params.bind(null, jiff).apply(null, parameters);

  let shares = {};

  const isReceiving = receivers_list.indexOf(jiff.id) > -1;
  const isSending = senders_list.indexOf(jiff.id) > -1;
  if (isSending || isReceiving) {
    // Static version of share_from_skeleton
    const share_from_skeleton = function (sender, skeleton) {
      return (function share_recursive(__secrets, share_id) {
        if (__secrets != null && __secrets.length === 0) {
          return [];
        } else if (__secrets != null && Array.isArray(__secrets)) {
          let array = [];
          for (let j = 0; j < __secrets.length; j++) {
            array.push(share_recursive(__secrets[j], share_id + ':' + j));
          }
          return isReceiving ? array : {};
        } else {
          return jiff.share(__secrets, threshold, receivers_list, [sender], Zp, 'share:' + share_id)[sender];
        }
      })(skeleton, share_id + ':p_id_' + sender);
    };

    senders_list = Array.from(senders_list); // remove jiff helpers' internal properties
    util.match_skeletons(jiff, skeletons, senders_list); // Saftey check array dimention presets
    for (let i in senders_list) {
      // Share each party's array
      const p_id = senders_list[i];
      const skeleton = skeletons[p_id];
      shares[p_id] = share_from_skeleton(p_id, p_id === jiff.id ? secrets : skeleton);
    }
  }

  return isReceiving ? shares : {}; // Return promise to map of secret-shared arrays
};

const share_ND_array = function (jiff, secrets, skeletons, threshold, receivers_list, senders_list, Zp, share_id) {
  const share_ND_array = skeletons != null ? share_ND_array_static : share_ND_array_deferred;
  return share_ND_array(jiff, secrets, skeletons, threshold, receivers_list, senders_list, Zp, share_id);
};

module.exports = {
  share_array: share_array,
  share_2D_array: share_2D_array,
  share_ND_array: share_ND_array
};
