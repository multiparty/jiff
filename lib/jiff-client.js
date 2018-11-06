/**
 * The exposed API from jiff-client.js (The client side library of JIFF).
 * Wraps the jiff API. Internal members can be accessed with jiff.&lt;member-name&gt;.
 * @namespace jiff
 * @version 1.0
 */
(function (exports, node) {
  var crypto;
  var sodium_promise;
  if (node) {
    // eslint-disable-next-line no-undef
    io = require('socket.io-client');
    // eslint-disable-next-line no-undef,no-global-assign
    $ = require('jquery-deferred');
    // eslint-disable-next-line no-undef
    sodium = require('libsodium-wrappers');
    // eslint-disable-next-line no-undef
    sodium_promise = sodium.ready;

    crypto = require('crypto');
    crypto.__randomBytesWrapper = crypto.randomBytes;
  } else { // Browser: sodium (and other dependencies) should be available in global scope from including sodium.js
    // eslint-disable-next-line no-undef
    sodium_promise = sodium.ready;

    crypto = window.crypto || window.msCrypto;
    crypto.__randomBytesWrapper = function (bytesNeeded) {
      var randomBytes = new Uint8Array(bytesNeeded);
      crypto.getRandomValues(randomBytes);
      return randomBytes;
    }
  }

  /*
  // Debugging
  var old_deferred = $.Deferred;
  $.Deferred = function() {
    var d = old_deferred.apply($, arguments);
    var old_promise = d.promise;
    d.promise = function() {
      var p = old_promise.apply(d, arguments);
      var old_then = p.then;
      p.then = function () {
        var callback = arguments[0];
        arguments[0] = function () {
          try {
            return callback.apply(p, arguments);
          } catch (err) {
            console.log(err);
          }
        };
        return old_then.apply(p, arguments);
      };
      return p;
    };
    return d;
  };
  */

  /**
   * The default mod to be used in a jiff instance if a custom mod was not provided.
   */
  var gZp = 15485867;

  /** Return the maximum of two numbers */
  function max(x, y) {
    return x > y ? x : y;
  }

  /** Doubly linked list with add and remove functions and pointers to head and tail **/
  var linked_list = function () {
    // attributes: list.head and list.tail
    // functions: list.add(object) (returns pointer), list.remove(pointer)
    // list.head/list.tail/any element contains:
    //    next: pointer to next,
    //    previous: pointer to previous,
    //    object: stored object.
    var list = {head: null, tail: null};
    list.add = function (obj) {
      var node = {object: obj, next: null};
      if (list.head == null) {
        list.head = node;
        list.tail = node;
      } else {
        list.tail.next = node;
        node.previous = list.tail;
        list.tail = node;
      }
      return node;
    };
    list.remove = function (ptr) {
      var prev = ptr.previous;
      var next = ptr.next;
      if (prev == null) {
        list.head = next;
        if (list.head != null) {
          list.head.previous = null;
        } else {
          list.tail = null;
        }
      } else {
        prev.next = next;
        if (next != null) {
          next.previous = prev;
        }
      }
    };
    return list;
  };

  /**
   * Encrypts and signs the given message.
   * @memberof jiff.utils
   * @param {number/string} message - the message to encrypt.
   * @param {Uint8Array} encryption_public_key - ascii-armored public key to encrypt with.
   * @param {Uint8Array} signing_private_key - the private key of the encrypting party to sign with.
   * @param {string} operation_type - the operation for which this encryption is performed, one of the following: 'share', 'open', 'triplet', 'number'
   * @returns {object} the signed cipher, includes two properties: 'cipher' and 'nonce'.
   */
  function encrypt_and_sign(message, encryption_public_key, signing_private_key, operation_type) {
    if (operation_type === 'share' || operation_type === 'open') {
      message = message.toString(10);
    }

    // eslint-disable-next-line no-undef
    var nonce = sodium.randombytes_buf(sodium.crypto_box_NONCEBYTES);
    // eslint-disable-next-line no-undef
    var cipher = sodium.crypto_box_easy(message, nonce, encryption_public_key, signing_private_key);

    return {nonce: '[' + nonce.toString() + ']', cipher: '[' + cipher.toString() + ']'};
  }

  /**
   * Decrypts and checks the signature of the given ciphertext.
   * @memberof jiff.utils
   * @param {object} cipher_text - the ciphertext to decrypt, includes two properties: 'cipher' and 'nonce'.
   * @param {Uint8Array} decryption_secret_key - the secret key to decrypt with.
   * @param {Uint8Array} signing_public_key - ascii-armored public key to verify against signature.
   * @param {string} operation_type - the operation for which this decryption is performed, one of the following: 'share', 'open', 'triplet', 'number'
   * @returns {number/string} the decrypted message if the signature was correct, the decrypted message type should
   *                          the type of operation, such that the returned value has the appropriate type and does
   *                          not need any type modifications.
   * @throws error if signature or nonce was forged/incorrect.
   */
  function decrypt_and_sign(cipher_text, decryption_secret_key, signing_public_key, operation_type) {
    var nonce = new Uint8Array(JSON.parse(cipher_text.nonce));
    cipher_text = new Uint8Array(JSON.parse(cipher_text.cipher));

    try {
      // eslint-disable-next-line no-undef
      var decryption = sodium.crypto_box_open_easy(cipher_text, nonce, signing_public_key, decryption_secret_key, 'text');
      if (operation_type === 'share' || operation_type === 'open') {
        return parseInt(decryption, 10);
      }
      return decryption;
    } catch (_) {
      throw new Error('Bad signature or Bad nonce: Cipher: ' + cipher_text + '.  DecSKey: ' + decryption_secret_key + '.  SignPKey: ' + signing_public_key);
    }
  }

  /**
   * Share given secret to the participating parties.
   * @param {jiff-instance} jiff - the jiff instance.
   * @param {number} secret - the secret to share.
   * @param {number} [threshold=receivers_list.length] - the min number of parties needed to reconstruct the secret, defaults to all the receivers.
   * @param {Array} [receivers_list=all_parties] - array of party ids to share with, by default, this includes all parties.
   * @param {Array} [senders_list=all_parties] - array of party ids to receive from, by default, this includes all parties.
   * @param {number} [Zp=jiff.Zp] - the mod (if null then the default Zp for the instance is used).
   * @param {string|number} [share_id=auto_gen()] - the tag used to tag the messages sent by this share operation, this tag is used
   *                                   so that parties distinguish messages belonging to this share operation from other
   *                                   share operations between the same parties (when the order of execution is not
   *                                   deterministic). An automatic id is generated by increasing a local counter, default
   *                                   ids suffice when all parties execute all sharing operations with the same senders
   *                                   and receivers in the same order.
   * @returns {object} a map where the key is the sender party id
   *          and the value is the share object that wraps
   *          what was sent from that party (the internal value maybe deferred).
   *          if the party that calls this function is not a receiver then the map
   *          will be empty.
   */
  function jiff_share(jiff, secret, threshold, receivers_list, senders_list, Zp, share_id) {
    var i, p_id;

    // defaults
    if (Zp == null) {
      Zp = jiff.Zp;
    }
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
    if (threshold == null) {
      threshold = receivers_list.length;
    }
    if (threshold < 0) {
      threshold = 2;
    }
    if (threshold > receivers_list.length) {
      threshold = receivers_list.length;
    }

    // if party is uninvolved in the share, do nothing
    if (receivers_list.indexOf(jiff.id) === -1 && senders_list.indexOf(jiff.id) === -1) {
      return {};
    }

    // compute operation id
    receivers_list.sort(); // sort to get the same order
    senders_list.sort();
    if (share_id == null) {
      share_id = jiff.counters.gen_share_id(receivers_list, senders_list);
    }

    // stage sending of shares
    if (senders_list.indexOf(jiff.id) > -1) {
      // Call hook
      secret = jiff.execute_array_hooks('beforeShare', [jiff, secret, threshold, receivers_list, senders_list, Zp], 1);

      // compute shares
      var shares = jiff.hooks.computeShares(jiff, secret, receivers_list, threshold, Zp);

      // Call hook
      shares = jiff.execute_array_hooks('afterComputeShare', [jiff, shares, threshold, receivers_list, senders_list, Zp], 1);

      // send shares
      for (i = 0; i < receivers_list.length; i++) {
        p_id = receivers_list[i];
        if (p_id === jiff.id) {
          continue;
        }

        // send encrypted and signed shares_id[p_id] to party p_id
        var cipher_share = jiff.hooks.encryptSign(shares[p_id], jiff.keymap[p_id], jiff.secret_key, 'share');
        var msg = {party_id: p_id, share: cipher_share, op_id: share_id};
        jiff.socket.safe_emit('share', JSON.stringify(msg));
      }
    }

    // stage receiving of shares
    var result = {};
    if (receivers_list.indexOf(jiff.id) > -1) {
      // setup a map of deferred for every received share
      if (jiff.deferreds[share_id] == null) {
        jiff.deferreds[share_id] = {};
      }

      for (i = 0; i < senders_list.length; i++) {
        p_id = senders_list[i];
        if (p_id === jiff.id) {
          var my_share = jiff.execute_array_hooks('receiveShare', [jiff, p_id, shares[p_id]], 2);
          result[p_id] = jiff.secret_share(jiff, true, null, my_share, receivers_list, threshold, Zp);
          continue; // Keep party's own share
        }

        // check if a deferred is set up (maybe the message was previously received)
        if (jiff.deferreds[share_id][p_id] == null) {
          // not ready, setup a deferred
          jiff.deferreds[share_id][p_id] = $.Deferred();
        }

        var promise = jiff.deferreds[share_id][p_id].promise();

        // destroy deferred when done
        (function (promise, p_id) { // p_id is modified in a for loop, must do this to avoid scoping issues.
          promise.then(function () {
            jiff.deferreds[share_id][p_id] = null;
          });
        })(promise, p_id);

        // receive share_i[id] from party p_id
        result[p_id] = jiff.secret_share(jiff, false, promise, undefined, receivers_list, threshold, Zp, share_id + ':' + p_id);
      }
    }

    return result;
  }

  /**
   * Default way of computing shares (can be overridden using hooks).
   * Compute the shares of the secret (as many shares as parties) using Shamir secret sharing:
   * a polynomial of degree: ceil(parties/2) - 1 (honest majority).
   * @memberof jiff.sharing_schemes
   * @method shamir_share
   * @param {jiff-instance} jiff - the jiff instance
   * @param {number} secret - the secret to share.
   * @param {Array} parties_list - array of party ids to share with.
   * @param {number} threshold - the min number of parties needed to reconstruct the secret, defaults to all the receivers.
   * @param {number} Zp - the mod.
   * @returns {object} a map between party number and its share, this means that (party number, share) is a
   *          point from the polynomial.
   *
   */
  function jiff_compute_shares(jiff, secret, parties_list, threshold, Zp) {
    var shares = {}; // Keeps the shares
    var i;

    // Each player's random polynomial f must have
    // degree threshold - 1, so that threshold many points are needed
    // to interpolate/reconstruct.
    var t = threshold - 1;
    var polynomial = Array(t + 1); // stores the coefficients

    // Each players's random polynomial f must be constructed
    // such that f(0) = secret
    polynomial[0] = secret;

    // Compute the random polynomial f's coefficients
    for (i = 1; i <= t; i++) {
      polynomial[i] = jiff.helpers.random(Zp);
    }

    // Compute each players share such that share[i] = f(i)
    for (i = 0; i < parties_list.length; i++) {
      var p_id = parties_list[i];
      shares[p_id] = polynomial[0];
      var power = jiff.helpers.get_party_number(p_id);

      for (var j = 1; j < polynomial.length; j++) {
        var tmp = jiff.helpers.mod((polynomial[j] * power), Zp);
        shares[p_id] = jiff.helpers.mod((shares[p_id] + tmp), Zp);
        power = jiff.helpers.mod(power * jiff.helpers.get_party_number(p_id), Zp);
      }
    }

    return shares;
  }

  /**
   * Store the received share and resolves the corresponding
   * deferred if needed.
   * @param {jiff-instance} jiff - the jiff instance.
   * @param {number} sender_id - the id of the sender.
   * @param {string} share - the encrypted share, unless sender
   *                         is the same as receiver, then it is
   *                         an unencrypted number.
   * @param {number} op_id - the id of the share operation.
   *
   */
  function receive_share(jiff, sender_id, share, op_id) {
    // Decrypt share
    share = jiff.hooks.decryptSign(share, jiff.secret_key, jiff.keymap[sender_id], 'share');

    // Call hook
    share = jiff.execute_array_hooks('receiveShare', [jiff, sender_id, share], 2);

    // check if a deferred is set up (maybe the share was received early)
    if (jiff.deferreds[op_id] == null) {
      jiff.deferreds[op_id] = {};
    }
    if (jiff.deferreds[op_id][sender_id] == null) {
      // Share is received before deferred was setup, store it.
      jiff.deferreds[op_id][sender_id] = $.Deferred();
    }

    // Deferred is already setup, resolve it.
    jiff.deferreds[op_id][sender_id].resolve(share);
  }

  /**
   * Open up the given share to the participating parties.
   * @param {jiff-instance} jiff - the jiff instance.
   * @param {SecretShare} share - the share of the secret to open that belongs to this party.
   * @param {Array<number|string>} [parties=all_parties] - an array with party ids of receiving parties.
   * @param {string/number/object} [op_ids=auto_gen()] - the operation id (or a map from receiving party to operation id) to be used to tag outgoing messages.
   * @returns {promise} a (JQuery) promise to the open value of the secret, null if the calling party is not a receiving party.
   * @throws error if share does not belong to the passed jiff instance.
   *
   */
  function jiff_open(jiff, share, parties, op_ids) {
    var i;

    if (!(share.jiff === jiff)) {
      throw 'share does not belong to given instance';
    }

    // Default values
    if (parties == null || parties === []) {
      parties = [];
      for (i = 1; i <= jiff.party_count; i++) {
        parties.push(i);
      }
    } else {
      parties.sort();
    }

    // If not a receiver nor holder, do nothing
    if (share.holders.indexOf(jiff.id) === -1 && parties.indexOf(jiff.id) === -1) {
      return null;
    }

    // Compute operation ids (one for each party that will receive a result
    if (op_ids == null) {
      op_ids = {};
    }

    if (typeof(op_ids) === 'string' || typeof(op_ids) === 'number') {
      var tmp = {};
      for (i = 0; i < parties.length; i++) {
        tmp[parties[i]] = op_ids;
      }
      op_ids = tmp;
    } else {
      var holders_label = share.holders.join(',');
      for (i = 0; i < parties.length; i++) {
        if (op_ids[parties[i]] == null) {
          op_ids[parties[i]] = jiff.counters.gen_open_id(parties[i], holders_label);
        }
      }
    }

    // Party is a holder
    if (share.holders.indexOf(jiff.id) > -1) {
      // Call hook
      share = jiff.execute_array_hooks('beforeOpen', [jiff, share, parties], 1);

      // refresh/reshare, so that the original share remains secret, instead
      // a new share is sent/open without changing the actual value.
      share = share.refresh('refresh:' + op_ids[parties[0]]);

      // The given share has been computed, share it to all parties
      if (share.ready) {
        jiff_broadcast(jiff, share, parties, op_ids);
      } else {
        jiff.counters.pending_opens++;
        // Share is not ready, setup sharing as a callback to its promise
        share.promise.then(function () {
          jiff.counters.pending_opens--;
          jiff_broadcast(jiff, share, parties, op_ids);
        }, share.error);
      }
    }

    // Party is a receiver
    if (parties.indexOf(jiff.id) > -1) {
      var shares = []; // this will store received shares
      var final_deferred = $.Deferred(); // will be resolved when the final value is reconstructed
      var final_promise = final_deferred.promise();
      for (i = 0; i < share.holders.length; i++) {
        var p_id = share.holders[i];

        // Setup a deferred for receiving a share from party p_id
        if (jiff.deferreds[op_ids[jiff.id]] == null) {
          jiff.deferreds[op_ids[jiff.id]] = {};
        }
        if (jiff.deferreds[op_ids[jiff.id]][p_id] == null) {
          jiff.deferreds[op_ids[jiff.id]][p_id] = $.Deferred();
        }

        // Clean up deferred when fulfilled
        var promise = jiff.deferreds[op_ids[jiff.id]][p_id].promise();

        // destroy deferred when done
        (function (promise, p_id) { // p_id is modified in a for loop, must do this to avoid scoping issues.
          promise.then(function (received_share) {
            jiff.deferreds[op_ids[jiff.id]][p_id] = null;
            shares.push(received_share);

            // Too few shares, nothing to do.
            if (shares.length < share.threshold) {
              return;
            }

            // Enough shares to reconstruct.
            // If did not already reconstruct, do it.
            if (final_deferred != null) {
              var recons_secret = jiff.hooks.reconstructShare(jiff, shares);
              recons_secret = jiff.execute_array_hooks('afterReconstructShare', [jiff, recons_secret], 1);

              final_deferred.resolve(recons_secret);
              final_deferred = null;
            }

            // If all shares were received, clean up.
            if (shares.length === share.holders.length) {
              shares = null;
              jiff.deferreds[op_ids[jiff.id]] = null;
            }
          });
        })(promise, p_id);
      }

      return final_promise;
    }

    return null;
  }

  /**
   * Share the given share to all the parties in the jiff instance.
   * @param {jiff-instance} jiff - the jiff instance.
   * @param {number} share - the share.
   * @param {Array} parties - the parties to broadcast the share to.
   * @param {map} op_ids - a map from party id to operation id, this allows different messages
   *                       to have different operation id, in case operation id contains
   *                       the id of the receiver as well.
   *
   */
  function jiff_broadcast(jiff, share, parties, op_ids) {
    for (var index = 0; index < parties.length; index++) {
      var i = parties[index]; // Party id
      if (i === jiff.id) {
        receive_open(jiff, i, share.value, op_ids[i], share.Zp);
        continue;
      }

      // encrypt, sign and send
      var cipher_share = jiff.hooks.encryptSign(share.value, jiff.keymap[i], jiff.secret_key, 'open');
      var msg = {party_id: i, share: cipher_share, op_id: op_ids[i], Zp: share.Zp};
      jiff.socket.safe_emit('open', JSON.stringify(msg));
    }
  }

  /**
   * Resolves the deferred corresponding to operation_id and sender_id.
   * @param {jiff-instance} jiff - the jiff instance.
   * @param {number} sender_id - the id of the sender.
   * @param {string} share - the encrypted share, unless sender
   *                         is the same as receiver, then it is
   *                         an unencrypted number..
   * @param {number} op_id - the id of the share operation.
   * @param {number} Zp - the mod.
   */
  function receive_open(jiff, sender_id, share, op_id, Zp) {
    // Decrypt share
    if (sender_id !== jiff.id) {
      share = jiff.hooks.decryptSign(share, jiff.secret_key, jiff.keymap[sender_id], 'open');
    }

    // call hook
    share = jiff.execute_array_hooks('receiveOpen', [jiff, sender_id, share, Zp], 2);

    // Resolve the deferred.
    if (jiff.deferreds[op_id] == null) {
      jiff.deferreds[op_id] = {};
    }
    if (jiff.deferreds[op_id][sender_id] == null) {
      jiff.deferreds[op_id][sender_id] = $.Deferred();
    }

    jiff.deferreds[op_id][sender_id].resolve({value: share, sender_id: sender_id, Zp: Zp});
  }

  /**
   * Uses Lagrange polynomials to interpolate the polynomial
   * described by the given shares (points).
   * @memberof jiff.sharing_schemes
   * @method shamir_reconstruct
   * @param {jiff-instance} jiff - the jiff instance.
   * @param {Array} shares - an array of objects representing shares to reconstruct, every object has 3 attributes: value, sender_id, Zp.
   * @returns {number} the value of the polynomial at x=0 (the secret value).
   *
   */
  function jiff_lagrange(jiff, shares) {
    var lagrange_coeff = []; // will contain shares.length many elements.

    // Compute the Langrange coefficients at 0.
    for (var i = 0; i < shares.length; i++) {
      var pi = jiff.helpers.get_party_number(shares[i].sender_id);
      lagrange_coeff[pi] = 1;

      for (var j = 0; j < shares.length; j++) {
        var pj = jiff.helpers.get_party_number(shares[j].sender_id);
        if (pj !== pi) {
          var inv = jiff.helpers.extended_gcd(pi - pj, shares[i].Zp)[0];
          lagrange_coeff[pi] = jiff.helpers.mod(lagrange_coeff[pi] * (0 - pj), shares[i].Zp) * inv;
          lagrange_coeff[pi] = jiff.helpers.mod(lagrange_coeff[pi], shares[i].Zp);
        }
      }
    }

    // Reconstruct the secret via Lagrange interpolation
    var recons_secret = 0;
    for (var p = 0; p < shares.length; p++) {
      var party = jiff.helpers.get_party_number(shares[p].sender_id);
      var tmp = jiff.helpers.mod((shares[p].value * lagrange_coeff[party]), shares[p].Zp);
      recons_secret = jiff.helpers.mod((recons_secret + tmp), shares[p].Zp);
    }

    return recons_secret;
  }


  /**
   * Creates 3 shares, a share for every one of three numbers from a beaver triplet.
   * The server generates and sends the triplets on demand.
   * @param {jiff-instance} jiff - the jiff instance.
   * @param {Array} [receivers_list=all_parties] - array of party ids that want to receive the triplet shares, by default, this includes all parties.
   * @param {number} [threshold=receivers_list.length] - the min number of parties needed to reconstruct the triplet.
   * @param {number} [Zp=jiff.Zp] - the mod (if null then the default Zp for the instance is used).
   * @param {string} [triplet_id=auto_gen()] - the triplet id which is used to identify the triplet requested, so that every party
   *                              gets a share from the same triplet for every matching instruction. An automatic triplet id
   *                              is generated by increasing a local counter, default ids suffice when all parties execute the
   *                              instructions in the same order.
   * @returns {SecretShare[]} an array of 3 SecretShares [share_a, share_b, share_c] such that a * b = c.
   */
  function jiff_triplet(jiff, receivers_list, threshold, Zp, triplet_id) {
    if (Zp == null) {
      Zp = jiff.Zp;
    }
    if (receivers_list == null) {
      receivers_list = [];
      for (var i = 1; i <= jiff.party_count; i++) {
        receivers_list.push(i);
      }
    }
    if (threshold == null) {
      threshold = receivers_list.length;
    }

    // Get the id of the triplet needed.
    if (triplet_id == null) {
      triplet_id = jiff.counters.gen_triplet_id(receivers_list);
    }

    // Send a request to the server.
    var msg = JSON.stringify({triplet_id: triplet_id, receivers: receivers_list, threshold: threshold, Zp: Zp});

    // Setup deferred to handle receiving the triplets later.
    var a_deferred = $.Deferred();
    var b_deferred = $.Deferred();
    var c_deferred = $.Deferred();
    jiff.deferreds[triplet_id] = {a: a_deferred, b: b_deferred, c: c_deferred};

    // send a request to the server.
    if (jiff.id === 's1') {
      jiff.triplets_socket.safe_emit('triplet', msg);
    } else {
      jiff.triplets_socket.safe_emit('triplet', jiff.hooks.encryptSign(msg, jiff.keymap['s1'], jiff.secret_key, 'triplet'));
    }

    var a_share = jiff.secret_share(jiff, false, a_deferred.promise(), undefined, receivers_list, threshold, Zp, triplet_id + ':a');
    var b_share = jiff.secret_share(jiff, false, b_deferred.promise(), undefined, receivers_list, threshold, Zp, triplet_id + ':b');
    var c_share = jiff.secret_share(jiff, false, c_deferred.promise(), undefined, receivers_list, threshold, Zp, triplet_id + ':c');
    return [a_share, b_share, c_share];
  }

  /**
   * Store the received beaver triplet and resolves the corresponding deferred.
   * @param {jiff-instance} jiff - the jiff instance.
   * @param {number} triplet_id - the id of the triplet.
   * @param {object} triplet - the triplet (on the form: { a: share_a, b: share_b, c: share_c }).
   *
   */
  function receive_triplet(jiff, triplet_id, triplet) {
    if (jiff.deferreds[triplet_id] == null) {
      return;
    }
    triplet = jiff.execute_array_hooks('receiveTriplet', [jiff, triplet], 1);

    // Deferred is already setup, resolve it.
    jiff.deferreds[triplet_id]['a'].resolve(triplet['a']);
    jiff.deferreds[triplet_id]['b'].resolve(triplet['b']);
    jiff.deferreds[triplet_id]['c'].resolve(triplet['c']);
    jiff.deferreds[triplet_id] = null;
  }

  /**
   * Can be used to generate shares of a random number, or shares of zero.
   * For a random number, every party generates a local random number and secret share it,
   * then every party sums its share, resulting in a single share of an unknown random number for every party.
   * The same approach is followed for zero, but instead, all the parties know that the total number is zero, but they
   * do not know the value of any resulting share (except their own).
   * @param {jiff-instance} jiff - the jiff instance.
   * @param {number} n - the number to share.
   * @param {number} [threshold=receivers_list.length] - the min number of parties needed to reconstruct the secret, defaults to all the receivers.
   * @param {Array} [receivers_list=all_parties] - array of party ids to share with, by default, this includes all parties.
   * @param {Array} [senders_list=all_parties] - array of party ids to receive from, by default, this includes all parties.
   * @param {number} [Zp=jiff.Zp] - the mod.
   * @param {string|number} [share_id=auto_gen()] - the tag used to tag the messages sent by this share operation, this tag is used
   *                                   so that parties distinguish messages belonging to this share operation from other
   *                                   share operations between the same parties (when the order of execution is not
   *                                   deterministic). An automatic id is generated by increasing a local counter, default
   *                                   ids suffice when all parties execute all sharing operations with the same senders
   *                                   and receivers in the same order.
   * @return {SecretShare} this party's share of the the number, null if this party is not a receiver.
   */
  function jiff_share_all_number(jiff, n, threshold, receivers_list, senders_list, Zp, share_id) {
    if (Zp == null) {
      Zp = jiff.Zp;
    }
    if (receivers_list == null) {
      receivers_list = [];
      for (var i = 1; i <= jiff.party_count; i++) {
        receivers_list.push(i);
      }
    }
    if (senders_list == null) {
      senders_list = [];
      for (i = 1; i <= jiff.party_count; i++) {
        senders_list.push(i);
      }
    }

    var shares = jiff_share(jiff, n, threshold, receivers_list, senders_list, Zp, share_id);
    var share = shares[senders_list[0]];
    if (share != null) {
      // only do this if you are a receiving party.
      for (i = 1; i < senders_list.length; i++) {
        share = share.sadd(shares[senders_list[i]]);
      }
    }

    return share;
  }

  /**
   * Use the server to generate shares for a random bit, zero, random non-zero number, or a random number.
   * The parties will not know the value of the number (unless the request is for shares of zero) nor other parties' shares.
   * @param {jiff-instance} jiff - the jiff instance.
   * @param {object} [options={count: 1}] - an object with these properties:
   *                           { "number": number, "bit": boolean, "nonzero": boolean, "max": number, "count": number}
   * @param {Array} [receivers_list=all_parties] - array of party ids that want to receive the triplet shares, by default, this includes all parties.
   * @param {number} [threshold=receivers_list.length] - the min number of parties needed to reconstruct the number.
   * @param {number} [Zp=jiff.Zp] - the mod (if null then the default Zp for the instance is used).
   * @param {string} [number_id=auto_gen()] - the number id which is used to identify this request, so that every party
   *                             gets a share from the same number for every matching instruction. An automatic number id
   *                             is generated by increasing a local counter, default ids suffice when all parties execute the
   *                             instructions in the same order.
   * @return {SecretShare[]} - this party's share of the generated number.
   */
  function jiff_server_share_number(jiff, options, receivers_list, threshold, Zp, number_id) {
    if (Zp == null) {
      Zp = jiff.Zp;
    }
    if (receivers_list == null) {
      receivers_list = [];
      for (var i = 1; i <= jiff.party_count; i++) {
        receivers_list.push(i);
      }
    }
    if (threshold == null) {
      threshold = receivers_list.length;
    }

    // Get the id of the number.
    if (number_id == null) {
      number_id = jiff.counters.gen_number_id(receivers_list);
    }

    if (options == null) {
      options = {};
    }
    if (options.count == null) {
      options.count = 1;
    }

    var msg = {number_id: number_id, receivers: receivers_list, threshold: threshold, Zp: Zp};
    msg = Object.assign(msg, options);
    msg = JSON.stringify(msg);

    // Setup deferreds to handle receiving the triplets later.
    var shares = [];
    for (i = 0; i < options.count; i++) {
      var deferred = $.Deferred();
      jiff.deferreds[number_id + ':' + i] = deferred;
      shares[i] = jiff.secret_share(jiff, false, deferred.promise(), undefined, receivers_list, threshold, Zp, number_id + ':' + i);
    }

    // Send a request to the server.
    if (jiff.id === 's1') {
      jiff.numbers_socket.safe_emit('number', msg);
    } else {
      jiff.numbers_socket.safe_emit('number', jiff.hooks.encryptSign(msg, jiff.keymap['s1'], jiff.secret_key, 'number'));
    }

    return shares;
  }

  /**
   * Store the received share of a previously requested number from the server.
   * @param {jiff-instance} jiff - the jiff instance.
   * @param {Array<{"number": {value}, "number_id": {string}}>} numbers - an array of number values and ids
   */
  function receive_server_share_number(jiff, numbers) {
    if (jiff.deferreds[numbers[0]['number_id']] == null) {
      return;
    }
    share = jiff.execute_array_hooks('receiveNumbers', [jiff, numbers], 1);

    // Deferred is already setup, resolve it.
    for (var i = 0; i < numbers.length; i++) {
      var number_id = numbers[i]['number_id'];
      var share = numbers[i]['number'];

      jiff.deferreds[number_id].resolve(share);
      jiff.deferreds[number_id] = null;
    }
  }

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
    receivers_list.sort(); // sort to get the same order
    senders_list.sort();
    if (share_id == null) {
      share_id = jiff.counters.gen_share_id(receivers_list, senders_list) + ':array:';
    }

    // wrap around result of share_array
    var share_array_deferred = $.Deferred();
    var share_array_promise = share_array_deferred.promise();

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
   * Share an array of values. Each sender may have an array of different length. This is handled by the lengths parameter.
   * This function will reveal the lengths of the shared array.
   * If parties would like to keep the lengths of their arrays secret, they should agree on some "max" length apriori (either under MPC
   * or as part of the logistics of the computation), all their arrays should be padded to that length by using appropriate default/identity
   * values.
   * @param {jiff-instance} jiff - the jiff instance.
   * @param {Array} array - the array to be shared.
   * @param {null|number|object} lengths - the lengths of the arrays to be shared. For this to work successfully, the
   *                                       same exact value must be used in the calling code for each party. Any missing
   *                                       lengths for a row will be automatically publicly revealed by this function.
   *                                       Must have the following format:
   *                                       1. null: lengths are unknown, each sender will publicly reveal the lengths of its own array.
   *                                       2. { rows: <number>, cols: <number>, 0: <number>, 1: <number>, ...}: all parties have arrays
   *                                          with the given number of rows and cols. In case of jagged 2D arrays, different rows
   *                                          can have a different number of cols specified by using <row_index>: <col_size>.
   *                                          rows is mandatory, cols and any other number matching a specific row are optional.
   *                                       3. { <sender_party_id>: <length_object> }: must specify the lengths for each party by using
   *                                          an object with the same format as 2. Must include every party.
   * @param {number} [threshold=receivers_list.length] - the min number of parties needed to reconstruct the secret, defaults to all the receivers.
   * @param {Array} [receivers_list=all_parties] - array of party ids to share with, by default, this includes all parties.
   * @param {Array} [senders_list=all_parties] - array of party ids to receive from, by default, this includes all parties.
   * @param {number} [Zp=jiff_instance.Zp] - the mod (if null then the default Zp for the instance is used).
   * @param {string|number} [share_id=auto_gen()] - the base tag used to tag the messages sent by this share operation, every element of the array
   *                                   will get a unique id based on the concatenation of base_share_id and the index of the element.
   *                                   This tag is used so that parties distinguish messages belonging to this share operation from
   *                                   other share operations between the same parties (when the order of execution is not
   *                                   deterministic). An automatic id is generated by increasing a local counter, default
   *                                   ids suffice when all parties execute all sharing operations with the same senders
   *                                   and receivers in the same order.
   * @returns {promise} if the calling party is a receiver then a promise to the shared arrays is returned, the promise will provide an object
   *                    formatted as follows: { <party_id>: [ [ <1st_row_shares> ], [<2nd_row_share> ], ..., [ <(lengths[party_id])th_row_shares> ] ] }
   *                    where the party_ids are those of the senders.
   *                    if the calling party is not a receiver, then null is returned.
   */
  function jiff_share_2D_array(jiff, array, lengths, threshold, receivers_list, senders_list, Zp, share_id) {
    var i;

    // Check format of lengths
    if (lengths != null && typeof(lengths) !== 'object') {
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
    var lengths_deferred = $.Deferred();
    var lengths_promise = lengths_deferred.promise();

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
        lengths[sender] = { rows: parseInt(message, 10) };
        total++;
        if (total === senders_list.length) {
          jiff.remove_listener(share_id + 'length');
          lengths_deferred.resolve(lengths);
        }
      });
    } else if (typeof(lengths.rows) === 'number') {
      // All arrays are of the same length
      var l = lengths;
      lengths = {};
      for (i = 0; i < senders_list.length; i++) {
        lengths[senders_list[i]] = l;
      }

      lengths_deferred.resolve(lengths);
    } else {
      // Lengths of the different arrays are all provided
      for (i = 0; i < senders_list.length; i++) {
        if (lengths[senders_list[i]] == null || lengths[senders_list[i]].rows == null) {
          throw new Error('share_2D_array: missing rows length');
        }
      }

      lengths_deferred.resolve(lengths);
    }

    // Final results
    var share_array_deferred = $.Deferred();
    var share_array_promise = share_array_deferred.promise();

    // lengths are now set, start sharing
    lengths_promise.then(function (lengths) {
      // compute the number of sharing rounds
      var max = 0;
      for (i = 0; i < senders_list.length; i++) {
        var l = lengths[senders_list[i]].rows;
        max = l > max ? l : max;
      }

      // share every round
      var promises = [];
      for (var r = 0; r < max; r++) {
        var round_senders = [];
        for (i = 0; i < senders_list.length; i++) {
          if (lengths[senders_list[i]].rows > r) {
            round_senders.push(senders_list[i]);
          }
        }

        var row_lengths = {};
        var empty = false;
        for (var p = 0; p < round_senders.length; p++) {
          var pid = round_senders[p];
          row_lengths[pid] = lengths[pid].cols;
          if (lengths[pid][r] != null) {
            row_lengths[pid] = lengths[pid][r];
          }
          if (row_lengths[pid] == null) {
            empty = true;
          }
        }

        var row = r < array.length ? array[r] : [];
        row_lengths = empty ? null : row_lengths;
        var round_results = jiff.share_array(row, row_lengths, threshold, receivers_list, round_senders, Zp, share_id + 'row' + r + ':');
        promises.push(round_results);
      }

      // Wait for every promises corresponding to every row
      return Promise.all(promises).then(function (intermediate_results) {
        // Store results here
        var results = {};
        if (isReceiving) {
          for (i = 0; i < senders_list.length; i++) {
            results[senders_list[i]] = [];
          }
        }

        for (i = 0; i < intermediate_results.length; i++) {
          var round = intermediate_results[i];
          for (var sender_id in round) {
            if (round.hasOwnProperty(sender_id)) {
              results[sender_id].push(round[sender_id]);
            }
          }
        }

        share_array_deferred.resolve(results);
      });
    });

    return isReceiving ? share_array_promise : null;
  }

  /**
   * Opens a bunch of secret shares.
   * @param {jiff-instance} jiff - the jiff instance.
   * @param {SecretShare[]} shares - an array containing this party's shares of the secrets to reconstruct.
   * @param {Array<number|string|Array>} [parties=all_parties] - an array with party ids of receiving parties.
   *                          This must be one of 3 cases:
   *                          1. null:                       open all shares to all parties.
   *                          2. array of numbers:           open all shares to all the parties specified in the array.
   *                          3. array of array of numbers:  open share with index i to the parties specified
   *                                                         in the nested array at parties[i]. if parties[i] was null,
   *                                                         then shares[i] will be opened to all parties.
   * @param {string|number|object} [op_ids=auto_gen()] - an optional mapping that specifies the ID/Tag associated with each
   *                                        open message sent. Since open_array involves sending many messages per party,
   *                                        this parameter only specifies the BASE OPERATION ID. Each message sent will
   *                                        have this base id attached to it concatenated to a counter.
   *                                        If this is an object, then it should map an id of a receiving parties
   *                                        to the base op_id that should be used to tag the messages sent to that party.
   *                                        Parties left unmapped by this object will get an automatically generated id.
   *                                        If this is a number/string, then it will be used as the base id tagging all messages
   *                                        sent by this open to all parties.
   *                                        You can safely ignore this unless you have multiple opens each containing other opens.
   *                                        In that case, the order by which these opens are executed is not fully deterministic
   *                                        and depends on the order of arriving messages. In this case, use this parameter
   *                                        with every nested_open, to ensure ids are unique and define a total ordering on
   *                                        the execution of the opens (check implementation of slt for an example).
   * @returns {promise} a (JQuery) promise to ALL the open values of the secret, the promise will yield
   *                    a 2D array of values, each corresponding to the given share in the shares parameter
   *                    at the same index. In the case where different values are opened to different parties, the order
   *                    of the values will be preserved, but not the indices, there will be no blanks in the resulting arrays,
   *                    the first share that is opened to this party will appear at index [0], even if it was not initially
   *                    at [0].
   * @throws error if some shares does not belong to the passed jiff instance.
   */
  function jiff_open_array(jiff, shares, parties, op_ids) {
    var parties_nested_arrays = (parties != null && (parties[0] == null || (typeof(parties[0]) !== 'number' && typeof(parties[0]) !== 'string')));

    // Compute operation ids (one for each party that will receive a result
    if (op_ids == null) {
      op_ids = {};
    }

    // A base operation id is provided to use for all opens.
    if (typeof(op_ids) === 'string' || typeof(op_ids) === 'number') {
      var tmp = { s1: op_ids };
      for (i = 1; i <= jiff.party_count; i++) {
        tmp[i] = op_ids;
      }
      op_ids = tmp;
    }

    var promises = [];
    for (var i = 0; i < shares.length; i++) {
      var party = parties_nested_arrays ? parties[i] : parties;

      var ids = {};
      for (var p in op_ids) {
        if (op_ids.hasOwnProperty(p) && op_ids[p] != null) {
          ids[p] = op_ids[p] + ':' + i;
        }
      }

      var promise = jiff.open(shares[i], party, ids);
      if (promise != null) {
        promises.push(promise);
      }
    }

    if (promises.length === 0) {
      return null;
    }

    return Promise.all(promises);
  }

  /**
   * Called when this party receives a custom tag message from any party (including itself).
   * If a custom listener was setup to listen to the tag, the message is passed to the listener.
   * Otherwise, the message is stored until such a listener is provided.
   * @param {jiff-instance} jiff - the jiff instance.
   * @param {string} tag - the tag attached to the message.
   * @param {number} sender_id - the id of the sender.
   * @param {string} message - the custom message, may be encrypted.
   * @param {boolean} decrypt - if true, then the message needs to be decrypted first.
   */
  function receive_custom(jiff, tag, sender_id, message, decrypt) {
    if (decrypt === true) {
      message = jiff.hooks.decryptSign(message, jiff.secret_key, jiff.keymap[sender_id], 'custom');
    }

    if (jiff.listeners[tag] != null) {
      jiff.listeners[tag](sender_id, message);
    } else { // Store message until listener is provided
      var stored_messages = jiff.custom_messages_mailbox[tag];
      if (stored_messages == null) {
        stored_messages = [];
        jiff.custom_messages_mailbox[tag] = stored_messages;
      }

      stored_messages.push({sender_id: sender_id, message: message});
    }
  }

  /**
   * Secret share objects: provides API to perform operations on shares securly, wrap promises
   * and communication primitives to ensure operations are executed when shares are available (asynchronously)
   * without requiring the user to perform promise management/synchronization.
   * @namespace SecretShare
   */

  /**
   * Create a new share.
   * A share is a value wrapper with a share object, it has a unique id
   * (per computation instance), and a pointer to the instance it belongs to.
   * A share also has methods for performing operations.
   * @param {jiff-instance} jiff - the jiff instance.
   * @param {boolean} ready - whether the value of the share is ready or deferred.
   * @param {promise} promise - a promise to the value of the share.
   * @param {number} value - the value of the share (null if not ready).
   * @param {Array} holders - the parties that hold all the corresponding shares (must be sorted).
   * @param {number} threshold - the min number of parties needed to reconstruct the secret.
   * @param {number} Zp - the mod under which this share was created.
   * @param {string} [id=auto_gen()] - this share's id (should be unique).
   * @return {SecretShare} the secret share object containing the give value.
   *
   */
  function secret_share(jiff, ready, promise, value, holders, threshold, Zp, id) {
    /**
     * Internal helpers for operations inside/on a share. This is not exposed to the external code,
     * except through the createSecretShare hook. Modify existing helpers or add more in your extensions
     * to avoid having to re-write and duplicate the code for primitives.
     */
    var share_helpers = {
      '+': function (v1, v2) {
        return v1 + v2;
      },
      '-': function (v1, v2) {
        return v1 - v2;
      },
      '*': function (v1, v2) {
        return v1 * v2;
      },
      '/': function (v1, v2) {
        return v1 / v2;
      },
      '<': function (v1, v2) {
        return v1 < v2;
      },
      '<=': function (v1, v2) {
        return v1 <= v2;
      },
      'floor': function (v) {
        return Math.floor(v);
      },
      'ceil': function (v) {
        return Math.ceil(v);
      },
      'floor/': function (v1, v2) {
        return Math.floor(v1 / v2);
      },
      'pow': function (v1, v2) {
        return Math.pow(v1, v2);
      },
      'binary': function (v) {
        return v === 1 || v === 0;
      },
      'abs': function (v) {
        return Math.abs(v);
      },
      '==': function (v1, v2) {
        return v1 === v2;
      }
    };


    var self = {};

    /**
     * @member {jiff-instance} jiff
     * @memberof SecretShare
     * @instance
     */
    self.jiff = jiff;

    /**
     * @member {boolean} ready
     * @memberof SecretShare
     * @instance
     */
    self.ready = ready;

    /**
     * @member {promise} promise
     * @memberof SecretShare
     * @instance
     */
    self.promise = promise;
    /**
     * @member {number} value
     * @memberof SecretShare
     * @instance
     */
    self.value = value;
    /**
     * @member {Array} holders
     * @memberof SecretShare
     * @instance
     */
    self.holders = holders;
    /**
     * @member {Array} threshold
     * @memberof SecretShare
     * @instance
     */
    self.threshold = threshold;
    /**
     * @member {number} Zp
     * @memberof SecretShare
     * @instance
     */
    self.Zp = Zp;

    if (id == null) {
      id = jiff.counters.gen_share_obj_id();
    }

    /**
     * @member {string} id
     * @memberof SecretShare
     * @instance
     */
    self.id = id;

    /**
     * Gets the value of this share.
     * @method valueOf
     * @returns {number} the value (undefined if not ready yet).
     * @memberof SecretShare
     * @instance
     */
    self.valueOf = function () {
      if (ready) {
        return self.value;
      } else {
        return undefined;
      }
    };

    /**
     * Gets a string representation of this share.
     * @method toString
     * @returns {string} the id and value of the share as a string.
     * @memberof SecretShare
     * @instance
     */
    self.toString = function () {
      if (ready) {
        return self.id + ': ' + self.value;
      } else {
        return self.id + ': <deferred>';
      }
    };

    /**
     * Logs an error.
     * @method error
     * @memberof SecretShare
     * @instance
     */
    self.error = function () {
      throw new Error('Error receiving share ' + self.toString());
    };

    /**
     * Logs the value represented by this share to the console.
     * WARNING: THIS LEAKS INFORMATION AND MUST BE USED ONLY TO DEBUG ON FAKE DATA.
     * @method logLEAK
     * @memberof SecretShare
     * @instance
     * @param {string} tag - accompanying tag to display in the console.
     * @param {Array<number|string>} [parties=[holders[0]] - the parties which will display the log.
     * @return {promise} a promise to the value represented by this share after logging it, null if party is not in parties.
     */
    self.logLEAK = function (tag, parties) {
      if (parties == null) {
        parties = [self.holders[0]];
      }
      var promise = self.open(parties);
      if (promise != null) {
        promise = promise.then(function (result) {
          console.log(tag, result.toString());
          return result;
        });
      }
      return promise;
    };

    /**
     * Receives the value of this share when ready.
     * @method receive_share
     * @param {number} value - the value of the share.
     * @memberof SecretShare
     * @instance
     */
    self.receive_share = function (value) {
      self.value = value;
      self.ready = true;
      self.promise = null;
    };

    /**
     * Joins the pending promises of this share and the given share.
     * @method pick_promise
     * @param {SecretShare} o - the other share object.
     * @returns {promise} the joined promise for both shares (or whichever is pending).
     * @memberof SecretShare
     * @instance
     */
    self.pick_promise = function (o) {
      if (self.ready && o.ready) {
        return null;
      }

      if (self.ready) {
        return o.promise;
      } else if (o.ready) {
        return self.promise;
      } else {
        return Promise.all([self.promise, o.promise]);
      }
    };

    /**
     * Checks if the given parameter is a constant, used to determine whether constant or secret
     * operations should be executed.
     * @param {number/object} o - the parameter to determine.
     * @return {boolean} true if o is a valid constant, false otherwise.
     */
    self.isConstant = function (o) {
      return typeof(o) === 'number';
    };

    /**
     * Reshares/refreshes the sharing of this number, used before opening to keep the share secret.
     * @method refresh
     * @param {string} [op_id=auto_gen()] - the operation id with which to tag the messages sent by this refresh, by default
     *                         an automatic operation id is generated by increasing a local counter, default operation ids
     *                         suffice when all parties execute the instructions in the same order.
     * @returns {SecretShare} a new share of the same number.
     * @memberof SecretShare
     * @instance
     */
    self.refresh = function (op_id) {
      return self.isadd(self.jiff.server_generate_and_share({number: 0}, self.holders, self.threshold, self.Zp, op_id)[0]);
    };

    /**
     * Shortcut for opening/revealing the value of this share. Alias for open in jiff-instance.
     * @see jiff-instance#open
     * @method open
     * @memberof SecretShare
     * @instance
     * @param {Array} [parties=all_parties] - an array with party ids (1 to n) of receiving parties.
     * @param {string|number|object} [op_ids=auto_gen()] - an optional mapping that specifies the ID/Tag associated with each
     *                                        open message sent.
     * @returns {promise|null} a (JQuery) promise to the open value of the secret, null if the party is not specified in the parties array as a receiver.
     */
    self.open = function (parties, op_ids) {
      return self.jiff.open(self, parties, op_ids);
    };

    /**
     * Generic Addition.
     * Uses either the constant or secret version of this operator depending on type of paramter.
     * @method add
     * @param {number|SecretShare} o - the other operand (can be either number or share).
     * @return {SecretShare} this party's share of the result.
     * @memberof SecretShare
     * @instance
     */
    self.add = function (o) {
      if (self.isConstant(o)) {
        return self.cadd(o);
      }
      return self.sadd(o);
    };


    /**
     * Generic Subtraction.
     * Uses either the constant or secret version of this operator depending on type of paramter.
     * @method sub
     * @param {number|SecretShare} o - the other operand (can be either number or share).
     * @return {SecretShare} this party's share of the result.
     * @memberof SecretShare
     * @instance
     */
    self.sub = function (o) {
      if (self.isConstant(o)) {
        return self.csub(o);
      }
      return self.ssub(o);
    };


    /**
     * Generic Multiplication.
     * Uses either the constant or secret version of this operator depending on type of paramter.
     * @method mult
     * @param {number|SecretShare} o - the other operand (can be either number or share).
     * @param {string} [op_id=auto_gen()] - the operation id which is used to identify this multiplication (and internally, the corresponding beaver triplet).
     *                         This id must be unique, and must be passed by all parties to the same instruction.
     *                         this ensures that every party gets a share from the same triplet for every matching instruction. An automatic id
     *                         is generated by increasing a local counter, default ids suffice when all parties execute the
     *                         instructions in the same order. Only used if secret multiplication is used.
     * @return {SecretShare} this party's share of the result.
     * @memberof SecretShare
     * @instance
     */
    self.mult = function (o, op_id) {
      if (self.isConstant(o)) {
        return self.cmult(o);
      }
      return self.smult(o, op_id);
    };


    /**
     * Generic XOR for bits (both this and o have to be bits to work correctly).
     * Uses either the constant or secret version of this operator depending on type of paramter.
     * @method xor_bit
     * @param {number|SecretShare} o - the other operand (can be either number or share).
     * @param {string} [op_id=auto_gen()] - the operation id which is used to identify this operation.
     *                         This id must be unique, and must be passed by all parties to the same instruction, to
     *                         ensure that corresponding instructions across different parties are matched correctly.
     *                         Only used if secret xor is used..
     * @return {SecretShare} this party's share of the result, the final result is 1 if this < o, and 0 otherwise.
     * @return {SecretShare} this party's share of the result.
     * @memberof SecretShare
     * @instance
     */
    self.xor_bit = function (o, op_id) {
      if (self.isConstant(o)) {
        return self.cxor_bit(o);
      }
      return self.sxor_bit(o, op_id);
    };


    /**
     * Generic OR for bits (both this and o have to be bits to work correctly).
     * Uses either the constant or secret version of this operator depending on type of paramter.
     * @method or_bit
     * @param {number|SecretShare} o - the other operand (can be either number or share).
     * @param {string} [op_id=auto_gen()] - the operation id which is used to identify this operation.
     *                         This id must be unique, and must be passed by all parties to the same instruction, to
     *                         ensure that corresponding instructions across different parties are matched correctly.
     *                         Only used if secret or is used..
     * @return {SecretShare} this party's share of the result.
     * @memberof SecretShare
     * @instance
     */
    self.or_bit = function (o, op_id) {
      if (self.isConstant(o)) {
        return self.cor_bit(o);
      }
      return self.sor_bit(o, op_id);
    };


    /**
     * Generic Greater or equal.
     * Uses either the constant or secret version of this operator depending on type of paramter.
     * @method gteq
     * @param {number|SecretShare} o - the other operand (can be either number or share).
     * @param {string} [op_id=auto_gen()] - the operation id which is used to identify this operation.
     *                         This id must be unique, and must be passed by all parties to the same instruction, to
     *                         ensure that corresponding instructions across different parties are matched correctly.
     * @return {SecretShare} this party's share of the result.
     * @memberof SecretShare
     * @instance
     */
    self.gteq = function (o, op_id) {
      if (self.isConstant(o)) {
        return self.cgteq(o, op_id);
      }
      return self.sgteq(o);
    };


    /**
     * Generic Greater than.
     * Uses either the constant or secret version of this operator depending on type of paramter.
     * @method gt
     * @param {number|SecretShare} o - the other operand (can be either number or share).
     * @param {string} [op_id=auto_gen()] - the operation id which is used to identify this operation.
     *                         This id must be unique, and must be passed by all parties to the same instruction, to
     *                         ensure that corresponding instructions across different parties are matched correctly.
     * @return {SecretShare} this party's share of the result.
     * @memberof SecretShare
     * @instance
     */
    self.gt = function (o, op_id) {
      if (self.isConstant(o)) {
        return self.cgt(o, op_id);
      }
      return self.sgt(o, op_id);
    };


    /**
     * Generic Less or equal.
     * Uses either the constant or secret version of this operator depending on type of paramter.
     * @method lteq
     * @param {number|SecretShare} o - the other operand (can be either number or share).
     * @param {string} [op_id=auto_gen()] - the operation id which is used to identify this operation.
     *                         This id must be unique, and must be passed by all parties to the same instruction, to
     *                         ensure that corresponding instructions across different parties are matched correctly.
     * @return {SecretShare} this party's share of the result.
     * @memberof SecretShare
     * @instance
     */
    self.lteq = function (o, op_id) {
      if (self.isConstant(o)) {
        return self.clteq(o, op_id);
      }
      return self.slteq(o, op_id);
    };


    /**
     * Generic Less than.
     * Uses either the constant or secret version of this operator depending on type of paramter.
     * @method lt
     * @param {number|SecretShare} o - the other operand (can be either number or share).
     * @param {string} [op_id=auto_gen()] - the operation id which is used to identify this operation.
     *                         This id must be unique, and must be passed by all parties to the same instruction, to
     *                         ensure that corresponding instructions across different parties are matched correctly.
     * @return {SecretShare} this party's share of the result.
     * @memberof SecretShare
     * @instance
     */
    self.lt = function (o, op_id) {
      if (self.isConstant(o)) {
        return self.clt(o, op_id);
      }
      return self.slt(o, op_id);
    };


    /**
     * Generic Equals.
     * Uses either the constant or secret version of this operator depending on type of paramter.
     * @method eq
     * @param {number|SecretShare} o - the other operand (can be either number or share).
     * @param {string} [op_id=auto_gen()] - the operation id which is used to identify this operation.
     *                         This id must be unique, and must be passed by all parties to the same instruction, to
     *                         ensure that corresponding instructions across different parties are matched correctly.
     * @return {SecretShare} this party's share of the result.
     * @memberof SecretShare
     * @instance
     */
    self.eq = function (o, op_id) {
      if (self.isConstant(o)) {
        return self.ceq(o, op_id);
      }
      return self.seq(o, op_id);
    };


    /**
     * Generic Not Equals.
     * Uses either the constant or secret version of this operator depending on type of paramter.
     * @method neq
     * @param {number|SecretShare} o - the other operand (can be either number or share).
     * @param {string} [op_id=auto_gen()] - the operation id which is used to identify this operation.
     *                         This id must be unique, and must be passed by all parties to the same instruction, to
     *                         ensure that corresponding instructions across different parties are matched correctly.
     * @return {SecretShare} this party's share of the result.
     * @memberof SecretShare
     * @instance
     */
    self.neq = function (o, op_id) {
      if (self.isConstant(o)) {
        return self.cneq(o, op_id);
      }
      return self.sneq(o, op_id);
    };


    /**
     * Generic Integer Divison.
     * Uses either the constant or secret version of this operator depending on type of paramter.
     * @method div
     * @param {number|SecretShare} o - the other operand (can be either number or share).
     * @param {number} l - the maximum bit length of the two shares.
     * @param {string} [op_id=auto_gen()] - the operation id which is used to identify this operation.
     *                         This id must be unique, and must be passed by all parties to the same instruction, to
     *                         ensure that corresponding instructions across different parties are matched correctly.
     * @return {SecretShare} this party's share of the result.
     * @memberof SecretShare
     * @instance
     */
    self.div = function (o, l, op_id) {
      if (self.isConstant(o)) {
        return self.cdiv(o, l, op_id);
      }
      return self.sdiv(o, l, op_id);
    };

    /**
     * Addition with a constant.
     * @method cadd
     * @param {number} cst - the constant to add.
     * @return {SecretShare} this party's share of the result.
     * @memberof SecretShare
     * @instance
     */
    self.cadd = function (cst) {
      if (!(self.isConstant(cst))) {
        throw new Error('parameter should be a number (+)');
      }

      if (self.ready) {
        // if share is ready
        return self.jiff.secret_share(self.jiff, true, null, self.jiff.helpers.mod(share_helpers['+'](self.value, cst), self.Zp), self.holders, self.threshold, self.Zp);
      }

      var promise = self.promise.then(function () {
        return self.jiff.helpers.mod(share_helpers['+'](self.value, cst), self.Zp);
      }, self.error);
      return self.jiff.secret_share(self.jiff, false, promise, undefined, self.holders, self.threshold, self.Zp);
    };

    /**
     * Subtraction with a constant.
     * @method csub
     * @param {number} cst - the constant to subtract from this share.
     * @return {SecretShare} this party's share of the result.
     * @memberof SecretShare
     * @instance
     */
    self.csub = function (cst) {
      if (!(self.isConstant(cst))) {
        throw new Error('parameter should be a number (-)');
      }

      if (self.ready) {
        // if share is ready
        return self.jiff.secret_share(self.jiff, true, null, self.jiff.helpers.mod(share_helpers['-'](self.value, cst), self.Zp), self.holders, self.threshold, self.Zp);
      }

      var promise = self.promise.then(function () {
        return self.jiff.helpers.mod(share_helpers['-'](self.value, cst), self.Zp);
      }, self.error);
      return self.jiff.secret_share(self.jiff, false, promise, undefined, self.holders, self.threshold, self.Zp);
    };

    /**
     * Multiplication by a constant.
     * @method cmult
     * @param {number} cst - the constant to multiply to this share.
     * @return {SecretShare} this party's share of the result.
     * @memberof SecretShare
     * @instance
     */
    self.cmult = function (cst) {
      if (!(self.isConstant(cst))) {
        throw new Error('parameter should be a number (*)');
      }

      if (self.ready) {
        // if share is ready
        return self.jiff.secret_share(self.jiff, true, null, self.jiff.helpers.mod(share_helpers['*'](self.value, cst), self.Zp), self.holders, self.threshold, self.Zp);
      }

      var promise = self.promise.then(function () {
        return self.jiff.helpers.mod(share_helpers['*'](self.value, cst), self.Zp);
      }, self.error);
      return self.jiff.secret_share(self.jiff, false, promise, undefined, self.holders, self.threshold, self.Zp);
    };

    /**
     * Division by a constant factor of the number represented by the share.
     * @method cdivfac
     * @param {number} cst - the constant by which to divide the share.
     * @return {SecretShare} this party's share of the result.
     * @memberof SecretShare
     * @instance
     */
    self.cdivfac = function (cst) {
      if (!(self.isConstant(cst))) {
        throw new Error('Parameter should be a number (cdivfac)');
      }

      var inv = self.jiff.helpers.extended_gcd(cst, self.Zp)[0];

      if (self.ready) {
        // If share is ready.
        return self.jiff.secret_share(self.jiff, true, null, self.jiff.helpers.mod(share_helpers['*'](self.value, inv), self.Zp), self.holders, self.threshold, self.Zp);
      }

      var promise = self.promise.then(function () {
        return self.jiff.helpers.mod(share_helpers['*'](self.value, inv), self.Zp);
      }, self.error);
      return self.jiff.secret_share(self.jiff, false, promise, undefined, self.holders, self.threshold, self.Zp);
    };

    /**
     * Addition of two secret shares.
     * @method sadd
     * @param {SecretShare} o - the share to add to this share.
     * @return {SecretShare} this party's share of the result.
     * @memberof SecretShare
     * @instance
     */
    self.sadd = function (o) {
      if (!(o.jiff === self.jiff)) {
        throw new Error('shares do not belong to the same instance (+)');
      }
      if (!self.jiff.helpers.Zp_equals(self, o)) {
        throw new Error('shares must belong to the same field (+)');
      }
      if (!self.jiff.helpers.array_equals(self.holders, o.holders)) {
        throw new Error('shares must be held by the same parties (+)');
      }

      // add the two shares when ready locally
      var ready_add = function () {
        return self.jiff.helpers.mod(share_helpers['+'](self.value, o.value), self.Zp);
      };

      if (self.ready && o.ready) {
        // both shares are ready
        return self.jiff.secret_share(self.jiff, true, null, ready_add(), self.holders, max(self.threshold, o.threshold), self.Zp);
      }

      // promise to execute ready_add when both are ready
      var promise = self.pick_promise(o).then(ready_add, self.error);
      return self.jiff.secret_share(self.jiff, false, promise, undefined, self.holders, max(self.threshold, o.threshold), self.Zp);
    };

    /**
     * Subtraction of two secret shares.
     * @method ssub
     * @param {SecretShare} o - the share to subtract from this share.
     * @return {SecretShare} this party's share of the result.
     * @memberof SecretShare
     * @instance
     */
    self.ssub = function (o) {
      if (!(o.jiff === self.jiff)) {
        throw new Error('shares do not belong to the same instance (-)');
      }
      if (!self.jiff.helpers.Zp_equals(self, o)) {
        throw new Error('shares must belong to the same field (-)');
      }
      if (!self.jiff.helpers.array_equals(self.holders, o.holders)) {
        throw new Error('shares must be held by the same parties (-)');
      }

      // add the two shares when ready locally
      var ready_sub = function () {
        return self.jiff.helpers.mod(share_helpers['-'](self.value, o.value), self.Zp);
      };

      if (self.ready && o.ready) {
        // both shares are ready
        return self.jiff.secret_share(self.jiff, true, null, ready_sub(), self.holders, max(self.threshold, o.threshold), self.Zp);
      }

      // promise to execute ready_add when both are ready
      var promise = self.pick_promise(o).then(ready_sub, self.error);
      return self.jiff.secret_share(self.jiff, false, promise, undefined, self.holders, max(self.threshold, o.threshold), self.Zp);
    };

    /**
     * Multiplication of two secret shares through Beaver Triplets.
     * @method smult
     * @param {SecretShare} o - the share to multiply with.
     * @param {string} [op_id=auto_gen()] - the operation id which is used to identify this multiplication (and internally, the corresponding beaver triplet).
     *                         This id must be unique, and must be passed by all parties to the same instruction.
     *                         this ensures that every party gets a share from the same triplet for every matching instruction. An automatic id
     *                         is generated by increasing a local counter, default ids suffice when all parties execute the
     *                         instructions in the same order.
     * @return {SecretShare} this party's share of the result.
     * @memberof SecretShare
     * @instance
     */
    self.smult = function (o, op_id) {
      if (!(o.jiff === self.jiff)) {
        throw new Error('shares do not belong to the same instance (*)');
      }
      if (!self.jiff.helpers.Zp_equals(self, o)) {
        throw new Error('shares must belong to the same field (*)');
      }
      if (!self.jiff.helpers.array_equals(self.holders, o.holders)) {
        throw new Error('shares must be held by the same parties (*)');
      }

      if (op_id == null) {
        op_id = self.jiff.counters.gen_op_id('*', self.holders);
      }

      var final_deferred = $.Deferred();
      var final_promise = final_deferred.promise();
      var result = self.jiff.secret_share(self.jiff, false, final_promise, undefined, self.holders, max(self.threshold, o.threshold), self.Zp, 'share:' + op_id);

      // Get shares of triplets.
      var triplet = jiff.triplet(self.holders, max(self.threshold, o.threshold), self.Zp, op_id + ':triplet');

      var a = triplet[0];
      var b = triplet[1];
      var c = triplet[2];

      // d = s - a. e = o - b.
      var d = self.isadd(a.icmult(-1));
      var e = o.isadd(b.icmult(-1));

      // Open d and e.
      // The only communication cost.
      var e_promise = self.jiff.internal_open(e, e.holders, op_id + ':open1');
      var d_promise = self.jiff.internal_open(d, d.holders, op_id + ':open2');
      Promise.all([e_promise, d_promise]).then(function (arr) {
        var e_open = arr[0];
        var d_open = arr[1];

        // result_share = d_open * e_open + d_open * b_share + e_open * a_share + c.
        var t1 = self.jiff.helpers.mod(share_helpers['*'](d_open, e_open), self.Zp);
        var t2 = b.icmult(d_open);
        var t3 = a.icmult(e_open);

        // All this happens locally.
        var final_result = t2.icadd(t1);
        final_result = final_result.isadd(t3);
        final_result = final_result.isadd(c);

        if (final_result.ready) {
          final_deferred.resolve(final_result.value);
        } else {
          // Resolve the deferred when ready.
          final_result.promise.then(function () {
            final_deferred.resolve(final_result.value);
          });
        }
      });

      return result;
    };

    /**
     * Multiplication of two secret shares through BGW protocol.
     * @method smult_bgw
     * @param {SecretShare} o - the share to multiply with.
     * @param {string} [op_id=auto_gen()] - the operation id which is used to identify this multiplication (and internally, the corresponding beaver triplet).
     *                         This id must be unique, and must be passed by all parties to the same instruction.
     *                         this ensures that every party gets a share from the same triplet for every matching instruction. An automatic id
     *                         is generated by increasing a local counter, default ids suffice when all parties execute the
     *                         instructions in the same order.
     * @return {SecretShare} this party's share of the result.
     * @memberof SecretShare
     * @instance
     */

    self.smult_bgw = function (o, op_id) {
      if (!(o.jiff === self.jiff)) {
        throw new Error('shares do not belong to the same instance (bgw*)');
      }
      if (!self.jiff.helpers.Zp_equals(self, o)) {
        throw new Error('shares must belong to the same field (bgw*)');
      }
      if (!self.jiff.helpers.array_equals(self.holders, o.holders)) {
        throw new Error('shares must be held by the same parties (bgw*)');
      }
      if ((self.threshold - 1) + (o.threshold - 1) > self.holders.length - 1) {
        throw new Error('threshold too high for BGW (*)');
      }

      if (op_id == null) {
        op_id = self.jiff.counters.gen_op_id('bgw*', self.holders);
      }

      var final_deferred = $.Deferred();
      var final_promise = final_deferred.promise();
      var result = self.jiff.secret_share(self.jiff, false, final_promise, undefined, self.holders, max(self.threshold, o.threshold), self.Zp, 'share:' + op_id);

      Promise.all([self.promise, o.promise]).then(
        function () {
          // Get Shares  of z
          var zi = self.jiff.helpers.mod(share_helpers['*'](self.value, o.value), self.Zp);
          final_deferred.resolve(zi);
        });

      return result.change_threshold(max(self.threshold, o.threshold), op_id + ':threshold');
    };

    /**
     * change of threshold for a single share
     * @method change_threshold
     * @param {number} threshold - the new threshold
     * @param {string} [op_id=auto_gen()] - the operation id which is used to identify this multiplication (and internally, the corresponding beaver triplet).
     *                         This id must be unique, and must be passed by all parties to the same instruction.
     *                         this ensures that every party gets a share from the same triplet for every matching instruction. An automatic id
     *                         is generated by increasing a local counter, default ids suffice when all parties execute the
     *                         instructions in the same order.
     * @return {SecretShare} this party's share of the result under the new threshold
     * @memberof SecretShare
     * @instance
     */
    self.change_threshold = function (threshold, op_id) {
      if (op_id == null) {
        op_id = self.jiff.counters.gen_op_id('threshold:', self.holders);
      }

      var final_deferred = $.Deferred();
      var final_promise = final_deferred.promise();
      var result = self.jiff.secret_share(self.jiff, false, final_promise, undefined, self.holders, threshold, self.Zp, 'share:' + op_id);

      var ready_threshold = function () {
        var intermediate_shares = self.jiff.internal_share(self.value, threshold, self.holders, self.holders, self.Zp, op_id);
        var promises = [];

        for (var i = 0; i < self.holders.length; i++) {
          var party_id = self.holders[i];
          promises.push(intermediate_shares[party_id].promise);
        }

        // Reduce the degree of the polynomial back to n/2
        // potentially no need to wait on promises.......
        Promise.all(promises).then(function () {
          var reconstruct_parts = [];
          for (var i = 0; i < self.holders.length; i++) {
            var party_id = self.holders[i];
            //shamir reconstruct takes an array of objects
            //has attributes: {value: x, sender_id: y, Zp: jiff_instance.Zp}
            reconstruct_parts[i] = {value: intermediate_shares[party_id].value, sender_id: party_id, Zp: self.Zp};
          }
          var value = self.jiff.hooks.reconstructShare(self.jiff, reconstruct_parts);
          final_deferred.resolve(value);
        });
      };

      if (self.ready) {
        ready_threshold();
      } else {
        self.promise.then(ready_threshold);
      }

      return result;
    };

    /**
     * bitwise-XOR with a constant (BOTH BITS).
     * @method cxor_bit
     * @param {number} cst - the constant bit to XOR with (0 or 1).
     * @return {SecretShare} this party's share of the result.
     * @memberof SecretShare
     * @instance
     */
    self.cxor_bit = function (cst) {
      if (!(self.isConstant(cst))) {
        throw new Error('parameter should be a number (^)');
      }
      if (!share_helpers['binary'](cst)) {
        throw new Error('parameter should be binary (^)');
      }

      return self.icadd(cst).issub(self.icmult(cst).icmult(2));
    };

    /**
     * bitwise-OR with a constant (BOTH BITS).
     * @method cor_bit
     * @param {number} cst - the constant bit to OR with (0 or 1).
     * @return {SecretShare} this party's share of the result.
     * @memberof SecretShare
     * @instance
     */
    self.cor_bit = function (cst) {
      if (!(self.isConstant(cst))) {
        throw new Error('parameter should be a number (|)');
      }
      if (!share_helpers['binary'](cst)) {
        throw new Error('parameter should be binary (|)');
      }

      return self.icadd(cst).issub(self.icmult(cst));
    };

    /**
     * bitwise-XOR of two secret shares OF BITS.
     * @method sxor_bit
     * @param {SecretShare} o - the share to XOR with.
     * @param {string} [op_id=auto_gen()] - the operation id which is used to identify this operation.
     *                         This id must be unique, and must be passed by all parties to the same instruction, to
     *                         ensure that corresponding instructions across different parties are matched correctly.
     * @return {SecretShare} this party's share of the result, the final result is 1 if this < o, and 0 otherwise.
     * @return {SecretShare} this party's share of the result.
     * @memberof SecretShare
     * @instance
     */
    self.sxor_bit = function (o, op_id) {
      if (!(o.jiff === self.jiff)) {
        throw new Error('shares do not belong to the same instance (^)');
      }
      if (!self.jiff.helpers.Zp_equals(self, o)) {
        throw new Error('shares must belong to the same field (^)');
      }
      if (!self.jiff.helpers.array_equals(self.holders, o.holders)) {
        throw new Error('shares must be held by the same parties (^)');
      }

      return self.isadd(o).issub(self.ismult(o, op_id).icmult(2));
    };

    /**
     * OR of two secret shares OF BITS.
     * @method sor_bit
     * @param {SecretShare} o - the share to OR with.
     * @param {string} [op_id=auto_gen()] - the operation id which is used to identify this operation.
     *                         This id must be unique, and must be passed by all parties to the same instruction, to
     *                         ensure that corresponding instructions across different parties are matched correctly.
     * @return {SecretShare} this party's share of the result, the final result is 1 if this < o, and 0 otherwise.
     * @return {SecretShare} this party's share of the result.
     * @memberof SecretShare
     * @instance
     */
    self.sor_bit = function (o, op_id) {
      if (!(o.jiff === self.jiff)) {
        throw new Error('shares do not belong to the same instance (|)');
      }
      if (!self.jiff.helpers.Zp_equals(self, o)) {
        throw new Error('shares must belong to the same field (|)');
      }
      if (!self.jiff.helpers.array_equals(self.holders, o.holders)) {
        throw new Error('shares must be held by the same parties (|)');
      }

      return self.isadd(o).issub(self.ismult(o, op_id));
    };

    /**
     * Greater than or equal with another share.
     * @method sgteq
     * @param {SecretShare} o - the other share.
     * @param {string} [op_id=auto_gen()] - the operation id which is used to identify this operation.
     *                         This id must be unique, and must be passed by all parties to the same instruction, to
     *                         ensure that corresponding instructions across different parties are matched correctly.
     * @return {SecretShare} this party's share of the result, the final result is 1 if this >= o, and 0 otherwise.
     * @memberof SecretShare
     * @instance
     */
    self.sgteq = function (o, op_id) {
      if (!(o.jiff === self.jiff)) {
        throw new Error('shares do not belong to the same instance (>=)');
      }
      if (!self.jiff.helpers.Zp_equals(self, o)) {
        throw new Error('shares must belong to the same field (>=)');
      }
      if (!self.jiff.helpers.array_equals(self.holders, o.holders)) {
        throw new Error('shares must be held by the same parties (>=)');
      }

      if (op_id == null) {
        op_id = self.jiff.counters.gen_op_id('>=', self.holders);
      }

      return self.islt(o, op_id).inot();
    };

    /**
     * Greater than with another share.
     * @method sgt
     * @param {SecretShare} o - the other share.
     * @param {string} [op_id=auto_gen()] - the operation id which is used to identify this operation.
     *                         This id must be unique, and must be passed by all parties to the same instruction, to
     *                         ensure that corresponding instructions across different parties are matched correctly.
     * @return {SecretShare} this party's share of the result, the final result is 1 if this > o, and 0 otherwise.
     * @memberof SecretShare
     * @instance
     */
    self.sgt = function (o, op_id) {
      if (!(o.jiff === self.jiff)) {
        throw new Error('shares do not belong to the same instance (>)');
      }
      if (!self.jiff.helpers.Zp_equals(self, o)) {
        throw new Error('shares must belong to the same field (>)');
      }
      if (!self.jiff.helpers.array_equals(self.holders, o.holders)) {
        throw new Error('shares must be held by the same parties (>)');
      }

      if (op_id == null) {
        op_id = self.jiff.counters.gen_op_id('>', self.holders);
      }

      return o.islt(self, op_id);
    };

    /**
     * Less than or equal with another share.
     * @method slteq
     * @param {SecretShare} o - the other share.
     * @param {string} [op_id=auto_gen()] - the operation id which is used to identify this operation.
     *                         This id must be unique, and must be passed by all parties to the same instruction, to
     *                         ensure that corresponding instructions across different parties are matched correctly.
     * @return {SecretShare} this party's share of the result, the final result is 1 if this <= o, and 0 otherwise.
     * @memberof SecretShare
     * @instance
     */
    self.slteq = function (o, op_id) {
      if (!(o.jiff === self.jiff)) {
        throw new Error('shares do not belong to the same instance (<=)');
      }
      if (!self.jiff.helpers.Zp_equals(self, o)) {
        throw new Error('shares must belong to the same field (<=)');
      }
      if (!self.jiff.helpers.array_equals(self.holders, o.holders)) {
        throw new Error('shares must be held by the same parties (<=)');
      }

      if (op_id == null) {
        op_id = self.jiff.counters.gen_op_id('<=', self.holders);
      }

      return o.islt(self, op_id).inot();
    };

    /**
     * Less than with another share.
     * @method slt
     * @param {SecretShare} o - the other share.
     * @param {string} [op_id=auto_gen()] - the operation id which is used to identify this operation.
     *                         This id must be unique, and must be passed by all parties to the same instruction, to
     *                         ensure that corresponding instructions across different parties are matched correctly.
     * @return {SecretShare} this party's share of the result, the final result is 1 if this < o, and 0 otherwise.
     * @memberof SecretShare
     * @instance
     */
    self.slt = function (o, op_id) {
      if (!(o.jiff === self.jiff)) {
        throw new Error('shares do not belong to the same instance (<)');
      }
      if (!self.jiff.helpers.Zp_equals(self, o)) {
        throw new Error('shares must belong to the same field (<)');
      }
      if (!self.jiff.helpers.array_equals(self.holders, o.holders)) {
        throw new Error('shares must be held by the same parties (<)');
      }

      if (op_id == null) {
        op_id = self.jiff.counters.gen_op_id('<', self.holders);
      }

      var final_deferred = $.Deferred();
      var final_promise = final_deferred.promise();
      var result = self.jiff.secret_share(self.jiff, false, final_promise, undefined, self.holders, max(self.threshold, o.threshold), self.Zp, 'share:' + op_id);

      var w = self.ilt_halfprime(op_id + ':halfprime:1');
      Promise.all([w.promise]).then(function () {
        var x = o.ilt_halfprime(op_id + ':halfprime:2');
        Promise.all([x.promise]).then(function () {
          var y = self.issub(o).ilt_halfprime(op_id + ':halfprime:3');
          Promise.all([y.promise]).then(function () {
            var xy = x.ismult(y, op_id + ':smult1');
            var answer = x.icmult(-1).icadd(1).issub(y).isadd(xy).isadd(w.ismult(x.isadd(y).issub(xy.icmult(2)), op_id + ':smult2'));

            if (answer.ready) {
              final_deferred.resolve(answer.value);
            } else {
              answer.promise.then(function () {
                final_deferred.resolve(answer.value);
              });
            }
          });
        });
      });

      return result;
    };

    /**
     * Greater than or equal with a constant.
     * @method cgteqn
     * @param {number} cst - the constant to compare with.
     * @param {string} [op_id=auto_gen()] - the operation id which is used to identify this operation.
     *                         This id must be unique, and must be passed by all parties to the same instruction, to
     *                         ensure that corresponding instructions across different parties are matched correctly.
     * @return {SecretShare} this party's share of the result, the final result is 1 if this >= cst, and 0 otherwise.
     * @memberof SecretShare
     * @instance
     */
    self.cgteq = function (cst, op_id) {
      if (!(self.isConstant(cst))) {
        throw new Error('parameter should be a number (>=)');
      }

      if (op_id == null) {
        op_id = self.jiff.counters.gen_op_id('c>=', self.holders);
      }

      return self.iclt(cst, op_id).inot();
    };

    /**
     * Greater than with a constant.
     * @method cgt
     * @param {number} cst - the constant to compare with.
     * @param {string} [op_id=auto_gen()] - the operation id which is used to identify this operation.
     *                         This id must be unique, and must be passed by all parties to the same instruction, to
     *                         ensure that corresponding instructions across different parties are matched correctly.default ids suffice when all parties execute the
     *                         instructions in the same order.
     * @return {SecretShare} this party's share of the result, the final result is 1 if this > cst, and 0 otherwise.
     * @memberof SecretShare
     * @instance
     */
    self.cgt = function (cst, op_id) {
      if (!(self.isConstant(cst))) {
        throw new Error('parameter should be a number (>)');
      }

      if (op_id == null) {
        op_id = self.jiff.counters.gen_op_id('c>', self.holders);
      }

      var final_deferred = $.Deferred();
      var final_promise = final_deferred.promise();
      var result = self.jiff.secret_share(self.jiff, false, final_promise, undefined, self.holders, self.threshold, self.Zp, 'share:' + op_id);

      var w = share_helpers['<'](cst, share_helpers['/'](self.Zp, 2)) ? 1 : 0;
      var x = self.ilt_halfprime(op_id + ':halfprime:1');
      Promise.all([x.promise]).then(function () {
        var y = self.icmult(-1).icadd(cst).ilt_halfprime(op_id + ':halfprime:2');
        Promise.all([y.promise]).then(function () {
          var xy = y.ismult(x, op_id + ':smult1');
          var answer = x.icmult(-1).icadd(1).issub(y).isadd(xy).isadd(x.isadd(y).issub(xy.icmult(2)).icmult(w));

          if (answer.ready) {
            final_deferred.resolve(answer.value);
          } else {
            answer.promise.then(function () {
              final_deferred.resolve(answer.value);
            });
          }
        });
      });

      return result;
    };

    /**
     * Less than or equal with a constant.
     * @method clteq
     * @param {number} cst - the constant to compare with.
     * @param {string} [op_id=auto_gen()] - the operation id which is used to identify this operation.
     *                         This id must be unique, and must be passed by all parties to the same instruction, to
     *                         ensure that corresponding instructions across different parties are matched correctly.
     * @return {SecretShare} this party's share of the result, the final result is 1 if this <= cst, and 0 otherwise.
     * @memberof SecretShare
     * @instance
     */
    self.clteq = function (cst, op_id) {
      if (!(self.isConstant(cst))) {
        throw new Error('parameter should be a number (<=)');
      }

      if (op_id == null) {
        op_id = self.jiff.counters.gen_op_id('c<=', self.holders);
      }

      return self.icgt(cst, op_id).inot();
    };

    /**
     * Less than with a constant.
     * @method clt
     * @param {number} cst - the constant to compare with.
     * @param {string} [op_id=auto_gen()] - the operation id which is used to identify this operation.
     *                         This id must be unique, and must be passed by all parties to the same instruction, to
     *                         ensure that corresponding instructions across different parties are matched correctly.
     * @return {SecretShare} this party's share of the result, the final result is 1 if this < cst, and 0 otherwise.
     * @memberof SecretShare
     * @instance
     */
    self.clt = function (cst, op_id) {
      if (!(self.isConstant(cst))) {
        throw new Error('parameter should be a number (<)');
      }

      if (op_id == null) {
        op_id = self.jiff.counters.gen_op_id('c<', self.holders);
      }

      var final_deferred = $.Deferred();
      var final_promise = final_deferred.promise();
      var result = self.jiff.secret_share(self.jiff, false, final_promise, undefined, self.holders, self.threshold, self.Zp, 'share:' + op_id);

      var w = self.ilt_halfprime(op_id + ':halfprime:1');
      Promise.all([w.promise]).then(function () {
        var x = share_helpers['<'](cst, share_helpers['/'](self.Zp, 2)) ? 1 : 0;
        var y = self.icsub(cst).ilt_halfprime(op_id + ':halfprime:2');
        Promise.all([y.promise]).then(function () {
          var xy = y.icmult(x);
          var answer = y.icmult(-1).icadd(1 - x).isadd(xy).isadd(w.ismult(y.icadd(x).issub(xy.icmult(2)), op_id + ':smult1'));

          if (answer.ready) {
            final_deferred.resolve(answer.value);
          } else {
            answer.promise.then(function () {
              final_deferred.resolve(answer.value);
            });
          }
        });
      });

      return result;
    };

    /**
     * Equality test with two shares.
     * @method seq
     * @param {SecretShare} o - the share to compare with.
     * @param {string} [op_id=auto_gen()] - the operation id which is used to identify this operation.
     *                         This id must be unique, and must be passed by all parties to the same instruction, to
     *                         ensure that corresponding instructions across different parties are matched correctly.
     * @return {SecretShare} this party's share of the result, the final result is 1 if this = o, and 0 otherwise.
     * @memberof SecretShare
     * @instance
     */
    self.seq = function (o, op_id) {
      if (!(o.jiff === self.jiff)) {
        throw new Error('shares do not belong to the same instance (==)');
      }
      if (!self.jiff.helpers.Zp_equals(self, o)) {
        throw new Error('shares must belong to the same field (==)');
      }
      if (!self.jiff.helpers.array_equals(self.holders, o.holders)) {
        throw new Error('shares must be held by the same parties (==)');
      }

      if (op_id == null) {
        op_id = self.jiff.counters.gen_op_id('=', self.holders);
      }

      return self.issub(o).iclteq(0, op_id);
    };

    /**
     * Unequality test with two shares.
     * @method sneq
     * @param {SecretShare} o - the share to compare with.
     * @param {string} [op_id=auto_gen()] - the operation id which is used to identify this operation.
     *                         This id must be unique, and must be passed by all parties to the same instruction, to
     *                         ensure that corresponding instructions across different parties are matched correctly.
     * @return {SecretShare} this party's share of the result, the final result is 0 if this = o, and 1 otherwise.
     * @memberof SecretShare
     * @instance
     */
    self.sneq = function (o, op_id) {
      if (!(o.jiff === self.jiff)) {
        throw new Error('shares do not belong to the same instance (!=)');
      }
      if (!self.jiff.helpers.Zp_equals(self, o)) {
        throw new Error('shares must belong to the same field (!=)');
      }
      if (!self.jiff.helpers.array_equals(self.holders, o.holders)) {
        throw new Error('shares must be held by the same parties (!=)');
      }
      return self.iseq(o, op_id).inot();
    };

    /**
     * Equality test with a constant.
     * @method ceq
     * @param {number} cst - the constant to compare with.
     * @param {string} [op_id=auto_gen()] - the operation id which is used to identify this operation.
     *                         This id must be unique, and must be passed by all parties to the same instruction, to
     *                         ensure that corresponding instructions across different parties are matched correctly.
     * @return {SecretShare} this party's share of the result, the final result is 0 if this = o, and 1 otherwise.
     * @memberof SecretShare
     * @instance
     */
    self.ceq = function (cst, op_id) {
      if (!(self.isConstant(cst))) {
        throw new Error('parameter should be a number (==)');
      }

      if (op_id == null) {
        op_id = self.jiff.counters.gen_op_id('c=', self.holders);
      }

      return self.icsub(cst).iclteq(0, op_id);
    };

    /**
     * Unequality test with a constant.
     * @method cneq
     * @param {number} cst - the constant to compare with.
     * @param {string} [op_id=auto_gen()] - the operation id which is used to identify this operation.
     *                         This id must be unique, and must be passed by all parties to the same instruction, to
     *                         ensure that corresponding instructions across different parties are matched correctly.
     * @return {SecretShare} this party's share of the result, the final result is 0 if this = o, and 1 otherwise.
     * @memberof SecretShare
     * @instance
     */
    self.cneq = function (cst, op_id) {
      if (!(self.isConstant(cst))) {
        throw new Error('parameter should be a number (!=)');
      }
      return self.iceq(cst, op_id).inot();
    };

    /**
     * Negation of a bit.
     * This has to be a share of a BIT in order for this to work properly.
     * @method not
     * @return {SecretShare} this party's share of the result (negated bit).
     * @memberof SecretShare
     * @instance
     */
    self.not = function () {
      return self.icmult(-1).icadd(1);
    };

    /**
     * Integer divison with two shares (self / o)
     * @method sdiv
     * @param {SecretShare} o - the share to divide by.
     * @param {number} [l=log_2(self.Zp)] - the maximum bit length of the answer.
     * @param {string} [op_id=auto_gen()] - the operation id which is used to identify this operation.
     *                         This id must be unique, and must be passed by all parties to the same instruction, to
     *                         ensure that corresponding instructions across different parties are matched correctly.
     * @return {SecretShare} this party's share of the result.
     * @memberof SecretShare
     * @instance
     */
    self.sdiv = function (o, l, op_id) {
      if (!(o.jiff === self.jiff)) {
        throw new Error('shares do not belong to the same instance (!=)');
      }
      if (!self.jiff.helpers.Zp_equals(self, o)) {
        throw new Error('shares must belong to the same field (!=)');
      }
      if (!self.jiff.helpers.array_equals(self.holders, o.holders)) {
        throw new Error('shares must be held by the same parties (!=)');
      }

      if (op_id == null) {
        op_id = self.jiff.counters.gen_op_id('/', self.holders);
      }

      var lZp = share_helpers['ceil'](self.jiff.helpers.bLog(self.Zp, 2));
      if (l == null) {
        l = lZp;
      } else {
        l = l < lZp ? l : lZp;
      }

      // Store the result
      var final_deferred = $.Deferred();
      var final_promise = final_deferred.promise();
      var result = self.jiff.secret_share(self.jiff, false, final_promise, undefined, self.holders, max(self.threshold, o.threshold), self.Zp, 'share:' + op_id);

      var q = self.jiff.server_generate_and_share({number: 0}, self.holders, max(self.threshold, o.threshold), self.Zp, op_id + ':number')[0];
      var a = self; // dividend

      (function one_bit(i) {
        if (i >= l) {
          // we did this for all bits, q has the answer
          if (q.ready) {
            final_deferred.resolve(q.value);
          } else {
            q.promise.then(function () {
              final_deferred.resolve(q.value);
            });
          }
          return;
        }

        var power = share_helpers['pow'](2, (l - 1) - i);
        var ZpOVERpower = share_helpers['floor/'](o.Zp, power);
        // (2^i + 2^k + ...) * o <= self
        // 2^l * o <= self => q = 2^l, self = self - o * 2^l
        var tmp = o.icmult(power); // this may wrap around, in which case we must ignored it, since the answer MUST fit in the field.
        var tmpFits = o.iclteq(ZpOVERpower, op_id + ':c<=' + i);
        var tmpCmp = tmp.islteq(a, op_id + ':<=' + i);

        var and = tmpFits.ismult(tmpCmp, op_id + ':smult1:' + i);
        q = q.isadd(and.icmult(power));
        a = a.issub(and.ismult(tmp, op_id + ':smult2:' + i)); // a - tmp > 0 if tmp > 0

        Promise.all([q.promise, a.promise]).then(function () {
          one_bit(i + 1);
        });
      })(0);
      return result;
    };

    /**
     * Integer divison with a share and a constant (self / cst).
     * @method cdiv
     * @param {SecretShare} cst - the constant to divide by.
     * @param {string} [op_id=auto_gen()] - the operation id which is used to identify this operation.
     *                         This id must be unique, and must be passed by all parties to the same instruction, to
     *                         ensure that corresponding instructions across different parties are matched correctly.
     * @return {SecretShare} this party's share of the result.
     * @memberof SecretShare
     * @instance
     */
    self.cdiv = function (cst, op_id) {
      if (!(self.isConstant(cst))) {
        throw new Error('parameter should be a number (/)');
      }

      if (share_helpers['<='](cst, 0)) {
        throw new Error('divisor must be > 0 (cst/): ' + cst);
      }

      if (share_helpers['<='](self.Zp, cst)) {
        throw new Error('divisor must be < share.Zp (' + self.Zp + ') in (cst/): ' + cst);
      }

      if (op_id == null) {
        op_id = self.jiff.counters.gen_op_id('c/', self.holders);
      }

      // Allocate share for result to which the answer will be resolved once available
      var final_deferred = $.Deferred();
      var final_promise = final_deferred.promise();
      var result = self.jiff.secret_share(self.jiff, false, final_promise, undefined, self.holders, self.threshold, self.Zp, 'share:' + op_id);

      var ZpOVERc = share_helpers['floor/'](self.Zp, cst);

      // add uniform noise to self so we can open
      var nOVERc = self.jiff.server_generate_and_share({max: ZpOVERc}, self.holders, self.threshold, self.Zp, op_id + ':nOVERc')[0];
      var nMODc = self.jiff.server_generate_and_share({max: cst}, self.holders, self.threshold, self.Zp, op_id + ':nMODc')[0];
      var noise = nOVERc.icmult(cst).isadd(nMODc);

      var noisyX = self.isadd(noise);
      self.jiff.internal_open(noisyX, noisyX.holders, op_id + ':open').then(function (noisyX) {
        var wrapped = self.icgt(noisyX, op_id + ':wrap_cgt'); // 1 => x + noise wrapped around Zp, 0 otherwise

        // if we did not wrap
        var noWrapDiv = share_helpers['floor/'](noisyX, cst);
        var unCorrectedQuotient = nOVERc.icmult(-1).icadd(noWrapDiv).icsub(1);
        var verify = self.issub(unCorrectedQuotient.icmult(cst));
        var isNotCorrect = verify.icgteq(cst, op_id + ':cor1');
        var noWrapAnswer = unCorrectedQuotient.isadd(isNotCorrect); // if incorrect => isNotCorrect = 1 => quotient = unCorrectedQuotient - 1

        // if we wrapped
        var wrapDiv = share_helpers['floor/'](share_helpers['+'](noisyX, self.Zp), cst);
        unCorrectedQuotient = nOVERc.icmult(-1).icadd(wrapDiv).icsub(1);
        verify = self.issub(unCorrectedQuotient.icmult(cst));
        isNotCorrect = verify.icgteq(cst, op_id + ':cor2');
        var wrapAnswer = unCorrectedQuotient.isadd(isNotCorrect); // if incorrect => isNotCorrect = 1 => quotient = unCorrectedQuotient - 1

        var answer = noWrapAnswer.isadd(wrapped.ismult(wrapAnswer.issub(noWrapAnswer), op_id + ':smult'));

        if (answer.ready) {
          final_deferred.resolve(answer.value);
        } else {
          answer.promise.then(function () {
            final_deferred.resolve(answer.value);
          });
        }
      });

      // special case, if result is zero, sometimes we will get to -1 due to how correction happens above (.csub(1) and then compare)
      var zeroIt = self.iclt(cst, op_id + ':zero_check').inot();
      return result.ismult(zeroIt, op_id + ':zero_it');
    };

    /**
     * Remainder with two shares (self % o)
     * @method smod
     * @param {SecretShare} o - the modulus to apply
     * @param {number} [l=log_2(self.Zp)] - the maximum bit length of the answer.
     * @param {string} [op_id=auto_gen()] - the operation id which is used to identify this operation.
     *                         This id must be unique, and must be passed by all parties to the same instruction, to
     *                         ensure that corresponding instructions across different parties are matched correctly.
     * @return {SecretShare} this party's share of the result.
     * @memberof SecretShare
     * @instance
     */
    self.smod = function (o, l, op_id) {
      if (!(o.jiff === self.jiff)) {
        throw new Error('shares do not belong to the same instance (!=)');
      }
      if (!self.jiff.helpers.Zp_equals(self, o)) {
        throw new Error('shares must belong to the same field (!=)');
      }
      if (!self.jiff.helpers.array_equals(self.holders, o.holders)) {
        throw new Error('shares must be held by the same parties (!=)');
      }

      if (op_id == null) {
        op_id = self.jiff.counters.gen_op_id('/', self.holders);
      }

      var r = self.isdiv(o, l, op_id + ':sdiv');
      return self.issub(r.ismult(o, op_id + ':smult'));
    };

    /**
     * Checks whether the share is less than half the field size.
     * @method lt_halfprime
     * @memberof SecretShare
     * @instance
     * @param {string} [op_id=auto_gen()] - the operation id which is used to identify this operation.
     *                         This id must be unique, and must be passed by all parties to the same instruction, to
     *                         ensure that corresponding instructions across different parties are matched correctly.
     * @return {SecretShare} this party's share of the result.
     */
    self.lt_halfprime = function (op_id) {
      if (op_id == null) {
        op_id = self.jiff.counters.gen_op_id('lt_hp', self.holders);
      }

      var final_deferred = $.Deferred();
      var final_promise = final_deferred.promise();
      var result = self.jiff.secret_share(self.jiff, false, final_promise, undefined, self.holders, self.threshold, self.Zp, 'share:' + op_id);

      // if 2*self is even, then self is less than half prime, otherwise self is greater or equal to half prime
      var share = self.icmult(2);

      // To check if share is even, we will use pre-shared bits as some form of a bit mask
      var bitLength = share_helpers['floor'](self.jiff.helpers.bLog(share.Zp, 2)); // TODO: this leaks one bit, fix it for mod 2^n
      var bits = self.jiff.server_generate_and_share({
        bit: true,
        count: bitLength
      }, share.holders, share.threshold, share.Zp, op_id + ':number:bits');
      bits[bitLength] = self.jiff.server_generate_and_share({number: 0}, share.holders, share.threshold, share.Zp, op_id + ':number:' + bitLength)[0]; // remove this line when fixing TODO

      // bit composition: r = (rl ... r1 r0)_10
      var r = self.jiff.protocols.bit_composition(bits);
      // open share + noise, and utilize opened value with shared bit representation of noise to check the least significant digit of share.
      share.jiff.internal_open(r.isadd(share), share.holders, op_id + ':open').then(function (result) {
        var wrapped = self.jiff.protocols.clt_bits(result, bits, op_id);
        var isOdd = self.jiff.helpers.mod(result, 2);
        isOdd = bits[0].icxor_bit(isOdd);
        isOdd = isOdd.isxor_bit(wrapped, op_id + ':sxor_bit');

        var answer = isOdd.inot();
        if (answer.ready) {
          final_deferred.resolve(answer.value);
        } else {
          answer.promise.then(function () {
            final_deferred.resolve(answer.value);
          });
        }
      });

      return result;
    };

    /**
     * Simulate an oblivious If-else statement with a single return value.
     * Should be called on a secret share of a bit: 0 representing false, and 1 representing true
     * If this is a share of 1, a new sharing of the element represented by the first parameter is returned,
     * otherwise, a new sharing of the second is returned.
     * @method if_else
     * @memeberof SecretShare
     * @instance
     * @param {SecretShare|constant} trueVal - the value/share to return if this is a sharing of 1.
     * @param {SecretShare|constant} falseVal - the value/share to return if this is a sharing of 0.
     * @param {string} [op_id=auto_gen()] - the operation id which is used to identify this operation.
     *                         This id must be unique, and must be passed by all parties to the same instruction, to
     *                         ensure that corresponding instructions across different parties are matched correctly.
     * @return {SecretShare} a new sharing of the result of the if.
     */
    self.if_else = function (trueVal, falseVal, op_id) {
      if (op_id == null) {
        op_id = self.jiff.counters.gen_op_id('ifelse', self.holders);
      }

      var const1 = self.isConstant(trueVal);
      var const2 = self.isConstant(falseVal);
      if (const1 && const2) {
        return self.icmult(trueVal).isadd(self.inot().icmult(falseVal));
      } else if (const1) {
        return self.inot().ismult(falseVal.icsub(trueVal), op_id).icadd(trueVal);
      } else if (const2) {
        return self.ismult(trueVal.icsub(falseVal), op_id).icadd(falseVal);
      } else {
        return self.ismult(trueVal.issub(falseVal), op_id).isadd(falseVal);
      }
    };

    // when the promise is resolved, acquire the value of the share and set ready to true
    if (!ready) {
      self.promise.then(self.receive_share, self.error);
      self.jiff.add_to_barriers(self.promise);
    }

    // internal variant of primitives, to use internally by other primitives
    var internals = ['cadd', 'csub', 'cmult', 'sadd', 'ssub', 'smult',
      'cxor_bit', 'sxor_bit', 'cor_bit', 'sor_bit',
      'slt', 'slteq', 'sgt', 'sgteq', 'seq', 'sneq',
      'clt', 'clteq', 'cgt', 'cgteq', 'ceq', 'cneq',
      'sdiv', 'cdiv', 'not', 'lt_halfprime', 'if_else'];
    for (var i = 0; i < internals.length; i++) {
      var key = internals[i];
      self['i' + key] = self[key];
    }

    // return the share
    return jiff.execute_array_hooks('createSecretShare', [jiff, self, share_helpers], 1);
  }

  /**
   * The interface defined by an instance of jiff.
   * You can get an instance of jiff by calling function {@link jiff.make_jiff}.
   * You can access any of the specified members of function with &lt;jiff-instance&gt;.&lt;member-name&gt;.
   * @namespace jiff-instance
   * @version 1.0
   */

  /**
   * Create a new jiff instance.
   * @memberof jiff
   * @function make_jiff
   * @param {string} hostname - server hostname/ip and port.
   * @param {string} computation_id - the id of the computation of this instance.
   * @param {object} [options={}] - javascript object with additional options.
   *                           all parameters are optional, However, private and public key must either be both provided or neither of them provided.
   <pre>
   {
     "triplets_server": "http://hostname:port",
     "numbers_server": "http://hostname:port",
     "keys_server": "http://hostname:port",
     "party_id": number,
     "party_count": number,
     "secret_key": Uint8Array to be used with libsodium-wrappers [(check Library Specs)]{@link https://download.libsodium.org/doc/public-key_cryptography/authenticated_encryption.html},
     "public_key": Uint8Array to be used with libsodium-wrappers [(check Library Specs)]{@link https://download.libsodium.org/doc/public-key_cryptography/authenticated_encryption.html},
     "public_keys": { 1: "Uint8Array PublicKey", 2: "Uint8Array PublicKey", ... },
     "Zp": default mod to use (prime number),
     "autoConnect": true/false,
     "hooks": { 'check out <a href="hooks.html">hooks documentation</a>' },
     "listeners" : A map from custom tags to listeners (of type function(sender_id, message_string)) that handle custom messages with that tag.
     "onConnect": function(jiff_instance)
   }
   </pre>
   *
   * @return {jiff-instance} the jiff instance for the described computation.
   *                          The Jiff instance contains the socket, number of parties, functions
   *                          to share and perform operations, as well as synchronization flags.
   *
   */
  function make_jiff(hostname, computation_id, options) {
    if (options == null) {
      options = {};
    }

    var jiff = {};

    /**
     * An array containing the names (jiff-client-[name].js) of extensions
     * applied to this instance.
     * @member {string[]} extensions
     * @memberof jiff-instance
     * @instance
     */
    jiff.extensions = [];

    /**
     * Checks if the given extension is applied.
     * @method has_extension
     * @memberof jiff-instance
     * @instance
     * @param {string} name - the extension name (found in the filename at jiff-client-[name].js).
     * @return {boolean} true if the extension was applied, false otherwise.
     */
    jiff.has_extension = function (name) {
      return jiff.extensions.indexOf(name) > -1;
    };

    /**
     * Checks if a given extension can be safely applied to the instance
     * @method can_apply_extension
     * @memberof jiff-instance
     * @instance
     * @param {string} name - the extension name (found in the filename at jiff-client[name].js)
     * @return {boolean|string} true if the extension can be safely applied, otherwise returns an error message.
     */
    jiff.can_apply_extension = function (name) {
      return true;
    };

    /**
     * Safely applies the given extension, if the extension is safe, it will be applied succesfully.
     * If the extension is not safe to be applied, an exception will be thrown with an appropriate error message.
     * @method apply_extension
     * @memberof jiff-instance
     * @instance
     * @param {object} ext - the namespace of the extension acquired when the extension is imported, should contain a make_jiff function.
     * @param {object} [options={}] - optional options to be passed to the extension.
     */
    jiff.apply_extension = function (ext, options) {
      if (options == null) {
        options = {};
      }

      var name = ext.name;
      var status = jiff.can_apply_extension(name);

      if (status === true) {
        ext.make_jiff(jiff, options);

        jiff.extensions.push(name);
        jiff.extension_applied(name, options);
      } else {
        throw status;
      }
    };

    /**
     * Called when an extension was applied successfully. Override to change behavior based on future extensions.
     * @param {string} name - the name of the applied extension.
     * @param {object} [options={}] - the options passed by the user to the newly applied extension.
     */
    jiff.extension_applied = function (name, options) {};

    /**
     * The id of this party. [Do not modify]
     * @member {number} id
     * @memberof jiff-instance
     * @instance
     */
    jiff.id = options.party_id;

    /**
     * Stores the computation id. [Do not modify]
     * @member {string} computation_id
     * @memberof jiff-instance
     * @instance
     */
    jiff.computation_id = computation_id;

    /**
     * Flags whether this instance is capable of starting the computation.
     * In other words, the public keys for all parties and servers are known,
     * and the server is connected. [Do not use; ufse isReady() instead]
     * @member {boolean} __ready
     * @memberof jiff-instance
     * @instance
     */
    jiff.__ready = false;

    /**
     * Checks whether this instance is connected and the server signaled the start of computation.
     * @method isReady
     * @memberof jiff-instance
     * @instance
     * @return {boolean} true if the instance is ready, false otherwise.
     */
    jiff.isReady = function () {
      return jiff.__ready;
    };

    /**
     * The default Zp for this instance.
     * @memberof jiff-instance
     * @member {number} Zp
     * @instance
     */
    jiff.Zp = (options.Zp == null ? gZp : options.Zp);

    // Setup sockets.
    var guard_socket = function (socket) {
      // Outgoing messages mailbox (linked list)
      socket.mailbox = linked_list();

      // Store message in the mailbox until acknowledgment is received
      socket.safe_emit = function (label, msg) {
        // add message to mailbox
        var mailbox_pointer = socket.mailbox.add({label: label, msg: msg});
        if (socket.connected) {
          // emit the message, if an acknowledgment is received, remove it from mailbox
          socket.emit(label, msg, function (status) {
            if (status) {
              socket.mailbox.remove(mailbox_pointer);
              if (socket.mailbox.head == null && socket.empty_deferred != null) {
                socket.empty_deferred.resolve();
              }
            }
          });
        }
      };

      // Resend all pending messages
      socket.resend_mailbox = function () {
        // Create a new mailbox, since the current mailbox will be resent and
        // will contain new backups.
        var old_mailbox = socket.mailbox;
        socket.mailbox = linked_list();

        // loop over all stored messages and emit them
        var current_node = old_mailbox.head;
        while (current_node != null) {
          var label = current_node.object.label;
          var msg = current_node.object.msg;
          // this emit could potentially fail, use safe emit instead.
          socket.safe_emit(label, msg);

          current_node = current_node.next;
        }
      };

      // Safe disconnect: only after all messages were acknowledged
      socket.safe_disconnect = function (free, callback) {
        if (socket.mailbox.head == null && jiff.counters.pending_opens === 0) {
          if (free) {
            socket.safe_emit('free', '');
          }

          socket.disconnect();
          if (callback != null) {
            callback();
          }
        } else {
          socket.empty_deferred = $.Deferred();
          socket.empty_deferred.promise().then(function deferred_safe_disconnect() {
            if (jiff.counters.pending_opens === 0) {
              socket.empty_deferred = null;
              if (free) {
                socket.safe_emit('free', '');
              }
              socket.disconnect();
              if (callback != null) {
                callback();
              }
            } else {
              socket.empty_deferred = $.Deferred();
              socket.empty_deferred.promise().then(deferred_safe_disconnect);
            }
          });
        }
      };

      return socket;
    };

    // setup main socket
    // eslint-disable-next-line no-undef
    jiff.socket = (options.__internal_socket == null ? io(hostname, {autoConnect: false}) : options.__internal_socket);

    if (options.__internal_socket == null) {
      guard_socket(jiff.socket);
    } else {
      jiff.socket.safe_emit = jiff.socket.emit;
      jiff.socket.resend_mailbox = function () {
      };
    }

    // setup aux sockets
    if (options.triplets_server == null || options.triplets_server === hostname) {
      jiff.triplets_socket = jiff.socket;
    } else {
      // eslint-disable-next-line no-undef
      jiff.triplets_socket = guard_socket(io(options.triplets_server));
      jiff.triplets_socket.on('connect', jiff.triplets_socket.resend_mailbox);
    }

    if (options.numbers_server == null || options.numbers_server === hostname) {
      jiff.numbers_socket = jiff.socket;
    } else {
      // eslint-disable-next-line no-undef
      jiff.numbers_socket = guard_socket(io(options.numbers_server));
      jiff.numbers_socket.on('connect', jiff.numbers_socket.resend_mailbox);
    }

    // Parse options
    if (options.onError == null) {
      options.onError = console.log;
    }

    if (options.public_keys != null) {
      /**
       * A map from party id to public key. Where key is the party id (number), and
       * value is the public key (Uint8Array).
       * @member {object} keymap
       * @memberof jiff-instance
       * @instance
       */
      jiff.keymap = options.public_keys;
    } else if (options.secret_key != null && options.public_key != null) {
      /**
       * The secret key of this party [(check Library Specs)]{@link https://download.libsodium.org/doc/public-key_cryptography/authenticated_encryption.html}. [Do not modify]
       * @member {Uint8Array} secret_key
       * @memberof jiff-instance
       * @instance
       */
      jiff.secret_key = options.secret_key;
      /**
       * The public key of this party [(check Library Specs)]{@link https://download.libsodium.org/doc/public-key_cryptography/authenticated_encryption.html}. [Do not modify]
       * @member {Uint8Array} public_key
       * @memberof jiff-instance
       * @instance
       */
      jiff.public_key = options.public_key;
    }

    if (jiff.keymap == null) {
      jiff.keymap = {};
    }

    /**
     * For the case when messages from some party is received before its public key is known.
     * { 'party_id': [ { 'label': 'share/open', <other attributes of the message> } ] }
     * @member {object} messagesWaitingKeys
     * @memberof jiff-instance
     * @instance
     */
    jiff.messagesWaitingKeys = {};

    if (options.party_count != null) {
      /**
       * Total party count in the computation, parties will take ids between 1 to party_count (inclusive).
       * @member {number} party_count
       * @memberof jiff-instance
       * @instance
       */
      jiff.party_count = options.party_count;
    }

    if (options.listeners == null) {
      options.listeners = {};
    }

    /**
     * A map from tags to listeners (functions that take a sender_id and a string message).
     * Stores listeners that are attached to this JIFF instance, listeners listen to custom messages sent by other parties
     * with a corresponding tag to the tag provided with the listener.
     * @member {object} listeners
     * @memberof jiff-instance
     * @instance
     */
    jiff.listeners = options.listeners;

    /**
     * Stores custom messages that are received before their listeners are set. Messages are stored in order.
     * Once a listener has been set, the corresponding messages are sent to it in order.
     * This object has this format: { 'tag' => [ { "sender_id": <sender_id>, "message": <message> }, ... ] }
     * @member {object} custom_messages_mailbox
     * @memberof jiff-instance
     * @instance
     */
    jiff.custom_messages_mailbox = {};

    /**
     * Stores all secret shares' promises belonging to a specific barrier.
     * @member {promise[][]} barriers
     * @memberOf jiff-instance
     * @instance
     */
    jiff.barriers = [];

    /**
     * The hooks for this instance.
     * Checkout the <a href="hooks.html">hooks documentation</a>
     * @member {object} hooks
     * @memberof jiff-instance
     * @instance
     */
    jiff.hooks = options.hooks;

    // Default hooks:
    if (jiff.hooks == null) {
      jiff.hooks = {};
    }
    if (jiff.hooks.computeShares == null) {
      jiff.hooks.computeShares = jiff_compute_shares;
    }
    if (jiff.hooks.reconstructShare == null) {
      jiff.hooks.reconstructShare = jiff_lagrange;
    }
    if (jiff.hooks.encryptSign == null) {
      jiff.hooks.encryptSign = encrypt_and_sign;
    }
    if (jiff.hooks.decryptSign == null) {
      jiff.hooks.decryptSign = decrypt_and_sign;
    }

    // Array hooks should have empty array by default
    if (jiff.hooks.beforeShare == null) {
      jiff.hooks.beforeShare = [];
    }
    if (jiff.hooks.afterComputeShare == null) {
      jiff.hooks.afterComputeShare = [];
    }
    if (jiff.hooks.receiveShare == null) {
      jiff.hooks.receiveShare = [];
    }
    if (jiff.hooks.beforeOpen == null) {
      jiff.hooks.beforeOpen = [];
    }
    if (jiff.hooks.receiveOpen == null) {
      jiff.hooks.receiveOpen = [];
    }
    if (jiff.hooks.afterReconstructShare == null) {
      jiff.hooks.afterReconstructShare = [];
    }
    if (jiff.hooks.receiveTriplet == null) {
      jiff.hooks.receiveTriplet = [];
    }
    if (jiff.hooks.receiveNumbers == null) {
      jiff.hooks.receiveNumbers = [];
    }
    if (jiff.hooks.createSecretShare == null) {
      jiff.hooks.createSecretShare = [];
    }

    /**
     * Execute all hooks attached to the given name in order.
     * Hooks are executed sequentially such that the first hook's return value is passed into the second and so on.
     * @method execute_array_hooks
     * @memberof jiff-instance
     * @instance
     * @param {string} hook_name - the name of the hook
     * @param {Array} params - parameters to pass to the hooks
     * @param {number} acc_index - the index in params in which the result of the hooks must be saved, if no hooks
     *                             exist for the name, then params[acc_index] is returned.
     * @return {object} returns the result of the last hook.
     */
    jiff.execute_array_hooks = function (hook_name, params, acc_index) {
      var arr = jiff.hooks[hook_name];
      arr = (arr == null ? [] : arr);

      for (var i = 0; i < arr.length; i++) {
        params[acc_index] = arr[i].apply(jiff, params);
      }
      return params[acc_index];
    };

    /**
     * Stores the parties and callbacks for every .wait_for() registered.
     * @member {Array} wait_callbacks
     * @memberof jiff-instance
     * @instance
     */
    jiff.wait_callbacks = [];

    /**
     * Wait until the public keys of these parties are known.
     * The public keys may be known before the parties connect (if provided in the options),
     * or they could be sent by the server after the parties connect.
     * Computation specified in the callback may assume that these parties are connected,
     * if they are not, the server will handle storing and relaying the needed messages
     * to them when they connect.
     * @memberof jiff-instance
     * @instance
     * @param {Array} parties - an array of party ids to wait for.
     * @param {function(jiff-instance)} callback - the function to execute when these parties are known.
     */
    jiff.wait_for = function (parties, callback) {
      // server is always needed
      if (parties.indexOf('s1') === -1) {
        parties.push('s1');
      }

      jiff.wait_callbacks.push({parties: parties, callback: callback});
      jiff.execute_wait_callbacks(); // See if the callback can be executed immediadtly
    };

    /**
     * Executes all callbacks for which the wait condition has been satisified.
     * Remove all executed callbacks so that they would not be executed in the future.
     * @memberof jiff-instance
     * @instance
     */
    jiff.execute_wait_callbacks = function () {
      if (jiff.secret_key == null || jiff.public_key == null) {
        return;
      }

      var new_waits = [];
      for (var i = 0; i < jiff.wait_callbacks.length; i++) {
        var wait = jiff.wait_callbacks[i];
        var parties = wait.parties;
        var callback = wait.callback;

        // Check if the parties to wait for are now known
        var parties_satisified = true;
        for (var j = 0; j < parties.length; j++) {
          var party_id = parties[j];
          if (jiff.keymap == null || jiff.keymap[party_id] == null) {
            parties_satisified = false;
            break;
          }
        }

        if (parties_satisified) {
          callback(jiff);
        } else {
          new_waits.push(wait);
        }
      }

      jiff.wait_callbacks = new_waits;
    };

    /**
     * Resolves all messages that were pending because their senders primary key was previously unknown.
     * These messages are decrypted and verified and handled appropriatly before being removed from the wait queue.
     * @memberof jiff-instance
     * @instance
     */
    jiff.resolve_messages_waiting_for_keys = function () {
      for (var party_id in jiff.keymap) {
        if (!jiff.keymap.hasOwnProperty(party_id)) {
          continue;
        }

        var messageQueue = jiff.messagesWaitingKeys[party_id];
        if (messageQueue == null) {
          continue;
        }
        for (var i = 0; i < messageQueue.length; i++) {
          var msg = messageQueue[i];
          if (msg.label === 'share') {
            receive_share(jiff, party_id, msg.share, msg.op_id);
          } else if (msg.label === 'open') {
            receive_open(jiff, party_id, msg.share, msg.op_id, msg.Zp);
          } else if (msg.label === 'custom') {
            receive_custom(jiff, msg.tag, party_id, msg.message, true);
          } else {
            throw new Error('Error resolving pending message: unknown label ' + msg.label);
          }
        }

        jiff.messagesWaitingKeys[party_id] = null;
      }
    };

    /**
     * Total server count in the computation, servers will take ids between "s1" to "s<server_count>" (inclusive).
     * @member {number} server_count
     * @memberof jiff-instance
     * @instance
     */
    jiff.server_count = 1;

    /**
     * Connect to the server and starts listening.
     * @method connect
     * @memberof jiff-instance
     * @instance
     */
    jiff.connect = function () {
      // Send the computation id to the server to receive proper
      // identification
      if (options.__internal_socket == null) {
        jiff.socket.on('connect', function () {
          jiff.socket.emit('computation_id', JSON.stringify({
            computation_id: computation_id,
            party_id: jiff.id,
            party_count: jiff.party_count
          }));
        });
        jiff.socket.connect();
      } else {
        jiff.socket.emit('computation_id', JSON.stringify({
          computation_id: computation_id,
          party_id: jiff.id,
          party_count: jiff.party_count
        }));
      }
    };

    /**
     * Send a custom message to a subset of parties.
     * @memberof jiff-instance
     * @function emit
     * @instance
     * @param {string} tag - the tag to attach to the message.
     * @param {Array} receivers - contains the party ids to receive the message, all non-server parties if null.
     * @param {string} message - the message to send.
     * @param {boolean} [encrypt=true] - if true, messages will be encrypted.
     */
    jiff.emit = function (tag, receivers, message, encrypt) {
      if (typeof(message) !== 'string') {
        throw new Error('Emit: message must be a string');
      }

      if (receivers == null) {
        receivers = [];
        for (var i = 1; i <= jiff.party_count; i++) {
          receivers.push(i);
        }
      } else {
        receivers = receivers.slice();
      }

      // Remove own index from receivers
      var index = receivers.indexOf(jiff.id);
      if (index > -1) {
        receive_custom(jiff, tag, jiff.id, message, false);
      }

      for (var p = 0; p < receivers.length; p++) {
        if (receivers[p] === jiff.id) {
          continue;
        }

        var message_to_send = message;
        if (encrypt !== false) {
          message_to_send = jiff.hooks.encryptSign(message, jiff.keymap[receivers[p]], jiff.secret_key, 'custom');
          jiff.socket.safe_emit('custom', JSON.stringify({tag: tag, receiver: receivers[p], message: message_to_send, encrypted: true}));
        } else {
          jiff.socket.safe_emit('custom', JSON.stringify({tag: tag, receiver: receivers[p], message: message_to_send}));
        }
      }
    };

    /**
     * Registers the given function as a listener for messages with the given tag.
     * Removes any previously set listener for this tag.
     * @memberof jiff-instance
     * @function listen
     * @instance
     * @param {string} tag - the tag to listen for.
     * @param {function(party_id, string)} handler - the function that handles the received message: takes the sender id and the message as parameters.
     */
    jiff.listen = function (tag, handler) {
      jiff.listeners[tag] = handler;

      var stored_messages = jiff.custom_messages_mailbox[tag];
      if (stored_messages == null) {
        return;
      }

      for (var i = 0; i < stored_messages.length; i++) {
        var sender_id = stored_messages[i].sender_id;
        var message = stored_messages[i].message;
        handler(sender_id, message);
      }

      delete jiff.custom_messages_mailbox[tag];
    };

    /**
     * Removes the custom message listener attached to the given tag.
     * @param {string} tag - the tag of the listener to remove.
     */
    jiff.remove_listener = function (tag) {
      delete jiff.listeners[tag];
    };

    /**
     * Helper functions [DO NOT MODIFY UNLESS YOU KNOW WHAT YOU ARE DOING].
     * @type object
     * @memberof jiff-instance
     * @namespace helpers
     */
    jiff.helpers = {};

    /**
     * Correct Mod instead of javascript's remainder (%).
     * @memberof jiff-instance.helpers
     * @function mod
     * @instance
     * @param {number} x - the number.
     * @param {number} y - the mod.
     * @return {number} x mod y.
     */
    jiff.helpers.mod = function (x, y) {
      if (x < 0) {
        return (x % y) + y;
      }
      return x % y;
    };

    /**
     * Fast Exponentiation Mod.
     * @memberof jiff-instance.helpers
     * @function pow_mod
     * @instance
     * @param {number} a - the base number.
     * @param {number} b - the power.
     * @param {number} n - the mod.
     * @return {number} (base^pow) mod m.
     */
    jiff.helpers.pow_mod = function (a, b, n) {
      a = jiff.helpers.mod(a, n);
      var result = 1;
      var x = a;
      while (b > 0) {
        var leastSignificantBit = jiff.helpers.mod(b, 2);
        b = Math.floor(b / 2);
        if (leastSignificantBit === 1) {
          result = result * x;
          result = jiff.helpers.mod(result, n);
        }
        x = x * x;
        x = jiff.helpers.mod(x, n);
      }
      return result;
    };

    /**
     * Extended Euclidean for finding inverses.
     * @method extended_gcd
     * @memberof jiff-instance.helpers
     * @instance
     * @param {number} a - the number to find inverse for.
     * @param {number} b - the mod.
     * @return {number[]} [inverse of a mod b, coefficient for a, coefficient for b].
     */
    jiff.helpers.extended_gcd = function (a, b) {
      if (b === 0) {
        return [1, 0, a];
      }

      var temp = jiff.helpers.extended_gcd(b, jiff.helpers.mod(a, b));
      var x = temp[0];
      var y = temp[1];
      var d = temp[2];
      return [y, x - y * Math.floor(a / b), d];
    };

    /**
     * Compute Log to a given base.
     * @method bLog
     * @memberof jiff-instance.helpers
     * @instance
     * @param {number} value - the number to find log for.
     * @param {number} [base=2] - the base (2 by default).
     * @return {number} log(value) with the given base.
     */
    jiff.helpers.bLog = function (value, base) {
      if (base == null) {
        base = 2;
      }
      return Math.log(value) / Math.log(base);
    };

    /**
     * Check that two sorted arrays are equal.
     * @method array_equals
     * @memberof jiff-instance.helpers
     * @instance
     * @param {Array} arr1 - the first array.
     * @param {Array} arr2 - the second array.
     * @return {boolean} true if arr1 is equal to arr2, false otherwise.
     */
    jiff.helpers.array_equals = function (arr1, arr2) {
      if (arr1.length !== arr2.length) {
        return false;
      }

      for (var i = 0; i < arr1.length; i++) {
        if (arr1[i] !== arr2[i]) {
          return false;
        }
      }

      return true;
    };

    /**
     * Check that two Zps are equal. Used to determine if shares can be computed on or not.
     * @method Zp_equals
     * @memberof jiff-instance.helpers
     * @instance
     * @param {SecretShare} s1 - the first share.
     * @param {SecretShare} s2 - the second share.
     * @return {boolean} true both shares have the same Zp, false otherwise.
     */
    jiff.helpers.Zp_equals = function (s1, s2) {
      return s1.Zp === s2.Zp;
    };

    /**
     * Generate a random integer between 0 and max-1 [inclusive].
     * Modify this to change the source of randomness and how it is generated.
     * @method random
     * @memberof jiff-instance.helpers
     * @instance
     * @param {number} max - the maximum number.
     * @return {number} the random number.
     */
    jiff.helpers.random = function (max) {
      // Use rejection sampling to get random value within bounds
      // Generate random Uint8 values of 1 byte larger than the max parameter
      // Reject if random is larger than quotient * max (remainder would cause biased distribution), then try again
      if (max == null) {
        max = jiff.Zp;
      }
      // Values up to 2^53 should be supported, but log2(2^49) === log2(2^49+1), so we lack the precision to easily
      // determine how many bytes are required
      if (max > 562949953421312) {
        throw new RangeError('Max value should be smaller than or equal to 2^49');
      }

      var bitsNeeded = Math.ceil(jiff.helpers.bLog(max, 2));
      var bytesNeeded = Math.ceil(bitsNeeded / 8);
      var maxValue = Math.pow(256, bytesNeeded);

      // Keep trying until we find a random value within a normal distribution
      while (true) { // eslint-disable-line
        var randomBytes = crypto.__randomBytesWrapper(bytesNeeded);
        var randomValue = 0;

        for (var i = 0; i < bytesNeeded; i++) {
          randomValue = randomValue * 256 + randomBytes[i];
        }

        // randomValue should be smaller than largest multiple of max within maxBytes
        if (randomValue < maxValue - maxValue % max) {
          return randomValue % max;
        }
      }
    };

    /**
     * Get the party number from the given party_id, the number is used to compute/open shares.
     * If party id was a number (regular party), that number is returned,
     * If party id refers to the ith server, then party_count + i is returned (i > 0).
     * @memberof jiff-instance.helpers
     * @instance
     * @param {number/string} party_id - the party id from which to compute the number.
     * @return {number} the party number (> 0).
     */
    jiff.helpers.get_party_number = function (party_id) {
      if (typeof(party_id) === 'number') {
        return party_id;
      }
      if (party_id.startsWith('s')) {
        return jiff.party_count + parseInt(party_id.substring(1), 10);
      }
      return parseInt(party_id, 10);
    };

    /**
     * The function used by JIFF to create a new share. This can be used by extensions to create custom shares.
     * Modifying this will modify how shares are generated in the BASE JIFF implementation.
     * A share is a value wrapper with a share object, it has a unique id
     * (per computation instance), and a pointer to the instance it belongs to.
     * A share also has methods for performing operations.
     * @memberof jiff-instance
     * @method secret_share
     * @instance
     * @param {jiff-instance} jiff - the jiff instance.
     * @param {boolean} ready - whether the value of the share is ready or deferred.
     * @param {promise} promise - a promise to the value of the share.
     * @param {number} value - the value of the share (null if not ready).
     * @param {Array} holders - the parties that hold all the corresponding shares (must be sorted).
     * @param {number} threshold - the min number of parties needed to reconstruct the secret.
     * @param {number} Zp - the mod under which this share was created.
     * @returns {SecretShare} the secret share object containing the give value.
     *
     */
    jiff.secret_share = secret_share;

    /**
     * Share a secret input.
     * @method share
     * @memberof jiff-instance
     * @instance
     * @param {number} secret - the number to share (this party's input).
     * @param {number} [threshold=receivers_list.length] - the min number of parties needed to reconstruct the secret, defaults to all the receivers.
     * @param {Array} [receivers_list=all_parties] - array of party ids to share with, by default, this includes all parties.
     * @param {Array} [senders_list=all_parties] - array of party ids to receive from, by default, this includes all parties.
     * @param {number} [Zp=jiff_instance.Zp] - the mod (if null then the default Zp for the instance is used).
     * @param {string|number} [share_id=auto_gen()] - the tag used to tag the messages sent by this share operation, this tag is used
     *                                   so that parties distinguish messages belonging to this share operation from other
     *                                   share operations between the same parties (when the order of execution is not
     *                                   deterministic). An automatic id is generated by increasing a local counter, default
     *                                   ids suffice when all parties execute all sharing operations with the same senders
     *                                   and receivers in the same order.
     * @returns {object} a map (of size equal to the number of parties)
     *          where the key is the party id (from 1 to n)
     *          and the value is the share object that wraps
     *          the value sent from that party (the internal value maybe deferred).
     */
    jiff.share = function (secret, threshold, receivers_list, senders_list, Zp, share_id) {
      // type check to confirm the secret to be shared is a number
      // for fixed-point extension it should allow non-ints
      if (secret != null && (typeof(secret) !== 'number' || Math.floor(secret) !== secret || secret < 0)) {
        throw new Error('secret must be a non-negative whole number');
      }
      if (secret != null && (secret >= (Zp == null ? jiff.Zp : Zp))) {
        throw new Error('secret must fit inside Zp');
      }
      return jiff.internal_share(secret, threshold, receivers_list, senders_list, Zp, share_id);
    };

    /**
     * Same as jiff-instance.share, but used by internal JIFF primitives/protocols (bgw).
     */
    jiff.internal_share = function (secret, threshold, receivers_list, senders_list, Zp, share_id) {
      return jiff_share(jiff, secret, threshold, receivers_list, senders_list, Zp, share_id);
    };

    /**
     * Share an array of values. Each sender may have an array of different length. This is handled by the lengths parameter.
     * This function will reveal the lengths of the shared array.
     * If parties would like to keep the lengths of their arrays secret, they should agree on some "max" length apriori (either under MPC
     * or as part of the logistics of the computation), all their arrays should be padded to that length by using appropriate default/identity
     * values.
     * @method share_array
     * @memberof jiff-instance
     * @instance
     * @param {Array} array - the array to be shared.
     * @param {null|number|object} [lengths] - the lengths of the arrays to be shared, has the following options: <br>
     *                                       1. null: lengths are unknown, each sender will publicly reveal the lengths of its own array. <br>
     *                                       2. number: all arrays are of this length <br>
     *                                       3. object: { <sender_party_id>: length }: must specify the length of the array for each sender. <br>
     * @param {number} [threshold=receivers_list.length] - the min number of parties needed to reconstruct the secret, defaults to all the receivers.
     * @param {Array} [receivers_list=all_parties] - array of party ids to share with, by default, this includes all parties.
     * @param {Array} [senders_list=all_parties] - array of party ids to receive from, by default, this includes all parties.
     * @param {number} [Zp=jiff_instance.Zp] - the mod (if null then the default Zp for the instance is used).
     * @param {string|number} [share_id=auto_gen()] - the base tag used to tag the messages sent by this share operation, every element of the array
     *                                   will get a unique id based on the concatenation of base_share_id and the index of the element.
     *                                   This tag is used so that parties distinguish messages belonging to this share operation from
     *                                   other share operations between the same parties (when the order of execution is not
     *                                   deterministic). An automatic id is generated by increasing a local counter, default
     *                                   ids suffice when all parties execute all sharing operations with the same senders
     *                                   and receivers in the same order.
     * @returns {promise} if the calling party is a receiver then a promise to the shared arrays is returned, the promise will provide an object
     *                    formatted as follows: { <party_id>: [ <1st_share>, <2nd_share>, ..., <(lengths[party_id])th_share> ] }
     *                    where the party_ids are those of the senders.
     *                    if the calling party is not a receiver, then null is returned.
     */
    jiff.share_array = function (array, lengths, threshold, receivers_list, senders_list, Zp, share_id) {
      return jiff_share_array(jiff, array, lengths, threshold, receivers_list, senders_list, Zp, share_id);
    };

    /**
     * Share a 2D array of values. Each sender may have a 2D array of different length (possibily jagged). This is handled by the lengths parameter.
     * This function will reveal the lengths of the shared array.
     * If parties would like to keep the lengths of their arrays secret, they should agree on some "max" length apriori (either under MPC
     * or as part of the logistics of the computation), all their arrays should be padded to that length by using appropriate default/identity
     * values.
     * @method share_2D_array
     * @memberof jiff-instance
     * @instance
     * @param {Array[]} array - the 2D array to be shared.
     * @param {null|number|object} [lengths] - the lengths of the arrays to be shared. For this to work successfully, the
     *                                       same exact value must be used in the calling code for each party. Any missing
     *                                       lengths for a row will be automatically publicly revealed by this function.
     *                                       Must have the following format: <br>
     *                                       1. null: lengths are unknown, each sender will publicly reveal the lengths of its own array. <br>
     *                                       2. { rows: <number>, cols: <number>, 0: <number>, 1: <number>, ...}: all parties have arrays
     *                                          with the given number of rows and cols. In case of jagged 2D arrays, different rows
     *                                          can have a different number of cols specified by using <row_index>: <col_size>.
     *                                          rows is mandatory, cols and any other number matching a specific row are optional. <br>
     *                                       3. { <sender_party_id>: <length_object> }: must specify the lengths for each party by using
     *                                          an object with the same format as 2. Must include every party. <br>
     * @param {number} [threshold=receivers_list.length] - the min number of parties needed to reconstruct the secret, defaults to all the receivers.
     * @param {Array} [receivers_list=all_parties] - array of party ids to share with, by default, this includes all parties.
     * @param {Array} [senders_list=all_parties] - array of party ids to receive from, by default, this includes all parties.
     * @param {number} [Zp=jiff_instance.Zp] - the mod (if null then the default Zp for the instance is used).
     * @param {string|number} [share_id=auto_gen()] - the base tag used to tag the messages sent by this share operation, every element of the array
     *                                   will get a unique id based on the concatenation of base_share_id and the index of the element.
     *                                   This tag is used so that parties distinguish messages belonging to this share operation from
     *                                   other share operations between the same parties (when the order of execution is not
     *                                   deterministic). An automatic id is generated by increasing a local counter, default
     *                                   ids suffice when all parties execute all sharing operations with the same senders
     *                                   and receivers in the same order.
     * @returns {promise} if the calling party is a receiver then a promise to the shared arrays is returned, the promise will provide an object
     *                    formatted as follows: { <party_id>: [ [ <1st_row_shares> ], [<2nd_row_share> ], ..., [ <(lengths[party_id])th_row_shares> ] ] }
     *                    where the party_ids are those of the senders.
     *                    if the calling party is not a receiver, then null is returned.
     */
    jiff.share_2D_array = function (array, lengths, threshold, receivers_list, senders_list, Zp, share_id) {
      return jiff_share_2D_array(jiff, array, lengths, threshold, receivers_list, senders_list, Zp, share_id);
    };

    /**
     * Open a secret share to reconstruct secret.
     * @method open
     * @memberof jiff-instance
     * @instance
     * @param {SecretShare} share - this party's share of the secret to reconstruct.
     * @param {Array} [parties=all_parties] - an array with party ids (1 to n) of receiving parties.
     * @param {string|number|object} [op_ids=auto_gen()] - an optional mapping that specifies the ID/Tag associated with each
     *                                        open message sent.
     *                                        If this is an object, then it should map an id of a receiving parties
     *                                        to the op_id that should be used to tag the message sent to that party.
     *                                        Parties left unmapped by this object will get an automatically generated id.
     *                                        If this is a number/string, then it will be used as the id tagging all messages
     *                                        sent by this open to all parties.
     *                                        You can safely ignore this unless you have multiple opens each containing other opens.
     *                                        In that case, the order by which these opens are executed is not fully deterministic
     *                                        and depends on the order of arriving messages. In this case, use this parameter
     *                                        with every nested_open, to ensure ids are unique and define a total ordering on
     *                                        the execution of the opens (check implementation of slt for an example).
     * @returns {promise|null} a (JQuery) promise to the open value of the secret, null if the party is not specified in the parties array as a receiver.
     * @throws error if share does not belong to the passed jiff instance.
     */
    jiff.open = function (share, parties, op_ids) {
      return jiff.internal_open(share, parties, op_ids);
    };

    /**
     * Same as jiff-instance.open, but used by internal JIFF primitives/protocols (comparisons and secret multiplication).
     */
    jiff.internal_open = function (share, parties, op_ids) {
      return jiff_open(jiff, share, parties, op_ids);
    };

    /**
     * Opens an array of secret shares.
     * @method open_array
     * @memberof jiff-instance
     * @instance
     * @param {SecretShare[]} shares - an array containing this party's shares of the secrets to reconstruct.
     * @param {Array} [parties=all_parties] - an array with party ids (1 to n) of receiving parties.
     *                          This must be one of 3 cases: <br>
     *                          1. null:                       open all shares to all parties. <br>
     *                          2. array of numbers:           open all shares to all the parties specified in the array. <br>
     *                          3. array of array of numbers:  open share with index i to the parties specified
     *                                                         in the nested array at parties[i]. if parties[i] was null,
     *                                                         then shares[i] will be opened to all parties. <br>
     * @param {string|number|object} [op_ids=auto_gen()] - an optional mapping that specifies the ID/Tag associated with each
     *                                        open message sent. Since open_array involves sending many messages per party,
     *                                        this parameter only specifies the BASE OPERATION ID. Each message sent will
     *                                        have this base id attached to it concatenated to a counter.
     *                                        If this is an object, then it should map an id of a receiving parties
     *                                        to the base op_id that should be used to tag the messages sent to that party.
     *                                        Parties left unmapped by this object will get an automatically generated id.
     *                                        If this is a number/string, then it will be used as the base id tagging all messages
     *                                        sent by this open to all parties.
     *                                        You can safely ignore this unless you have multiple opens each containing other opens.
     *                                        In that case, the order by which these opens are executed is not fully deterministic
     *                                        and depends on the order of arriving messages. In this case, use this parameter
     *                                        with every nested_open, to ensure ids are unique and define a total ordering on
     *                                        the execution of the opens (check implementation of slt for an example).
     * @returns {promise} a (JQuery) promise to ALL the open values of the secret, the promise will yield
     *                    an array of values, each corresponding to the given share in the shares parameter
     *                    at the same index.
     * @throws error if some shares does not belong to the passed jiff instance.
     */
    jiff.open_array = function (shares, parties, op_ids) {
      return jiff_open_array(jiff, shares, parties, op_ids);
    };

    /**
     * Opens a 2D array of secret shares.
     * @method open_2D_array
     * @memberof jiff-instance
     * @instance
     * @param {SecretShare[][]} shares - an array containing this party's shares of the secrets to reconstruct.
     * @param {Array[]} [parties=all_parties] - an array with party ids (1 to n) of receiving parties.
     *                          This must be one of 3 cases: <br>
     *                          1. null:                       open all shares to all parties. <br>
     *                          2. { parties: [parties] }         opens all shares (all rows) to all the parties specified in the array. <br>
     *                          3. { parties: [parties], <row_index>: { parties: [ parties ids]  } }: opens all shares (all rows) to all parties
     *                                                         specified in the outer parties array, except rows with index explicitly mapped to
     *                                                         another parties ids array. default value for outer parties array is all parties. <br>
     *                          4. { parties: [parties], <row_index>: { parties: [parties ids], <col_index>: [parties] }}:
     *                                                         Gives the highest level of granularity, every element in the 2D array will
     *                                                         be opened to the parties ids arrays that match its row and col index, if no
     *                                                         such array is provided, the parties matching its row index will be used, if
     *                                                         this is not provided as well, the outer-most parties array is used, which defaults
     *                                                         to all parties. <br>
     * @param {string|number|object} [op_ids=auto_gen()] - an optional mapping that specifies the ID/Tag associated with each
     *                                        open message sent. Since open_2D_array involves sending many messages per party,
     *                                        this parameter only specifies the BASE OPERATION ID. Each message sent will
     *                                        have this base id attached to it concatenated to a counter.
     *                                        If this is an object, then it should map an id of a receiving parties
     *                                        to the base op_id that should be used to tag the messages sent to that party.
     *                                        Parties left unmapped by this object will get an automatically generated id.
     *                                        If this is a number/string, then it will be used as the base id tagging all messages
     *                                        sent by this open to all parties.
     *                                        You can safely ignore this unless you have multiple opens each containing other opens.
     *                                        In that case, the order by which these opens are executed is not fully deterministic
     *                                        and depends on the order of arriving messages. In this case, use this parameter
     *                                        with every nested_open, to ensure ids are unique and define a total ordering on
     *                                        the execution of the opens (check implementation of slt for an example).
     * @returns {promise} a (JQuery) promise to ALL the open values of the secret, the promise will yield
     *                    an array of values, each corresponding to the given share in the shares parameter
     *                    at the same index. In the case where different values are opened to different parties, the order
     *                    of the values will be preserved, but not the indices, there will be no blanks in the resulting arrays,
     *                    the first share that is opened to this party will appear at indices [0][0], even if it was not initially
     *                    at [0][0].
     * @throws error if some shares does not belong to the passed jiff instance.
     */
    jiff.open_2D_array = function (shares, parties, op_ids) {
      var i;

      // Compute operation ids (one for each party that will receive a result
      if (op_ids == null) {
        op_ids = {};
      }

      // A base operation id is provided to use for all opens.
      if (typeof(op_ids) === 'string' || typeof(op_ids) === 'number') {
        var tmp = { s1: op_ids };
        for (i = 1; i <= jiff.party_count; i++) {
          tmp[i] = op_ids;
        }
        op_ids = tmp;
      }

      // figure out parties
      if (parties == null) {
        parties = { parties: [] };
        for (i = 1; i <= jiff.party_count; i++) {
          parties.parties.push(i);
        }
      }

      var promises = [];
      for (i = 0; i < shares.length; i++) {
        var row = shares[i];

        // figure out receivers
        var receivers = [];
        for (var j = 0; j < shares[i].length; j++) {
          receivers[j] = parties.parties; // default
          if (parties[i] != null && parties[i].parties != null) {
            receivers[j] = parties[i].parties; // row default
          }
          if (parties[i] != null && parties[i][j] != null) {
            receivers[j] = parties[i][j]; // row + col specific
          }
        }

        // figure out op_ids
        var row_op_ids = {};
        for (var p = 1; p <= jiff.party_count; p++) {
          row_op_ids[p] = op_ids[p];
          if (row_op_ids[p] != null) {
            row_op_ids[p] += ':row' + i;
          }
        }

        // share
        var promise = jiff.open_array(row, receivers, row_op_ids);
        if (promise != null) {
          promises.push(promise);
        }
      }

      if (promises.length === 0) {
        return null;
      }

      return Promise.all(promises);
    }

    /**
     * Receive shares from the specified parties and reconstruct their secret.
     * Use this function in a party that will receive some answer/value but does not have a share of it.
     * @method receive_open
     * @memberof jiff-instance
     * @instance
     * @param {Array} [parties=all_parties] - an array with party ids (1 to n) specifying the parties sending the shares.
     * @param {number} [threshold=parties.length] - the min number of parties needed to reconstruct the secret, defaults to all the senders.
     * @param {number} [Zp=jiff_instance.Zp] - the mod (if null then the default Zp for the instance is used).
     * @param {string|number|object} [op_ids=auto_Gen()] - same as jiff-instance.open(..)
     * @returns {promise} a (JQuery) promise to the open value of the secret.
     */
    jiff.receive_open = function (parties, threshold, Zp, op_ids) {
      if (Zp == null) {
        Zp = jiff.Zp;
      }
      return jiff_open(jiff, jiff.secret_share(jiff, true, null, null, parties, (threshold == null ? parties.length : threshold), Zp), [jiff.id], op_ids);
    };

    /**
     * Creates 3 shares, a share for every one of three numbers from a beaver triplet.
     * The server generates and sends the triplets on demand.
     * @method triplet
     * @memberof jiff-instance
     * @instance
     * @param {Array} [receivers_list=all_parties] - array of party ids that want to receive the triplet shares, by default, this includes all parties.
     * @param {number} [threshold=receivers_list.length] - the min number of parties needed to reconstruct the triplet.
     * @param {number} [Zp=jiff_instance.Zp] - the mod (if null then the default Zp for the instance is used).
     * @param {string} [triplet_id=auto_Gen()] - the triplet id which is used to identify the triplet requested, so that every party
     *                              gets a share from the same triplet for every matching instruction. An automatic triplet id
     *                              is generated by increasing a local counter, default ids suffice when all parties execute the
     *                              instructions in the same order.
     * @returns an array of 3 SecretShares [share_a, share_b, share_c] such that a * b = c.
     */
    jiff.triplet = function (receivers_list, threshold, Zp, triplet_id) {
      return jiff_triplet(jiff, receivers_list, threshold, Zp, triplet_id);
    };


    /**
     * Use the server to generate shares for a random bit, zero, random non-zero number, or a random number.
     * The parties will not know the value of the number (unless the request is for shares of zero) nor other parties' shares.
     * @method server_generate_and_share
     * @memberof jiff-instance
     * @instance
     * @param {object} [options={count: 1}] - an object with these properties:
     *                           { "number": number, "bit": boolean, "nonzero": boolean, "max": number, "count": number }
     * @param {Array} [receivers_list=all_parties] - array of party ids that want to receive the triplet shares, by default, this includes all parties.
     * @param {number} [threshold=receivers_list.length] - the min number of parties needed to reconstruct the triplet.
     * @param {number} [Zp=jiff_instance.Zp] - the mod (if null then the default Zp for the instance is used).
     * @param {string} [number_id=auto_gen()] - the number id which is used to identify this request, so that every party
     *                             gets a share from the same number for every matching instruction. An automatic number id
     *                             is generated by increasing a local counter, default ids suffice when all parties execute the
     *                             instructions in the same order.
     * @returns {SecretShare[]} an array of secret shares of shares of zeros / random bits / random numbers / random non-zero numbers according to options.
     */
    jiff.server_generate_and_share = function (options, receivers_list, threshold, Zp, number_id) {
      return jiff_server_share_number(jiff, options, receivers_list, threshold, Zp, number_id)
    };

    /**
     * A collection of useful protocols to be used during computation or preprocessing: extensions are encouraged to add useful
     * common protocols here, under a sub namespace corresponding to the extension name.
     * @memberof jiff-instance
     * @namespace protocols
     */
    jiff.protocols = {};

    /**
     * Creates shares of an unknown random number. Every party comes up with its own random number and shares it.
     * Then every party combines all the received shares to construct one share of the random unknown number.
     * @method generate_and_share_random
     * @memberof jiff-instance.protocols
     * @instance
     * @param {number} [threshold=receivers_list.length] - the min number of parties needed to reconstruct the secret, defaults to all the receivers.
     * @param {Array} [receivers_list=all_parties] - array of party ids to share with, by default, this includes all parties.
     * @param {Array} [senders_list=all_parties] - array of party ids to receive from, by default, this includes all parties.
     * @param {number} [Zp=jiff-instance.Zp] - the mod.
     * @param {string|number} [share_id=auto_gen()] - the tag used to tag the messages sent by this share operation, this tag is used
     *                                   so that parties distinguish messages belonging to this share operation from other
     *                                   share operations between the same parties (when the order of execution is not
     *                                   deterministic). An automatic id is generated by increasing a local counter, default
     *                                   ids suffice when all parties execute all sharing operations with the same senders
     *                                   and receivers in the same order.
     * @returns {SecretShare} a secret share of the random number, null if this party is not a receiver.
     */
    jiff.protocols.generate_and_share_random = function (threshold, receivers_list, senders_list, Zp, share_id) {
      return jiff_share_all_number(jiff, jiff.helpers.random(Zp), threshold, receivers_list, senders_list, Zp, share_id);
    };

    /**
     * Creates shares of 0, such that no party knows the other parties' shares.
     * Every party secret shares 0, then every party sums all the shares they received, resulting
     * in a new share of 0 for every party.
     * @method generate_and_share_zero
     * @memberof jiff-instance.protocols
     * @instance
     * @param {number} [threshold=receivers_list.length] - the min number of parties needed to reconstruct the secret, defaults to all the receivers.
     * @param {Array} [receivers_list=all_parties] - array of party ids to share with, by default, this includes all parties.
     * @param {Array} [senders_list=all_parties] - array of party ids to receive from, by default, this includes all parties.
     * @param {number} [Zp=jiff-instance.Zp] - the mod.
     * @param {string|number} [share_id=auto_gen()] - the tag used to tag the messages sent by this share operation, this tag is used
     *                                   so that parties distinguish messages belonging to this share operation from other
     *                                   share operations between the same parties (when the order of execution is not
     *                                   deterministic). An automatic id is generated by increasing a local counter, default
     *                                   ids suffice when all parties execute all sharing operations with the same senders
     *                                   and receivers in the same order.
     * @returns {SecretShare} a secret share of zero, null if this party is not a receiver.
     */
    jiff.protocols.generate_and_share_zero = function (threshold, receivers_list, senders_list, Zp, share_id) {
      return jiff_share_all_number(jiff, 0, threshold, receivers_list, senders_list, Zp, share_id);
    };

    /**
     * generation of beaver triplet via MPC, uses the server for communication channels, but not for generation.
     * @method generate_beaver_bgw
     * @param {number} [compute_threshold=floor(compute_list.length+1/2)] - the threshold used during beaver generation.
     * @param {Array} [compute_list=all_parties] - array of party ids that will perform this protocol, by default, this includes all parties.
     * @param {number} [receiving_threshold=receivers_list.length] - the threshold of the triplets when stored by receivers after generation.
     * @param {Array} [receivers_list=all_parties] - array of party ids that want to receive the triplet shares, by default, this includes all parties.
     * @param {number} [Zp=jiff-instance.Zp] - the mod (if null then the default Zp for the instance is used).
     * @param {string} [op_id=auto_gen()] - the operation id which is used to identify this operation.
     *                         This id must be unique, and must be passed by all parties to the same instruction, to
     *                         ensure that corresponding instructions across different parties are matched correctly.
     * @return {SecretShare[]} array of this party's shares of the resulting triplet, a,b,c such that a*b=c.
     * @memberof jiff.protocols
     */
    jiff.protocols.generate_beaver_bgw = function (compute_threshold, compute_list, receiving_threshold, receivers_list, Zp, op_id) {
      if (op_id == null) {
        op_id = jiff.counters.gen_op_id('beaver_bgw', receivers_list);
      }
      if (Zp == null) {
        Zp = jiff.Zp;
      }
      if (receivers_list == null) {
        receivers_list = [];
        for (var r = 1; r <= jiff.party_count; r++) {
          receivers_list.push(r);
        }
      }
      if (compute_list == null) {
        compute_list = [];
        for (var p = 1; p <= jiff.party_count; p++) {
          compute_list.push(p);
        }
      }
      if (receiving_threshold == null) {
        receiving_threshold = receivers_list.length;
      }
      if (compute_threshold == null) {
        compute_threshold = Math.floor((compute_list.length + 1) / 2);
      }
      if (compute_threshold > (compute_list.length + 1) / 2) {
        throw new Error('generate_beaver_bgw: compute threshold too high for bgw');
      }

      var a = jiff.protocols.generate_and_share_random(compute_threshold, compute_list, compute_list, Zp, op_id+':share_a');
      var b = jiff.protocols.generate_and_share_random(compute_threshold, compute_list, compute_list, Zp, op_id+':share_b');
      var c = a.smult_bgw(b, op_id+':smult_bgw');

      // TODO: transfer a, b, c to receiving_list and change their thresholds to receiving_threshold.
      return [a, b, c];
    };

    /**
     * generates a random bit under MPC by xoring all bits sent by participating parties
     * @method generate_random_bit
     * @memberof jiff-instance.protocols
     * @instance
     * @param {number} [compute_threshold=compute_list.length] - the threshold used during bit generation.
     * @param {Array} [compute_list=all_parties] - array of party ids that will perform this protocol, by default, this includes all parties.
     * @param {number} [receiving_threshold=receivers_list.length] - the threshold of the bit when stored by receivers after generation.
     * @param {Array} [receivers_list=all_parties] - array of party ids that want to receive the triplet shares, by default, this includes all parties.
     * @param {number} [Zp=jiff-instance.Zp] - the mod (if null then the default Zp for the instance is used).
     * @param {string} [op_id=auto_gen()] - the operation id which is used to identify this operation.
     *                         This id must be unique, and must be passed by all parties to the same instruction, to
     *                         ensure that corresponding instructions across different parties are matched correctly.
     * @return {SecretShare} this party's share of the generated bit
     *
     */
    jiff.protocols.generate_random_bit = function (compute_threshold, compute_list, receiving_threshold, receivers_list, Zp, op_id) {
      if (op_id == null) {
        op_id = jiff.counters.gen_op_id('random_bit', receivers_list);
      }
      if (Zp == null) {
        Zp = jiff.Zp;
      }
      if (receivers_list == null) {
        receivers_list = [];
        for (var r = 1; r <= jiff.party_count; r++) {
          receivers_list.push(r);
        }
      }
      if (compute_list == null) {
        compute_list = [];
        for (var p = 1; p <= jiff.party_count; p++) {
          compute_list.push(p);
        }
      }
      if (receiving_threshold == null) {
        receiving_threshold = receivers_list.length;
      }
      if (compute_threshold == null) {
        compute_threshold = compute_list.length;
      }

      var bit = jiff.helpers.random(2);
      var bit_shares = jiff.internal_share(bit, compute_threshold, compute_list, compute_list, Zp, op_id + ':share');

      var random_bit = bit_shares[compute_list[0]];
      for (var i = 1; i < compute_list.length; i++) {
        var party_id = compute_list[i];
        random_bit = random_bit.sxor_bit(bit_shares[party_id], op_id + ':xor' + i);
      }

      // TODO: transfer random_bit to receiving_list and change its thresholds to receiving_threshold.
      return random_bit;
    };


    /**
     * Creates a secret share of the number represented by the given array of secret shared bits.
     * Requires no communication, only local operations.
     * @method bit_composition
     * @memberof jiff-instance.protocols
     * @instance
     * @param {SecretShare[]} bits - an array of the secret shares of bits, starting from least to most significant bits.
     * @returns {SecretShare} a secret share of the number represented by bits.
     */
    jiff.protocols.bit_composition = function (bits) {
      var result = bits[0];
      var pow = 1;
      for (var i = 1; i < bits.length; i++) {
        pow = pow * 2;
        result = result.isadd(bits[i].icmult(pow));
      }
      return result;
    };


    /**
     * Checks whether given constant is less than given SecretShared bits.
     * Requires l-1 rounds of communication (a total of l-1 multiplications in sequence) where l is the length of secret_bits.
     * @method clt_bits
     * @memberof jiff-instance.protocols
     * @instance
     * @param {number} constant - the constant number to check if less than bits.
     * @param {SecretShare[]} bits - an array of the secret shares of bits, starting from least to most significant bits.
     * @param {string} [op_id=<auto-generate-id>] - the base operation id to use when generating unique ids for multiplications.
     *                                              default value should suffice when the code of all parties executes all instructions
     *                                              in the same exact order, otherwise, a unique base name is needed here.
     * @returns {SecretShare} a secret share of 1 if constant < (bits)_2, otherwise a secret share of 0.
     */
    jiff.protocols.clt_bits = function (constant, bits, op_id) {
      if (op_id == null) {
        // Generate base operation id if needed.
        op_id = jiff.counters.gen_op_id('c<bits', bits[0].holders);
      }

      // Decompose result into bits
      constant = constant.toString(2);

      var constant_bits = [];
      for (var i = 0; i < constant.length; i++) {
        constant_bits[i] = parseInt(constant.charAt(constant.length - 1 - i));
      }
      while (constant_bits.length < bits.length) {
        constant_bits.push(0);
      }

      // XOR
      var c = [];
      for (i = 0; i < constant_bits.length; i++) {
        c[i] = bits[i].icxor_bit(constant_bits[i]);
      }

      // PrefixOR
      var d = [];
      d[c.length - 1] = c[c.length - 1];
      for (i = c.length - 2; i >= 0; i--) {
        d[i] = d[i + 1].isor_bit(c[i], op_id + ':sOR:' + i);
      }

      var e = [];
      e[d.length - 1] = d[d.length - 1];
      for (i = d.length - 2; i >= 0; i--) {
        e[i] = d[i].issub(d[i + 1]);
      }

      var isNotEqual = e[0];
      var isGreaterThan = e[0].icmult(constant_bits[0]);
      for (i = 1; i < e.length; i++) {
        isGreaterThan = isGreaterThan.isadd(e[i].icmult(constant_bits[i]));
        isNotEqual = isNotEqual.isadd(e[i]);
      }

      return isNotEqual.inot().isadd(isGreaterThan).inot();
    };

    /**
     * Starts a new barrier, all promises and secret shares created between this call and the corresponding start_barrier
     * call will be part of this barrier. start_barrier may be called before previous barriers are resolved, in which
     * case promises / secret shares created will be part of the new barrier as well as any previous barriers.
     * @returns {number} a barrier id that identifies this barrier.
     */
    jiff.start_barrier = function () {
      jiff.barriers.push([]);
      return jiff.barriers.length - 1;
    };

    /**
     * Adds given promise to all active barriers.
     * @param {promise} promise - the promise to add.
     */
    jiff.add_to_barriers = function (promise) {
      for (var i = 0; i < jiff.barriers.length; i++) {
        jiff.barriers[i].push(promise);
      }
    }

    /**
     * Executes the callback only after all promises / secret shares in the barrier were resolved.
     * @param {function()} [callback] - the callback to execute.
     * @param {number} [barrier_id=jiff.barriers.length - 1] - identifies the barrier, should be returned by start_barrier.
     *                                                         by default, barrier_id will refer to the last barrier.
     * @returns {promise} a promise that resolves after the secret shares are resolved and the callback is executed (if provided).
     */
    jiff.end_barrier = function (callback, barrier_id) {
      var barrier;
      if (barrier_id == null) {
        barrier = jiff.barriers.pop();
      } else {
        barrier = jiff.barriers[barrier_id];
        jiff.barriers.splice(barrier_id, 1);
      }

      var promise = Promise.all(barrier);
      if (callback != null) {
        promise = promise.then(callback);
      }
      return promise;
    }


    /**
     * Disconnects from the computation.
     * Allows the client program to exit.
     * @method disconnect
     * @memberof jiff-instance
     * @instance
     * @param {boolean} [safe=false] - if true, jiff will disconnect safely (i.e. after ensuring all
     *                                 outgoing pending messages were delivered).
     * @param {boolean} [free=false] - if set to true, it means this party's disconnection is final, and all resources
     *                                 associated with this party must be freed.
     *                                 If all parties in a computation are freed, then all resources associated with the
     *                                 computation are freed, and any subsequent reconnection to the computation is as
     *                                 if a the connection is for a fresh new computation.
     * @param {function()} [callback] - executed after the instance safely disconnects, if safe is set to false, this
     *                                  parameter is ignored.
     */
    jiff.disconnect = function (safe, free, callback) {
      if (safe) {
        jiff.socket.safe_disconnect(free, callback);
        if (jiff.triplets_socket !== jiff.socket) {
          jiff.triplets_socket.safe_disconnect(free);
        }
        if (jiff.numbers_socket !== jiff.socket) {
          jiff.numbers_socket.safe_disconnect(free);
        }
      } else {
        if (free) {
          jiff.socket.emit('free', '');
        }
        jiff.socket.disconnect();
        if (jiff.triplets_socket !== jiff.socket) {
          if (free) {
            jiff.triplets_socket.emit('free', '');
          }
          jiff.triplets_socket.disconnect();
        }
        if (jiff.numbers_socket !== jiff.socket) {
          if (free) {
            jiff.numbers_socket.emit('free', '');
          }
          jiff.numbers_socket.disconnect();
        }
      }
    };

    // Store the id when server sends it back
    jiff.socket.on('init', function (msg) {
      sodium_promise.then(function () {
        msg = JSON.parse(msg);
        if (jiff.id == null) {
          jiff.id = msg.party_id;
        }

        if (jiff.party_count == null) {
          jiff.party_count = msg.party_count;
        }

        if (jiff.secret_key == null || jiff.public_key == null) {
          // eslint-disable-next-line no-undef
          var genkey = sodium.crypto_box_keypair(); // this party's public and secret key
          jiff.secret_key = genkey.privateKey;
          jiff.public_key = genkey.publicKey;
        }


        jiff.socket.emit('public_key', '[' + jiff.public_key.toString() + ']');
        // Now: (1) this party is connect (2) server (and other parties) know this public key
        // Resend all pending messages
        jiff.socket.resend_mailbox();

        jiff.execute_wait_callbacks();
      });
    });

    jiff.socket.on('public_key', function (msg) {
      sodium_promise.then(function () {
        jiff.keymap = JSON.parse(msg);

        var i;
        for (i in jiff.keymap) {
          if (jiff.keymap.hasOwnProperty(i)) {
            jiff.keymap[i] = new Uint8Array(JSON.parse(jiff.keymap[i]));
          }
        }

        // Resolve any pending messages that were received before the sender's public key was known
        jiff.resolve_messages_waiting_for_keys();

        // Resolve any pending waits that have satisfied conditions
        jiff.execute_wait_callbacks();

        // Check if all keys have been received
        if (jiff.keymap['s1'] == null) {
          return;
        }
        for (i = 1; i <= jiff.party_count; i++) {
          if (jiff.keymap[i] == null) {
            return;
          }
        }

        // check if all parties are connected
        if (jiff.__ready !== true) {
          jiff.__ready = true;
          if (options.onConnect != null) {
            options.onConnect(jiff);
          }
        }
      });
    });

    // Store sharing and shares counter which keeps track of the count of
    // sharing operations (share and open) and the total number of shares
    // respectively (used to get a unique id for each share operation and
    // share object).
    jiff.counters = {};
    jiff.counters.share_op_count = {};
    jiff.counters.open_op_count = {};
    jiff.counters.triplet_op_count = {};
    jiff.counters.number_op_count = {};
    jiff.counters.op_count = {};
    jiff.counters.share_obj_count = 0;
    jiff.counters.pending_opens = 0; // Keeps track of pending opens to disconnect safely.

    //stores a seed for generating unique op_ids.
    jiff.op_id_seed = '';

    /**
     * Shorthand for generating unique operation ids.
     * All primitives called after this seed will use their usual default ids prefixed by the seed.
     * Helpful when we have nested callbacks/functions (e.g. share_arrays) that may be executed in arbitrary order,
     * using this function as a the first call inside such callbacks with an appropriate deterministic unique base_op_id
     * ensures that regardless of the order of execution, operations in the same callback are matched correctly across
     * all parties.
     * Check out demos/graph-pip/mpc.js for an example on using this.
     * @param {string|number} base_op_id - the base seed to use as a prefix for all future op_ids.
     */
    jiff.seed_ids = function (base_op_id) {
      if (base_op_id == null || base_op_id === '') {
        jiff.op_id_seed = '';
      } else {
        jiff.op_id_seed = base_op_id.toString() + ':';
      }
    };

    /**
     * Generate an op_id for an open operation between the holders of a share and a receiver.
     * The returned op_id will be unique with respect to other operations, and identifies the same
     * operation/instruction for all parties, as long as all parties are executing instructions in the same order.
     * Notice: the order of elements in both receviers and senders should be the same across all parties, preferrably
     *    these two arrays should be sorted before passing them to this function.
     * @param {Array} receivers - an array containing the ids of all the receivers in this share operation).
     * @param {Array} senders - an array containing the ids of all the senders in this share operation).
     * @return {string} - the share_id for the share.
     */
    jiff.counters.gen_share_id = function (receivers, senders) {
      var label = receivers.join(',') + ':' + senders.join(',');
      if (jiff.counters.share_op_count[label] == null) {
        jiff.counters.share_op_count[label] = 0;
      }
      return jiff.op_id_seed + 'share:' + label + ':' + (jiff.counters.share_op_count[label]++);
    };

    /**
     * Generate an op_id for an open operation between the holders of a share and a receiver.
     * The returned op_id will be unique with respect to other operations, and identifies the same
     * operation/instruction for all parties, as long as all parties are executing instructions in the same order.
     * @param {string|number} receiver - party id of receiver.
     * @param {string} holders_string - a string representation of holders (e.g. comma-separted and sorted list of holders ids).
     * @return {string} - the op_id for the open.
     */
    jiff.counters.gen_open_id = function (receiver, holders_string) {
      var label = receiver + ':' + holders_string;
      if (jiff.counters.open_op_count[label] == null) {
        jiff.counters.open_op_count[label] = 0;
      }
      return jiff.op_id_seed + 'open:' + label + ':' + (jiff.counters.open_op_count[label]++);
    };

    /**
     * Generate a new unique triplet id for a triplet to be shared between holders.
     * The returned triplet_id will be unique with respect to other operations, and identifies the same
     * triplet for all parties, as long as all parties are executing instructions in the same order.
     * @param {Array} holders - an array containing the ids of all the holders of the triplet.
     * @return {string} - the op_id for the open.
     */
    jiff.counters.gen_triplet_id = function (holders) {
      var label = holders.join(',');
      if (jiff.counters.triplet_op_count[label] == null) {
        jiff.counters.triplet_op_count[label] = 0;
      }
      return jiff.op_id_seed + 'triplet:' + label + ':' + (jiff.counters.triplet_op_count[label]++);
    };

    /**
     * Generate a new unique number id for a number to be shared between holders.
     * The returned number_id will be unique with respect to other operations, and identifies the same
     * triplet for all parties, as long as all parties are executing instructions in the same order.
     * @param {Array} holders - an array containing the ids of all the holders of the triplet.
     * @return {string} - the op_id for the open.
     */
    jiff.counters.gen_number_id = function (holders) {
      var label = holders.join(',');
      if (jiff.counters.number_op_count[label] == null) {
        jiff.counters.number_op_count[label] = 0;
      }
      return jiff.op_id_seed + 'number:' + label + ':' + (jiff.counters.number_op_count[label]++);
    };

    /**
     * Generate a unique id for a new share object, these ids are used for debugging and logging
     * and have no requirements beyond being unique (per party). Parties may assign different ideas
     * to matching shares due to having a different order of exeuction of instructions, or receiving
     * messages at different times.
     * @return {string} - a unique (per party) id for a new secret share object.
     */
    jiff.counters.gen_share_obj_id = function () {
      return jiff.op_id_seed + 'share' + (jiff.counters.share_obj_count++);
    };

    /**
     * Generate a unique operation id for a new operation object.
     * The returned op_id will be unique with respect to other operations, and identifies the same
     * operation across all parties, as long as all parties are executing instructions in the same order.
     * @param {string} op - the type/name of operation performed.
     * @param {Array} holders - an array containing the ids of all the parties carrying out the operation.
     * @return {string} - the op_id for the open.
     */
    jiff.counters.gen_op_id = function (op, holders) {
      var label = holders.join(',');
      if (jiff.counters.op_count[label] == null) {
        jiff.counters.op_count[label] = 0;
      }
      return jiff.op_id_seed + op + ':' + label + ':' + (jiff.counters.op_count[label]++);
    };

    // For logging / debugging
    jiff.logs = [];

    // Store a map from a sharing id (which share operation) to the
    // corresponding deferred and shares array.
    jiff.shares = {}; // Stores receive shares for open purposes.
    jiff.deferreds = {}; // Stores deferred that are resolved when required messages arrive.

    // Setup receiving matching shares
    jiff.socket.on('share', function (msg, callback) {
      callback(true); // send ack to server

      // parse message
      var json_msg = JSON.parse(msg);
      var sender_id = json_msg['party_id'];
      var op_id = json_msg['op_id'];
      var share = json_msg['share'];

      if (jiff.keymap[sender_id] != null) {
        receive_share(jiff, sender_id, share, op_id);
      } else {
        if (jiff.messagesWaitingKeys[sender_id] == null) {
          jiff.messagesWaitingKeys[sender_id] = [];
        }
        jiff.messagesWaitingKeys[sender_id].push({label: 'share', op_id: op_id, share: share});
      }
    });

    jiff.socket.on('open', function (msg, callback) {
      callback(true); // send ack to server

      // parse message
      var json_msg = JSON.parse(msg);

      var sender_id = json_msg['party_id'];
      var op_id = json_msg['op_id'];
      var share = json_msg['share'];
      var Zp = json_msg['Zp'];

      if (jiff.keymap[sender_id] != null) {
        receive_open(jiff, sender_id, share, op_id, Zp);
      } else {
        if (jiff.messagesWaitingKeys[sender_id] == null) {
          jiff.messagesWaitingKeys[sender_id] = [];
        }
        jiff.messagesWaitingKeys[sender_id].push({label: 'open', op_id: op_id, share: share, Zp: Zp});
      }
    });

    // handle custom messages
    jiff.socket.on('custom', function (msg, callback) {
      callback(true); // send ack to server

      var json_msg = JSON.parse(msg);

      var sender_id = json_msg['party_id'];
      var tag = json_msg['tag'];
      var message = json_msg['message'];
      var encrypted = json_msg['encrypted'];

      if (jiff.keymap[sender_id] != null || encrypted !== true) {
        receive_custom(jiff, tag, sender_id, message, encrypted);
      } else {
        // key must not exist yet for sender_id, and encrypted must be true
        if (jiff.messagesWaitingKeys[sender_id] == null) {
          jiff.messagesWaitingKeys[sender_id] = [];
        }
        jiff.messagesWaitingKeys[sender_id].push({label: 'custom', tag: tag, message: message });
      }
    });

    jiff.triplets_socket.on('triplet', function (msg, callback) {
      callback(true); // send ack to server

      if (jiff.id !== 's1' || (options.triplets_server != null && options.triplets_server !== hostname)) {
        // decrypt and verify message signature
        msg = jiff.hooks.decryptSign(msg, jiff.secret_key, jiff.keymap['s1'], 'triplet');
      }

      // parse message
      var json_msg = JSON.parse(msg);
      var triplet = json_msg['triplet'];
      var triplet_id = json_msg['triplet_id'];

      receive_triplet(jiff, triplet_id, triplet);
    });

    jiff.numbers_socket.on('number', function (msg, callback) {
      callback(true); // send ack to server

      if (jiff.id !== 's1' || (options.numbers_server != null && options.numbers_server !== hostname)) {
        // decrypt and verify message signature
        msg = jiff.hooks.decryptSign(msg, jiff.secret_key, jiff.keymap['s1'], 'number');
      }

      // parse message
      var json_msg = JSON.parse(msg); // this is an array of { "number": {value}, "number_id": {string} }
      receive_server_share_number(jiff, json_msg);
    });

    jiff.socket.on('error', function (msg) {
      if (options.onError != null) {
        options.onError(msg);
      }
    });

    jiff.socket.on('disconnect', function (reason) {
      if (reason !== 'io client disconnect') {
        // check that the reason is an error and not a user initiated disconnect
        console.log('Disconnected! ' + reason);
      }
    });

    // Connect when all is done
    if (!(options.autoConnect === false)) {
      jiff.connect();
    }

    return jiff;
  }

  // Exported API
  exports.make_jiff = make_jiff;

  /**
   * Contains utility functions that may be useful outside of the instance code.
   * @memberof jiff
   * @type {object}
   * @namespace jiff.utils
   */
  exports.utils = {
    encrypt_and_sign: encrypt_and_sign,
    decrypt_and_sign: decrypt_and_sign
  };

  /**
   * Contains builtin sharing schemes provided by jiff.
   * @memberof jiff
   * @type {object}
   * @namespace jiff.sharing_schemes
   */
  exports.sharing_schemes = {
    shamir_share: jiff_compute_shares,
    shamir_reconstruct: jiff_lagrange
  };
}((typeof exports === 'undefined' ? this.jiff = {} : exports), typeof exports !== 'undefined'));
