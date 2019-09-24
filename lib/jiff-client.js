/**
 * The exposed API from jiff-client.js (The client side library of JIFF).
 * Wraps the jiff API. Internal members can be accessed with jiff.&lt;member-name&gt;.
 * @namespace jiff
 * @version 1.0
 */
(function (exports, node) {
  var crypto_, io_, sodium_;
  if (node) {
    io_ = require('socket.io-client');
    sodium_ = require('libsodium-wrappers');

    crypto_ = require('crypto');
    crypto_.__randomBytesWrapper = crypto_.randomBytes;
  } else { // Browser: sodium (and other dependencies) should be available in global scope from including sodium.js
    io_ = window.io;
    sodium_ = window.sodium;

    crypto_ = window.crypto || window.msCrypto;
    crypto_.__randomBytesWrapper = function (bytesNeeded) {
      var randomBytes = new Uint8Array(bytesNeeded);
      crypto_.getRandomValues(randomBytes);
      return randomBytes;
    };
  }

  /**
   * Provides the needed dependencies in case where they are not global variable (e.g. using AMD define)
   * @memberof jiff
   * @function dependencies
   * @param {object} dependencies - contains any of these two attributes: "io", "sodium"
   *                                unprovided dependencies will be expected to exist as global variables
   *                                in the browser, or are fetched using require() in node.
   */
  exports.dependencies = function (dependencies) {
    io_ = dependencies['io'] != null ? dependencies['io'] : io_;
    sodium_ = dependencies['sodium'] != null ? dependencies['sodium'] : sodium_;
  };

  /**
   * The default mod to be used in a jiff instance if a custom mod was not provided.
   */
  var gZp = 15485867;

  /** Return the maximum of two numbers */
  function max(x, y) {
    return x > y ? x : y;
  }

  /**
   * Check that an integer is prime. Used to safely set the modulus Zp.
   * @memberof jiff.utils
   * @param {number} p - the prime number candidate.
   * @returns {boolean} true if p is prime, false otherwise.
   */
  function is_prime(p) {
    // AKS Primality Test

    if (p === 2) {
      return true;
    } else if (p === 3) {
      return true;
    } else if (p % 2 === 0) {
      return false;
    } else if (p % 3 === 0) {
      return false;
    }

    var i = 5;
    var n = 2;
    while (i * i <= p) {
      if (p % i === 0) {
        return false;
      }
      i += n;
      n = 6 - n;
    }

    return true;
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
      var node = { object: obj, next: null, previous: null };
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

      if (prev == null && list.head !== ptr) {
        return;
      } else if (next == null && list.tail !== ptr) {
        return;
      }

      if (prev == null) { // ptr is head (or both head and tail)
        list.head = next;
        if (list.head != null) {
          list.head.previous = null;
        } else {
          list.tail = null;
        }
      } else if (next == null) { // ptr is tail (and not head)
        list.tail = prev;
        prev.next = null;
      } else { // ptr is inside
        prev.next = next;
        next.previous = prev;
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
   * @returns {object} the signed cipher, includes two properties: 'cipher' and 'nonce'.
   */
  function encrypt_and_sign(jiff, message, encryption_public_key, signing_private_key) {
    var nonce = sodium_.randombytes_buf(sodium_.crypto_box_NONCEBYTES);
    var cipher = sodium_.crypto_box_easy(message, nonce, encryption_public_key, signing_private_key);

    var result = { nonce: '[' + nonce.toString() + ']', cipher: '[' + cipher.toString() + ']' };
    return result;
  }

  /**
   * Decrypts and checks the signature of the given cipher text.
   * @memberof jiff.utils
   * @param {object} cipher_text - the cipher text to decrypt, includes two properties: 'cipher' and 'nonce'.
   * @param {Uint8Array} decryption_secret_key - the secret key to decrypt with.
   * @param {Uint8Array} signing_public_key - ascii-armored public key to verify against signature.
   * @returns {number/string} the decrypted message if the signature was correct, the decrypted message type should
   *                          the type of operation, such that the returned value has the appropriate type and does
   *                          not need any type modifications.
   * @throws error if signature or nonce was forged/incorrect.
   */
  function decrypt_and_sign(jiff, cipher_text, decryption_secret_key, signing_public_key) {
    var nonce = new Uint8Array(JSON.parse(cipher_text.nonce));
    cipher_text = new Uint8Array(JSON.parse(cipher_text.cipher));

    try {
      return sodium_.crypto_box_open_easy(cipher_text, nonce, signing_public_key, decryption_secret_key, 'text');
    } catch (_) {
      throw new Error('Bad signature or Bad nonce: Cipher: ' + cipher_text + '.  DecSKey: ' + decryption_secret_key + '.  SignPKey: ' + signing_public_key);
    }
  }

  /**
   * Create an array of secret shares and associated deferred.
   * @param {jiff-instance} jiff - the jiff instance.
   * @param {number} count - number of secret shares.
   * @param {Array} holders - the parties that hold all the corresponding shares (must be sorted).
   * @param {number} threshold - the min number of parties needed to reconstruct the secret.
   * @param {number} Zp - the mod under which this share was created.
   * @return {object} the secret share object containing the give value.
   *
   */
  function many_secret_shares(jiff, count, holders, threshold, Zp) {
    var deferreds = [];
    var shares = [];
    for (var i = 0; i < count; i++) {
      var deferred = new jiff.helpers.Deferred;
      shares.push(jiff.secret_share(jiff, false, deferred.promise, undefined, holders, threshold, Zp));
      deferreds.push(deferred);
    }

    return { shares: shares, deferreds: deferreds };
  }

  /**
   * Resolve the array of deferreds with the values of the given shares when ready, matched by index.
   * @param {Deferred[]} deferreds - the deferred to resolve.
   * @param {SecretShare[]} shares - the shares to resolve with.
   */
  function resolve_many_secrets(deferreds, shares) {
    for (var i = 0; i < deferreds.length; i++) {
      shares[i].wThen(deferreds[i].resolve);
    }
  }

  /**
   * A high level combinator for iteration of bit arrays.
   * It executes a round of (func) starting from index 0 to the length.
   * Every round is blocked until the previous one finishes and the promise produced by it
   * is resolved.
   * The final value is used to resolve deferred.
   */
  function bit_combinator(deferred, start, length, initial, func, promisify, valufy) {
    if (promisify == null) {
      promisify = function (share) {
        return { then: share.wThen };
      }
    }

    if (valufy == null) {
      valufy = function (share) {
        return share.value;
      }
    }

    var next = start <= length ? 1 : -1;
    var __bit_combinator = function (start, val) {
      if (start === length) {
        // done
        deferred.resolve(valufy(val));
        return;
      }

      // execute func once
      val = func(start, val);

      // when done, do next iteration
      promisify(val).then(function () {
        __bit_combinator(start + next, val);
      });
    };

    // start combinator
    if (initial == null) {
      __bit_combinator(start, initial);
    } else {
      promisify(initial).then(function () {
        __bit_combinator(start, initial);
      });
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
    if (share_id == null) {
      share_id = jiff.counters.gen_op_id2('share', receivers_list, senders_list);
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
        var msg = { party_id: p_id, share: shares[p_id], op_id: share_id };
        msg = jiff.execute_array_hooks('beforeOperation', [jiff, 'share', msg], 2);

        msg['share'] = jiff.hooks.encryptSign(jiff, msg['share'].toString(10), jiff.keymap[msg['party_id']], jiff.secret_key);
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

      var _remaining = senders_list.length;
      for (i = 0; i < senders_list.length; i++) {
        p_id = senders_list[i];
        if (p_id === jiff.id) { // Keep party's own share
          var my_share = jiff.execute_array_hooks('receiveShare', [jiff, p_id, shares[p_id]], 2);
          result[p_id] = jiff.secret_share(jiff, true, null, my_share, receivers_list, threshold, Zp);
          _remaining--;
          continue;
        }

        // check if a deferred is set up (maybe the message was previously received)
        if (jiff.deferreds[share_id][p_id] == null) { // not ready, setup a deferred
          jiff.deferreds[share_id][p_id] = new jiff.helpers.Deferred;
        }

        var promise = jiff.deferreds[share_id][p_id].promise;
        // destroy deferred when done
        (function (promise, p_id) { // p_id is modified in a for loop, must do this to avoid scoping issues.
          promise.then(function () {
            delete jiff.deferreds[share_id][p_id];
            _remaining--;
            if (_remaining === 0) {
              delete jiff.deferreds[share_id];
            }
          });
        })(promise, p_id);

        // receive share_i[id] from party p_id
        result[p_id] = jiff.secret_share(jiff, false, promise, undefined, receivers_list, threshold, Zp);
      }
    }

    return result;
  }

  /**
   * Default way of computing shares (can be overridden using hooks).
   * Compute the shares of the secret (as many shares as parties) using Shamir secret sharing
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
   * @param {object} json_msg - the parsed json message as received.
   *
   */
  function receive_share(jiff, json_msg) {
    // Decrypt share
    json_msg['share'] = jiff.hooks.decryptSign(jiff, json_msg['share'], jiff.secret_key, jiff.keymap[json_msg['party_id']]);
    json_msg = jiff.execute_array_hooks('afterOperation', [jiff, 'share', json_msg], 2);

    var sender_id = json_msg['party_id'];
    var op_id = json_msg['op_id'];
    var share = json_msg['share'];

    // Call hook
    share = jiff.execute_array_hooks('receiveShare', [jiff, sender_id, share], 2);

    // check if a deferred is set up (maybe the share was received early)
    if (jiff.deferreds[op_id] == null) {
      jiff.deferreds[op_id] = {};
    }
    if (jiff.deferreds[op_id][sender_id] == null) {
      // Share is received before deferred was setup, store it.
      jiff.deferreds[op_id][sender_id] = new jiff.helpers.Deferred;
    }

    // Deferred is already setup, resolve it.
    jiff.deferreds[op_id][sender_id].resolve(share);
  }

  /**
   * Open up the given share to the participating parties.
   * @param {jiff-instance} jiff - the jiff instance.
   * @param {SecretShare} share - the share of the secret to open that belongs to this party.
   * @param {Array<number|string>} [parties=all_parties] - an array with party ids of receiving parties.
   * @param {string|number} [op_id=auto_gen()] - the operation id to be used to tag outgoing messages.
   * @returns {promise} a (JQuery) promise to the open value of the secret, null if the calling party is not a receiving party.
   * @throws error if share does not belong to the passed jiff instance.
   *
   */
  function jiff_open(jiff, share, parties, op_id) {
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
    }

    // If not a receiver nor holder, do nothing
    if (share.holders.indexOf(jiff.id) === -1 && parties.indexOf(jiff.id) === -1) {
      return null;
    }

    // Compute operation ids (one for each party that will receive a result
    if (op_id == null) {
      op_id = jiff.counters.gen_op_id2('open', parties, share.holders);
    }

    // Party is a holder
    if (share.holders.indexOf(jiff.id) > -1) {
      // Call hook
      share = jiff.execute_array_hooks('beforeOpen', [jiff, share, parties], 1);

      // refresh/reshare, so that the original share remains secret, instead
      // a new share is sent/open without changing the actual value.
      share = share.refresh(op_id + ':refresh');

      // The given share has been computed, broadcast it to all parties
      jiff.counters.pending_opens++;
      share.wThen(function () {
        jiff_broadcast(jiff, share, parties, op_id);
        jiff.counters.pending_opens--;
      }, share.error);
    }

    // Party is a receiver
    if (parties.indexOf(jiff.id) > -1) {
      var final_deferred = new jiff.helpers.Deferred; // will be resolved when the final value is reconstructed
      var final_promise = final_deferred.promise;

      if (jiff.deferreds[op_id] == null) {
        jiff.deferreds[op_id] = {};
      }

      jiff.deferreds[op_id].deferred = final_deferred;
      jiff.deferreds[op_id].threshold = share.threshold;
      jiff.deferreds[op_id].total = share.holders.length;
      if (jiff.deferreds[op_id].shares != null && jiff.deferreds[op_id].shares.length >= share.threshold) {
        final_deferred.resolve();
      }

      return final_promise.then(function () {
        var shares = jiff.deferreds[op_id].shares;

        if (shares.length === jiff.deferreds[op_id].total) {
          delete jiff.deferreds[op_id];
        } else {
          jiff.deferreds[op_id].deferred = 'CLEAN';
        }

        var recons_secret = jiff.hooks.reconstructShare(jiff, shares);
        recons_secret = jiff.execute_array_hooks('afterReconstructShare', [jiff, recons_secret], 1);
        return recons_secret;
      });
    }

    return null;
  }

  /**
   * Share the given share to all the parties in the jiff instance.
   * @param {jiff-instance} jiff - the jiff instance.
   * @param {SecretShare} share - the share.
   * @param {Array} parties - the parties to broadcast the share to.
   * @param {number|string} op_id - a unique operation id, used to tag outgoing messages.
   *
   */
  function jiff_broadcast(jiff, share, parties, op_id) {
    for (var index = 0; index < parties.length; index++) {
      var i = parties[index]; // Party id
      if (i === jiff.id) {
        receive_open(jiff, { party_id: i, share: share.value, op_id: op_id, Zp: share.Zp });
        continue;
      }

      // encrypt, sign and send
      var msg = {party_id: i, share: share.value, op_id: op_id, Zp: share.Zp};
      msg = jiff.execute_array_hooks('beforeOperation', [jiff, 'open', msg], 2);

      msg['share'] = jiff.hooks.encryptSign(jiff, msg['share'].toString(), jiff.keymap[msg['party_id']], jiff.secret_key);
      jiff.socket.safe_emit('open', JSON.stringify(msg));
    }
  }

  /**
   * Resolves the deferred corresponding to operation_id and sender_id.
   * @param {jiff-instance} jiff - the jiff instance.
   * @param {object} json_msg - the json message as received with the open event.
   *
   */
  function receive_open(jiff, json_msg) {
    // Decrypt share
    if (json_msg['party_id'] !== jiff.id) {
      json_msg['share'] = jiff.hooks.decryptSign(jiff, json_msg['share'], jiff.secret_key, jiff.keymap[json_msg['party_id']]);
      json_msg = jiff.execute_array_hooks('afterOperation', [jiff, 'open', json_msg], 2);
    }

    var sender_id = json_msg['party_id'];
    var op_id = json_msg['op_id'];
    var share = json_msg['share'];
    var Zp = json_msg['Zp'];

    // call hook
    share = jiff.execute_array_hooks('receiveOpen', [jiff, sender_id, share, Zp], 2);

    // Ensure deferred is setup
    if (jiff.deferreds[op_id] == null) {
      jiff.deferreds[op_id] = {};
    }
    if (jiff.deferreds[op_id].shares == null) {
      jiff.deferreds[op_id].shares = [];
    }

    // Accumulate received shares
    jiff.deferreds[op_id].shares.push({value: share, sender_id: sender_id, Zp: Zp});

    // Resolve when ready
    if (jiff.deferreds[op_id].shares.length === jiff.deferreds[op_id].threshold) {
      jiff.deferreds[op_id].deferred.resolve();
    }

    // Clean up if done
    if (jiff.deferreds[op_id] != null && jiff.deferreds[op_id].deferred === 'CLEAN' && jiff.deferreds[op_id].shares.length === jiff.deferreds[op_id].total) {
      delete jiff.deferreds[op_id];
    }
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
   * Requests secret(s) from the server (crypto provider) of type matching the given label.
   * @param {jiff-instance} jiff - the jiff instance.
   * @param {string} label - the type of secret(s) being requested from crypto_provider (e.g. triplet, bit, etc)
   * @param {Array} [receivers_list=all_parties] - array of party ids that want to receive the secret(s), by default, this includes all parties.
   * @param {number} [threshold=receivers_list.length] - the min number of parties needed to reconstruct the secret(s).
   * @param {number} [Zp=jiff_instance.Zp] - the mod, defaults to the Zp of the instance.
   * @param {string} [op_id=auto_Gen()] - an id which is used to identify the secret requested, so that every party
   *                              gets a share from the same secret for every matching instruction. An automatic id
   *                              is generated by increasing a local counter per label, default ids suffice when all
   *                              parties execute all instructions in the same order.
   * @param {object} [params={}] - any additional parameters specific to the label, these are defined by the label handler at the server side.
   *                               some of these parameters may be optional, while others may be required.
   * @returns {promise} a promise to the secret(s) provided by the server/crypto provider, the promise returns an object with the given format:
   *                               { values: <any values returned by the server side>, shares: <array of secret share objects matching shares returned by server by index>}
   */
  function from_crypto_provider(jiff, label, receivers_list, threshold, Zp, op_id, params) {
    // defaults
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
    if (op_id == null) {
      op_id = jiff.counters.gen_op_id('crypto_provider:' + label, receivers_list);
    }
    if (params == null) {
      params = {};
    }

    // Send a request to the server
    var msg = { label: label, op_id: op_id, receivers: receivers_list, threshold: threshold, Zp: Zp, params: params };
    msg = jiff.execute_array_hooks('beforeOperation', [jiff, 'crypto_provider', msg], 2);
    msg = JSON.stringify(msg);

    // Setup deferred to handle receiving the result later.
    jiff.deferreds[op_id] = new jiff.helpers.Deferred;
    var result = jiff.deferreds[op_id].promise;

    // send a request to the server.
    jiff.socket.safe_emit('crypto_provider', msg);
    return result;
  }

  /**
   * Parse server response and resolve associated promise.
   * @param {jiff-instance} jiff - the jiff instance.
   * @param {object} json_msg - the parsed json message as received by the crypto_provider event, contains 'values' and 'shares' attributes.
   *
   */
  function receive_crypto_provider(jiff, json_msg) {
    // Hook
    json_msg = jiff.execute_array_hooks('afterOperation', [jiff, 'crypto_provider', json_msg], 2);

    var op_id = json_msg['op_id'];
    if (jiff.deferreds[op_id] == null) {
      return;
    }

    // parse msg
    var receivers_list = json_msg['receivers'];
    var threshold = json_msg['threshold'];
    var Zp = json_msg['Zp'];

    // construct secret share objects
    var result = {};
    if (json_msg['values'] != null) {
      result.values = json_msg['values'];
    }
    if (json_msg['shares'] != null) {
      result.shares = [];
      for (var i = 0; i < json_msg['shares'].length; i++) {
        result.shares.push(jiff.secret_share(jiff, true, null, json_msg['shares'][i], receivers_list, threshold, Zp));
      }
    }

    // resolve deferred
    jiff.deferreds[op_id].resolve(result);
    delete jiff.deferreds[op_id];
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
   * @param {Array} [receivers_list=all_parties] - array of party ids to receive the result, by default, this includes all parties.
   * @param {Array} [compute_list=all_parties] - array of party ids to perform the protocol, by default, this includes all parties.
   * @param {number} [Zp=jiff.Zp] - the mod.
   * @param {object} [params={}] - an object containing extra parameters passed by the user.
   *                                 Expects:
   *                               - op_id: the base id to use for operation during the execution of this protocol, defaults to auto generated.
   *                               - compute_threshold: the threshold to use during computation: defaults to compute_list.length
   * @return {Object} contains 'share' (this party's share of the result) and 'promise'.
   */
  function jiff_share_all_number(jiff, n, threshold, receivers_list, compute_list, Zp, params) {
    var isSender = compute_list.indexOf(jiff.id) > -1;
    var isReceiver = receivers_list.indexOf(jiff.id) > -1;

    if (!isSender && !isReceiver) {
      return {};
    }

    if (params.compute_threshold == null) {
      params.compute_threshold = Math.min(threshold, compute_list.length);
    }

    var result, promise;
    if (isSender) {
      var shares = jiff.internal_share(n, params.compute_threshold, compute_list, compute_list, Zp, params.op_id + ':share');
      result = shares[compute_list[0]];
      for (var i = 1; i < compute_list.length; i++) {
        result = result.isadd(shares[compute_list[i]]);
      }
      promise = result.promise;
    }

    result = jiff.protocols.reshare(result, threshold, receivers_list, compute_list, Zp, params.op_id + ':reshare');
    if (receivers_list.indexOf(jiff.id) > -1) {
      promise = result.promise;
    }

    return {share: result, promise: promise};
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
    if (share_id == null) {
      share_id = jiff.counters.gen_op_id2('share_2D_array', receivers_list, senders_list);
    }

    // wrap around result of share_array
    var lengths_deferred = new jiff.helpers.Deferred;
    var lengths_promise = lengths_deferred.promise;

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
    var share_array_deferred = new jiff.helpers.Deferred;
    var share_array_promise = share_array_deferred.promise;

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

  /**
   * Called when this party receives a custom tag message from any party (including itself).
   * If a custom listener was setup to listen to the tag, the message is passed to the listener.
   * Otherwise, the message is stored until such a listener is provided.
   * @param {jiff-instance} jiff - the jiff instance.
   * @param {object} json_msg - the parsed json message as received by the custom event.
   *
   */
  function receive_custom(jiff, json_msg) {
    if (json_msg['encrypted'] === true) {
      json_msg['message'] = jiff.hooks.decryptSign(jiff, json_msg['message'], jiff.secret_key, jiff.keymap[json_msg['party_id']]);
    }

    if (json_msg['party_id'] !== jiff.id) {
      json_msg = jiff.execute_array_hooks('afterOperation', [jiff, 'custom', json_msg], 2);
    }

    var sender_id = json_msg['party_id'];
    var tag = json_msg['tag'];
    var message = json_msg['message'];

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
   * @return {SecretShare} the secret share object containing the give value.
   *
   */
  function secret_share(jiff, ready, promise, value, holders, threshold, Zp) {
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
      var val = self.ready ? self.value : '<deferred>';
      return 'share: ' + val + '. Holders: ' + JSON.stringify(self.holders) + '. Threshold: ' + self.threshold + '. Zp: ' + self.Zp.toString() + '.';
    };

    /**
     * Logs an error.
     * @method error
     * @memberof SecretShare
     * @instance
     */
    self.error = self.jiff.error.bind(null, 'secret-share');

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
      var promise = self.open(parties, tag);
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
      if (op_id == null) {
        op_id = self.jiff.counters.gen_op_id('refresh', self.holders);
      }

      // final result
      var final_deferred = new self.jiff.helpers.Deferred;
      var final_promise = final_deferred.promise;
      var result = self.jiff.secret_share(self.jiff, false, final_promise, undefined, self.holders, self.threshold, self.Zp);

      // refresh
      var ready_number = function (zero) {
        self.isadd(zero).wThen(final_deferred.resolve);
      };

      // get shares of zero
      var zero = self.jiff.get_preprocessing(op_id);
      if (zero == null) {
        var promise = self.jiff.from_crypto_provider('numbers', self.holders, self.threshold, self.Zp, op_id, {number: 0, count: 1});
        promise.then(function (msg) {
          ready_number(msg['shares'][0]);
        });
      } else {
        ready_number(zero);
      }

      return result;
    };

    /**
     * Shortcut for opening/revealing the value of this share. Alias for open in jiff-instance.
     * @see jiff-instance#open
     * @method open
     * @memberof SecretShare
     * @instance
     * @param {Array} [parties=all_parties] - an array with party ids (1 to n) of receiving parties.
     * @param {string|number|object} [op_id=auto_gen()] - same as jiff_instance.open
     * @returns {promise|null} a (JQuery) promise to the open value of the secret, null if the party is not specified in the parties array as a receiver.
     */
    self.open = function (parties, op_id) {
      return self.jiff.open(self, parties, op_id);
    };

    /**
     * Generic Addition.
     * Uses either the constant or secret version of this operator depending on type of paramter.
     * @method add
     * @param {number|SecretShare} o - the other operand (can be either number or share).
     * @return {SecretShare} this party's share of the result.
     * @memberof SecretShare
     * @instance
     * @example
     * var shares = jiff_instance.share(input);
     * // this will add two secret shared values together
     * var result = shares[1].add(shares[2]);
     * // this will add 3 to the secret input from party 1
     * var constant_sum = shares[1].add(3);
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
     *
     * @example
     * // share a value with all parties, and sum the values of all shares
     * var shares = jiff_instance.share(x);
     * var sum = shares[1];
     * for (var i = 2; i <= jiff_instance.party_count; i++) {
     *  sum = sum.sadd(shares[i]);
     * }
     *
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
        op_id = self.jiff.counters.gen_op_id('smult', self.holders);
      }

      // final result
      var final_deferred = new self.jiff.helpers.Deferred;
      var final_promise = final_deferred.promise;
      var result = self.jiff.secret_share(self.jiff, false, final_promise, undefined, self.holders, max(self.threshold, o.threshold), self.Zp);

      // called when triplet is ready
      var ready_triplet = function (triplet) {
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

          final_result.wThen(final_deferred.resolve);
        });
      };

      // Get shares of triplets.
      var triplet = self.jiff.get_preprocessing(op_id + ':triplet');
      if (triplet == null) {
        var promise = jiff.from_crypto_provider('triplet', self.holders, max(self.threshold, o.threshold), self.Zp, op_id + ':triplet');
        promise.then(function (msg) {
          ready_triplet(msg['shares']);
        });
      } else {
        ready_triplet(triplet);
      }

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
        op_id = self.jiff.counters.gen_op_id('smult_bgw', self.holders);
      }

      var new_threshold = (self.threshold - 1) + (o.threshold - 1) + 1;
      if (new_threshold > self.holders) {
        var errorMsg = 'Threshold too large for smult_bgw: ' + new_threshold;
        errorMsg += '. Shares: ' + self.toString() + ', ' + o.toString();
        throw new Error(errorMsg);
      }

      var final_deferred = new self.jiff.helpers.Deferred;
      var final_promise = final_deferred.promise;
      var result = self.jiff.secret_share(self.jiff, false, final_promise, undefined, self.holders, new_threshold, self.Zp);

      Promise.all([self.promise, o.promise]).then(
        function () {
          // Get Shares  of z
          var zi = self.jiff.helpers.mod(share_helpers['*'](self.value, o.value), self.Zp);
          final_deferred.resolve(zi);
        });

      return self.jiff.protocols.reshare(result, max(self.threshold, o.threshold), result.holders, result.holders, result.Zp, op_id + ':threshold');
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
      if (op_id == null) {
        op_id = self.jiff.counters.gen_op_id('sxor_bit', self.holders);
      }

      return self.isadd(o).issub(self.ismult(o, op_id + ':smult1').icmult(2));
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
      if (op_id == null) {
        op_id = self.jiff.counters.gen_op_id('sor_bit', self.holders);
      }

      return self.isadd(o).issub(self.ismult(o, op_id + ':smult1'));
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
        op_id = self.jiff.counters.gen_op_id('sgteq',self.holders);
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
        op_id = self.jiff.counters.gen_op_id('sgt', self.holders);
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
        op_id = self.jiff.counters.gen_op_id('slteq', self.holders);
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
        op_id = self.jiff.counters.gen_op_id('slt', self.holders);
      }

      var final_deferred = new self.jiff.helpers.Deferred;
      var final_promise = final_deferred.promise;
      var result = self.jiff.secret_share(self.jiff, false, final_promise, undefined, self.holders, max(self.threshold, o.threshold), self.Zp);

      var w = self.ilt_halfprime(op_id + ':halfprime:1');
      Promise.all([w.promise]).then(function () {
        var x = o.ilt_halfprime(op_id + ':halfprime:2');
        Promise.all([x.promise]).then(function () {
          var y = self.issub(o).ilt_halfprime(op_id + ':halfprime:3');
          Promise.all([y.promise]).then(function () {
            var xy = x.ismult(y, op_id + ':smult1');
            var answer = x.icmult(-1).icadd(1).issub(y).isadd(xy).isadd(w.ismult(x.isadd(y).issub(xy.icmult(2)), op_id + ':smult2'));
            answer.wThen(final_deferred.resolve);
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
        op_id = self.jiff.counters.gen_op_id('cgteq', self.holders);
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
        op_id = self.jiff.counters.gen_op_id('cgt', self.holders);
      }

      var final_deferred = new self.jiff.helpers.Deferred;
      var final_promise = final_deferred.promise;
      var result = self.jiff.secret_share(self.jiff, false, final_promise, undefined, self.holders, self.threshold, self.Zp);

      var w = share_helpers['<'](cst, share_helpers['/'](self.Zp, 2)) ? 1 : 0;
      var x = self.ilt_halfprime(op_id + ':halfprime:1');
      Promise.all([x.promise]).then(function () {
        var y = self.icmult(-1).icadd(cst).ilt_halfprime(op_id + ':halfprime:2');
        Promise.all([y.promise]).then(function () {
          var xy = y.ismult(x, op_id + ':smult1');
          var answer = x.icmult(-1).icadd(1).issub(y).isadd(xy).isadd(x.isadd(y).issub(xy.icmult(2)).icmult(w));
          answer.wThen(final_deferred.resolve);
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
        op_id = self.jiff.counters.gen_op_id('clteq', self.holders);
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
        op_id = self.jiff.counters.gen_op_id('clt', self.holders);
      }

      var final_deferred = new self.jiff.helpers.Deferred;
      var final_promise = final_deferred.promise;
      var result = self.jiff.secret_share(self.jiff, false, final_promise, undefined, self.holders, self.threshold, self.Zp);

      var w = self.ilt_halfprime(op_id + ':halfprime:1');
      Promise.all([w.promise]).then(function () {
        var x = share_helpers['<'](cst, share_helpers['/'](self.Zp, 2)) ? 1 : 0;
        var y = self.icsub(cst).ilt_halfprime(op_id + ':halfprime:2');
        Promise.all([y.promise]).then(function () {
          var xy = y.icmult(x);
          var answer = y.icmult(-1).icadd(1 - x).isadd(xy).isadd(w.ismult(y.icadd(x).issub(xy.icmult(2)), op_id + ':smult1'));
          answer.wThen(final_deferred.resolve);
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
        op_id = self.jiff.counters.gen_op_id('seq', self.holders);
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
      if (op_id == null) {
        op_id = self.jiff.counters.gen_op_id('sneq', self.holders);
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
        op_id = self.jiff.counters.gen_op_id('ceq', self.holders);
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
      if (op_id == null) {
        op_id = self.jiff.counters.gen_op_id('cneq', self.holders);
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
        op_id = self.jiff.counters.gen_op_id('sdiv', self.holders);
      }

      var lZp = share_helpers['ceil'](self.jiff.helpers.bLog(self.Zp, 2));
      if (l == null) {
        l = lZp;
      } else {
        l = l < lZp ? l : lZp;
      }

      // Convert to bits
      var dividend_bits = self.bit_decomposition(op_id + ':decomposition1').slice(0, l);
      var divisor_bits = o.bit_decomposition(op_id + ':decomposition2').slice(0, l);

      // Compute by long division
      var quotient_bits = self.jiff.protocols.bits.sdiv(dividend_bits, divisor_bits, op_id + ':bits.sdiv').quotient;
      var quotient = self.jiff.protocols.bits.bit_composition(quotient_bits);
      return quotient;
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
        op_id = self.jiff.counters.gen_op_id('cdiv', self.holders);
      }

      // Allocate share for result to which the answer will be resolved once available
      var final_deferred = new self.jiff.helpers.Deferred;
      var final_promise = final_deferred.promise;
      var result = self.jiff.secret_share(self.jiff, false, final_promise, undefined, self.holders, self.threshold, self.Zp);

      // Execute protocol when random in noise in [0, Zp) and quotient floor(noise/constant) is ready!
      var ready_quotient = function (noise, nOVERc) {
        // Use noise
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
          answer.wThen(final_deferred.resolve);
        });
      };

      // Preprocessing cases
      var quotient = self.jiff.get_preprocessing(op_id + ':quotient');
      if (quotient == null) { // case 1: no preprocessing with crypto provider!
        var promise = self.jiff.from_crypto_provider('quotient', self.holders, self.threshold, self.Zp, op_id + ':quotient', {constant: cst});
        promise.then(function (msg) {
          ready_quotient(msg['shares'][0], msg['shares'][1]);
        });
      } else if (quotient.ondemand === true) { // case 2: constant was not available at preprocessing time, must do it now!
        var ondemand = self.jiff.protocols.generate_random_and_quotient(threshold, self.holders, self.holders, self.Zp, {
          op_id: op_id + ':quotient',
          constant: cst,
          ondemand: true
        });
        ondemand.promise.then(function () {
          ready_quotient(ondemand.share.r, ondemand.share.q);
        });
      } else { // case 3: preprocessing is completed!
        ready_quotient(quotient.r, quotient.q);
      }

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
        op_id = self.jiff.counters.gen_op_id('smod', self.holders);
      }

      var lZp = share_helpers['ceil'](self.jiff.helpers.bLog(self.Zp, 2));
      if (l == null) {
        l = lZp;
      } else {
        l = l < lZp ? l : lZp;
      }

      // Convert to bits
      var dividend_bits = self.bit_decomposition(op_id + ':decomposition1').slice(0, l);
      var divisor_bits = o.bit_decomposition(op_id + ':decomposition2').slice(0, l);

      // Compute by long division
      var remainder_bits = self.jiff.protocols.bits.sdiv(dividend_bits, divisor_bits, op_id + ':bits.sdiv').remainder;
      var remainder = self.jiff.protocols.bits.bit_composition(remainder_bits);
      return remainder;
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
        op_id = self.jiff.counters.gen_op_id('lt_halfprime', self.holders);
      }

      // if share is even, then self is less than half the prime, otherwise, share is greater than half the prime
      var share = self.icmult(2);

      // to check if share is even, we will use pre-shared bits as some form of a bit mask
      var bitLength = share_helpers['ceil'](self.jiff.helpers.bLog(share.Zp, 2));

      // Create result share
      var final_deferred = new self.jiff.helpers.Deferred;
      var final_promise = final_deferred.promise;
      var result = self.jiff.secret_share(self.jiff, false, final_promise, undefined, self.holders, self.threshold, self.Zp);

      // Execute protocol when randomly sampled bit-wise random number is ready
      var ready_sampling = function (bits) {
        // if 2*self is even, then self is less than half prime, otherwise self is greater or equal to half prime
        if (bits.length !== bitLength) {
          throw new Error('Preprocessed bits sequence has incorrect length, expected: ' + bitLength + ' actual: ' + bits.length);
        }

        // bit composition: r = (rl ... r1 r0)_10
        var r = self.jiff.protocols.bits.bit_composition(bits);
        // open share + noise, and utilize opened value with shared bit representation of noise to check the least significant digit of share.
        share.jiff.internal_open(r.isadd(share), share.holders, op_id + ':open').then(function (result) {
          var wrapped = self.jiff.protocols.bits.cgt(bits, result, op_id + ':bits.cgt');
          var isOdd = self.jiff.helpers.mod(result, 2);
          isOdd = bits[0].icxor_bit(isOdd);
          isOdd = isOdd.isxor_bit(wrapped, op_id + ':sxor_bit');

          var answer = isOdd.inot();
          answer.wThen(final_deferred.resolve);
        });
      };

      // generate the bits of a random number less than our prime
      var bits = self.jiff.get_preprocessing(op_id + ':sampling');
      if (bits == null) {
        var promise = self.jiff.from_crypto_provider('numbers', self.holders, self.threshold, self.Zp, op_id + ':sampling', {bitLength: bitLength, count: 1, max: self.Zp});
        promise.then(function (msg) {
          ready_sampling(msg['shares']);
        });
      } else {
        ready_sampling(bits);
      }

      return result;
    };

    /**
     * Bit Decomposition: Transform existing share to an array of bit shares.
     * @method bit_decomposition
     * @memberof SecretShare
     * @instance
     * @param {string} [op_id=auto_gen()] - the operation id which is used to identify this operation.
     *                         This id must be unique, and must be passed by all parties to the same instruction, to
     *                         ensure that corresponding instructions across different parties are matched correctly.
     * @returns {SecretShare[]} an array of secret shares of bits of length [ceil(self.Zp)], where
     *   index 0 represents the least significant bit.
     */
    self.bit_decomposition = function (op_id) {
      if (op_id == null) {
        op_id = self.jiff.counters.gen_op_id('bit_decomposition', self.holders);
      }

      var bitLength = self.Zp.toString(2).length;

      // Create deferred shares to resolve to later when the computation completes
      var many_shares = many_secret_shares(jiff, bitLength, self.holders, self.threshold, self.Zp);
      var deferreds = many_shares.deferreds;
      var result = many_shares.shares;

      // Execute protocol when randomly sampled bit-wise random number is ready
      var ready_sampling = function (bits) {
        var r = self.jiff.protocols.bits.bit_composition(bits);
        // add and reveal random number to self
        self.jiff.internal_open(r.isadd(self), self.holders, op_id + ':open').then(function (result) {
          // compute bits assuming r+self < Zp
          var noWrap = self.jiff.protocols.bits.csubr(result, bits, op_id + ':bits.csubr:1');
          var didWrap = noWrap.pop();

          // compute bits assuming r+self >= Zp
          var withWrap = self.jiff.protocols.bits.csubr(share_helpers['+'](result, self.Zp), bits, op_id + ':bits.csubr:2');
          withWrap.pop(); // withWrap cannot underflow!

          // choose noWrap if first subtraction does not overflow (sign bit is zero), otherwise choose withWrap.
          for (var i = 0; i < bitLength; i++) {
            withWrap[i] = didWrap.iif_else(withWrap[i], noWrap[i], op_id + ':if_else:' + i);
          }
          resolve_many_secrets(deferreds, withWrap);
        });
      };

      // generate the bits of a random number less than our prime
      var bits = self.jiff.get_preprocessing(op_id + ':sampling');
      if (bits == null) {
        var promise = self.jiff.from_crypto_provider('numbers', self.holders, self.threshold, self.Zp, op_id + ':sampling', {bitLength: bitLength, count: 1, max: self.Zp});
        promise.then(function (msg) {
          ready_sampling(msg['shares']);
        });
      } else {
        ready_sampling(bits);
      }

      return result;
    };

    /**
     * Simulate an oblivious If-else statement with a single return value.
     * Should be called on a secret share of a bit: 0 representing false, and 1 representing true
     * If this is a share of 1, a new sharing of the element represented by the first parameter is returned,
     * otherwise, a new sharing of the second is returned.
     * @method if_else
     * @memberof SecretShare
     * @instance
     * @param {SecretShare|constant} trueVal - the value/share to return if this is a sharing of 1.
     * @param {SecretShare|constant} falseVal - the value/share to return if this is a sharing of 0.
     * @param {string} [op_id=auto_gen()] - the operation id which is used to identify this operation.
     *                         This id must be unique, and must be passed by all parties to the same instruction, to
     *                         ensure that corresponding instructions across different parties are matched correctly.
     * @return {SecretShare} a new sharing of the result of the if.
     *
     * @example
     * // a and b are secret shares
     * // cmp will be a secret share of either 1 or 0, depending on whether a or b is greater
     * var cmp = a.gt(b);
     *
     * // max is set to the greater value, without revealing the value or the result of the inequality
     * var max = cmp.if_else(a, b);
     */
    self.if_else = function (trueVal, falseVal, op_id) {
      if (op_id == null) {
        op_id = self.jiff.counters.gen_op_id('if_else', self.holders);
      }

      var const1 = self.isConstant(trueVal);
      var const2 = self.isConstant(falseVal);
      if (const1 && const2) {
        return self.icmult(trueVal).isadd(self.inot().icmult(falseVal));
      } else if (const1) {
        return self.inot().ismult(falseVal.icsub(trueVal), op_id + ':smult').icadd(trueVal);
      } else if (const2) {
        return self.ismult(trueVal.icsub(falseVal), op_id + ':smult').icadd(falseVal);
      } else {
        return self.ismult(trueVal.issub(falseVal), op_id + ':smult').isadd(falseVal);
      }
    };

    // when the promise is resolved, acquire the value of the share and set ready to true
    if (!ready) {
      self.promise.then(self.receive_share, self.error);
      self.jiff.add_to_barriers(self.promise);
    }

    /**
     * Wrapper around share.promise.then
     * In case share is ready (its promise is resolved and cleared)
     * The callback is executed immediately.
     * Does not support chaining.
     * @method wThen
     * @memberof SecretShare
     * @instance
     * @param {function} onFulfilled - callback for success, called with self.value as parameter.
     * @param {function} [onRejected] - callback for errors.
     */
    self.wThen = function (onFulfilled, onRejected) {
      if (self.value != null) {
        onFulfilled(self.value);
      } else {
        if (onRejected == null) {
          onRejected = self.error;
        }
        self.promise.then(onFulfilled, onRejected);
      }
    };

    // internal variant of primitives, to use internally by other primitives
    var internals = ['cadd', 'csub', 'cmult', 'sadd', 'ssub', 'smult', 'smult_bgw',
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
       "party_id": number,
       "party_count": number,
       "secret_key": Uint8Array to be used with libsodium-wrappers [(check Library Specs)]{@link https://download.libsodium.org/doc/public-key_cryptography/authenticated_encryption.html},
       "public_key": Uint8Array to be used with libsodium-wrappers [(check Library Specs)]{@link https://download.libsodium.org/doc/public-key_cryptography/authenticated_encryption.html},
       "public_keys": { 1: "Uint8Array PublicKey", 2: "Uint8Array PublicKey", ... },
       "Zp": default mod to use (prime number),
       "autoConnect": true/false,
       "hooks": { 'check out <a href="hooks.html">hooks documentation</a>' },
       "listeners" : A map from custom tags to listeners (of type function(sender_id, message_string)) that handle custom messages with that tag.
       "onConnect": function(jiff_instance),
       "onError": function(label, error): called when errors occured in client code or during handling requests from this client at the server side
                                          label is a string indicating where the error occured, and error is a string or an exception object.
       "safemod": boolean (whether or not to check if provided Zp is prime, may be slow for big primes, defaults to false),
       "crypto_provider": a boolean that flags whether to get beaver triplets and other preprocessing entities from the server (defaults to false),
       "socketOptions": an object, passed directly to socket.io constructor,
       "maxInitializationRetries": how many consecutive times to retry to initialize with the server if initialization fails, defaults to 2.
     }
     </pre>
   *
   * @return {jiff-instance} the jiff instance for the described computation.
   *                          The Jiff instance contains the socket, number of parties, functions
   *                          to share and perform operations, as well as synchronization flags.
   *
   * @example
   * // build a jiff instance which will connect to a server running on the local machine
   * var instance = jiff.make_jiff('http://localhost:8080', 'compuation-1', {party_count: 2});
   */
  function make_jiff(hostname, computation_id, options) {
    if (options == null) {
      options = {};
    }

    var jiff = {};

    /**
     * The server hostname, ends with a slash, includes port and protocol (http/https).
     * @member {string} hostname
     * @memberof jiff-instance
     * @instance
     */
    jiff.hostname = hostname.trim();
    if (!jiff.hostname.endsWith('/')) {
      jiff.hostname = jiff.hostname + '/';
    }

    /**
     * An array containing the names (jiff-client-[name].js) of extensions
     * applied to this instance.
     * @member {string[]} extensions
     * @memberof jiff-instance
     * @instance
     */
    jiff.extensions = ['base'];

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
     * and the server is connected. [Do not use directly externally; use isReady() instead]
     * @member {boolean} __ready
     * @memberof jiff-instance
     * @instance
     */
    jiff.__ready = false;

    /**
     * Flags whether this instance has been initialized (the server responded successfully to the initialization message)
     * @member {boolean} __initialized
     * @memberof jiff-instance
     * @instance
     */
    jiff.__initialized = false;

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

    if (options.sodium !== false) {
      /**
       * A promise for when the sodium wrappers are ready. This will be undefined if options.sodium is false.
       * @method {Promise} sodium
       * @memberof jiff-instance
       * @instance
       */
      jiff.sodium_ready = sodium_.ready;
    }

    /**
     * The default Zp for this instance.
     * @memberof jiff-instance
     * @member {number} Zp
     * @instance
     */
    jiff.Zp = options.Zp == null ? gZp : options.Zp;
    if (options.Zp != null && options.safemod === true) {
      // bignumber primes are checked by the bignumber extension
      if (typeof(options.Zp) !== 'string' && options.Zp.isBigNumber !== true) {
        if (!is_prime(options.Zp)) {
          throw new Error('Zp = ' + options.Zp + ' is not prime.  Please use a prime number for the modulus or set safemod to false.');
        }
      }
    }

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

              if (label === 'free' && socket === jiff.socket) {
                jiff.execute_array_hooks('afterOperation', [jiff, 'free', msg], 2);
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
          socket.safe_emit(label, msg);
          current_node = current_node.next;
        }
      };

      var old_disconnect = socket.disconnect;
      socket.disconnect = function () {
        jiff.execute_array_hooks('beforeOperation', [jiff, 'disconnect', {}], -1);
        old_disconnect.apply(socket, arguments);
      };

      // Safe disconnect: only after all messages were acknowledged
      socket.safe_disconnect = function (free, callback) {
        (function ready() {
          if (socket.mailbox.head == null && jiff.counters.pending_opens === 0) {
            if (free) {
              jiff.free();

              // disconnect after free has been delivered
              free = false;
              return ready();
            }

            socket.disconnect();
            if (callback != null) {
              callback();
            }
          } else {
            socket.empty_deferred = new jiff.helpers.Deferred;
            socket.empty_deferred.promise.then(ready);
          }
        }());
      };

      return socket;
    };

    // setup main socket
    var socketOptions = {
      reconnectionDelay: 25000,
      reconnectionDelayMax: 27500,
      randomizationFactor: 0.1,
      autoConnect: false
    };
    socketOptions = Object.assign({}, socketOptions, options.socketOptions);
    jiff.socket = options.__internal_socket;
    if (jiff.socket == null) {
      jiff.socket = io_(hostname, socketOptions);
    }

    if (options.__internal_socket == null) {
      guard_socket(jiff.socket);
    } else {
      jiff.socket.safe_emit = jiff.socket.emit;
      jiff.socket.resend_mailbox = function () {};

      jiff.socket.disconnect = function () {
        jiff.execute_array_hooks('beforeOperation', [jiff, 'disconnect', {}], -1);
      };
      jiff.socket.safe_disconnect = function (free, callback) {
        if (free) {
          jiff.free();
        }
        jiff.socket.disconnect();
        if (callback != null) {
          callback();
        }
      };
    }

    if (options.maxInitializationRetries == null) {
      options.maxInitializationRetries = 2;
    }

    jiff.error = function (label, error) {
      console.log(jiff.id, ':', 'Error from server:', label, '---', error);
      if (label === 'initialization') {
        jiff.socket.disconnect();

        if (jiff.initialization_counter < options.maxInitializationRetries) {
          console.log(jiff.id, ':', 'reconnecting..');
          setTimeout(jiff.connect, socketOptions.reconnectionDelay);
        }
      }
    };
    if (options.onError != null) {
      jiff.error = options.onError;
    }

    // Parse options
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

    if (options.hooks == null) {
      options.hooks = {};
    }

    /**
     * The hooks for this instance.
     * Checkout the <a href="hooks.html">hooks documentation</a>
     * @member {object} hooks
     * @memberof jiff-instance
     * @instance
     */
    jiff.hooks = Object.assign({}, options.hooks);

    // Default hooks:
    if (jiff.hooks.computeShares == null) {
      jiff.hooks.computeShares = jiff_compute_shares;
    }
    if (jiff.hooks.reconstructShare == null) {
      jiff.hooks.reconstructShare = jiff_lagrange;
    }

    // Crypto hooks:
    if (jiff.hooks.encryptSign == null) {
      if (options.sodium !== false) {
        jiff.hooks.encryptSign = encrypt_and_sign;
      } else {
        jiff.hooks.encryptSign = function (jiff, message, encryption_public_key, signing_private_key) {
          return message;
        }
      }
    }
    if (jiff.hooks.decryptSign == null) {
      if (options.sodium !== false) {
        jiff.hooks.decryptSign = decrypt_and_sign;
      } else {
        jiff.hooks.decryptSign = function (jiff, cipher_text, decryption_secret_key, signing_public_key) {
          return cipher_text;
        }
      }
    }
    if (jiff.hooks.generateKeyPair == null) {
      if (options.sodium !== false) {
        jiff.hooks.generateKeyPair = function (jiff) {
          var key = sodium_.crypto_box_keypair(); // this party's public and secret key
          return { public_key: key.publicKey, secret_key: key.privateKey }
        };
      } else {
        jiff.hooks.generateKeyPair = function (jiff) {
          return { public_key: '', secret_key: ''};
        }
      }
    }
    if (jiff.hooks.parseKey == null) {
      if (options.sodium !== false) {
        jiff.hooks.parseKey = function (jiff, keyString) {
          return new Uint8Array(JSON.parse(keyString));
        };
      } else {
        jiff.hooks.parseKey = function (jiff, keyString) {
          return '';
        }
      }
    }
    if (jiff.hooks.dumpKey == null) {
      if (options.sodium !== false) {
        jiff.hooks.dumpKey = function (jiff, key) {
          return '[' + key.toString() + ']';
        };
      } else {
        jiff.hooks.dumpKey = function (jiff, key) {
          return '';
        }
      }
    }

    // Array hooks should have empty array by default:
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
    if (jiff.hooks.beforeOperation == null) {
      jiff.hooks.beforeOperation = [];
    }
    if (jiff.hooks.afterOperation == null) {
      jiff.hooks.afterOperation = [];
    }

    // parse content of share/open messages to be integers (instead of strings due to encryption/decryption)
    jiff.hooks.afterOperation.unshift(function (jiff, label, msg) {
      if (label === 'share' || label === 'open') {
        msg['share'] = parseInt(msg['share'], 10);
      }
      return msg;
    });

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
     * @param {Array} parties - an array of party ids to wait for, must explicitly include 's1' if callback must wait for the server.
     * @param {function(jiff-instance)} callback - the function to execute when these parties are known.
     * @param {boolean} [wait_for_initialization=true] - specifies whether to wait for initialization to be complete
     *                                                   before executing the callback (even if parties are available).
     *                                                   Set this to false if you do not need the party count and this
     *                                                   party's id, or if you already have them, and you are certain
     *                                                   they will be accepted by the server on initialization.
     */
    jiff.wait_for = function (parties, callback, wait_for_initialization) {
      if (wait_for_initialization == null) {
        wait_for_initialization = true;
      }

      jiff.wait_callbacks.push({parties: parties, callback: callback, initialization: wait_for_initialization});
      jiff.execute_wait_callbacks(); // See if the callback can be executed immediately
    };

    /**
     * Executes all callbacks for which the wait condition has been satisfied.
     * Remove all executed callbacks so that they would not be executed in the future.
     * @memberof jiff-instance
     * @instance
     */
    jiff.execute_wait_callbacks = function () {
      var new_waits = [];
      for (var i = 0; i < jiff.wait_callbacks.length; i++) {
        var wait = jiff.wait_callbacks[i];
        var parties = wait.parties;
        var callback = wait.callback;
        var initialization = wait.initialization;

        // Check if the parties to wait for are now known
        var parties_satisfied = true;
        for (var j = 0; j < parties.length; j++) {
          var party_id = parties[j];
          if (jiff.keymap == null || jiff.keymap[party_id] == null) {
            parties_satisfied = false;
            break;
          }
        }

        if (initialization) {
          parties_satisfied = parties_satisfied && jiff.__initialized;
        }

        if (parties_satisfied) {
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
            receive_share(jiff, msg.msg);
          } else if (msg.label === 'open') {
            receive_open(jiff, msg.msg);
          } else if (msg.label === 'custom') {
            receive_custom(jiff, msg.msg);
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
     * Counts how many times JIFF attempted to initialize with the server
     * without success consecutively.
     * @member {number} initialization_counter
     * @memberof jiff-instance
     * @instance
     *
     */
    jiff.initialization_counter = 0;

    /**
     * Connect to the server and starts listening.
     * @method connect
     * @memberof jiff-instance
     * @instance
     */
    jiff.connect = function () {
      // Ask socket to connect, which will automatically trigger a call to 'initialize()' when connection is established!
      if (options.sodium === false) {
        jiff.socket.connect();
      } else {
        jiff.sodium_ready.then(function () {
          jiff.socket.connect();
        });
      }
    };

    // responsible for building the initialization message
    jiff.build_initialization_message = function (public_key) {
      var msg = {
        computation_id: computation_id,
        party_id: jiff.id,
        party_count: jiff.party_count,
        public_key: public_key
      };
      msg = Object.assign(msg, options.initialization);

      // Initialization Hook
      return jiff.execute_array_hooks('beforeOperation', [jiff, 'initialization', msg], 2);
    };

    /**
     * Initializes this instance by sending the initialization message to the server.
     * Should only be called after connection is established.
     * Do not call this manually unless you know what you are doing, use <jiff_instance>.connect() instead!
     */
    jiff.initialize = function () {
      console.log('Connected!', jiff.id);
      jiff.initialization_counter++;

      if (jiff.secret_key == null && jiff.public_key == null) {
        var key = jiff.hooks.generateKeyPair(jiff);
        jiff.secret_key = key.secret_key;
        jiff.public_key = key.public_key;
      }

      // Initialization message
      var msg = jiff.build_initialization_message(jiff.hooks.dumpKey(jiff, jiff.public_key));

      // Emit initialization message to server
      jiff.socket.emit('initialization', JSON.stringify(msg));
    };

    // set on('connect') handler once!
    jiff.socket.on('connect', jiff.initialize);

    /**
     * Store the public keys given in the keymap
     * @param {object} keymap - map party id to public key.
     */
    jiff.store_public_keys = function (keymap) {
      var i;
      for (i in keymap) {
        if (keymap.hasOwnProperty(i) && jiff.keymap[i] == null) {
          jiff.keymap[i] = jiff.hooks.parseKey(jiff, keymap[i]);
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

      // all parties are connected; execute callback
      if (jiff.__ready !== true && jiff.__initialized) {
        jiff.__ready = true;
        if (options.onConnect != null) {
          options.onConnect(jiff);
        }
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
        receive_custom(jiff, { tag: tag, party_id: jiff.id, message: message, encrypted: false });
      }

      for (var p = 0; p < receivers.length; p++) {
        if (receivers[p] === jiff.id) {
          continue;
        }

        var message_to_send = { tag: tag, party_id: receivers[p], message: message, encrypted: encrypt };
        message_to_send = jiff.execute_array_hooks('beforeOperation', [jiff, 'custom', message_to_send], 2);

        if (message_to_send['encrypted'] !== false) {
          message_to_send['message'] = jiff.hooks.encryptSign(jiff, message_to_send['message'], jiff.keymap[message_to_send['party_id']], jiff.secret_key);
          message_to_send['encrypted'] = true;
        }

        jiff.socket.safe_emit('custom', JSON.stringify(message_to_send));
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
     * Polyfill for jQuery Deferred
     * From https://developer.mozilla.org/en-US/docs/Mozilla/JavaScript_code_modules/Promise.jsm/Deferred
     * @memberof jiff-instance.helpers
     * @constructor Deferred
     * @instance
     * @return {Deferred} a new Deferred.
     */
    jiff.helpers.Deferred = function () {
      // Polyfill for jQuery Deferred
      // From https://developer.mozilla.org/en-US/docs/Mozilla/JavaScript_code_modules/Promise.jsm/Deferred
      this.resolve = null;

      /* A method to reject the associated Promise with the value passed.
       * If the promise is already settled it does nothing.
       *
       * @param {anything} reason: The reason for the rejection of the Promise.
       * Generally its an Error object. If however a Promise is passed, then the Promise
       * itself will be the reason for rejection no matter the state of the Promise.
       */
      this.reject = null;

      /* A newly created Promise object.
       * Initially in pending state.
       */
      this.promise = new Promise(function (resolve, reject) {
        this.resolve = resolve;
        this.reject = reject;
      }.bind(this));
      Object.freeze(this);
    };

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
     * Ceil of a number.
     * @memberof jiff-instance.helpers
     * @function ceil
     * @instance
     * @param {number} x - the number to ceil.
     * @return {number} ceil of x.
     */
    jiff.helpers.ceil = Math.ceil;

    /**
     * Floor of a number
     * @memberof jiff-instance.helpers
     * @function floor
     * @instance
     * @param {number} x - the number to floor.
     * @return {number} floor of x.
     */
    jiff.helpers.floor = Math.floor;

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
        var randomBytes = crypto_.__randomBytesWrapper(bytesNeeded);
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
        return -1 * parseInt(party_id.substring(1), 10);
      }
      return parseInt(party_id, 10);
    };

    /**
     * Transforms the given number to an array of bits (numbers).
     * Lower indices in the returned array corresponding to less significant bits.
     * @memberof jiff-instance.helpers
     * @instance
     * @param {number} number - the number to transform to binary
     * @param {length} [length=ceil(log2(number))] - if provided, then the given array will be padded with zeros to the length.
     * @return {number[]} the array of bits.
     */
    jiff.helpers.number_to_bits = function (number, length) {
      number = number.toString(2);
      var bits = [];
      for (var i = 0; i < number.length; i++) {
        bits[i] = parseInt(number.charAt(number.length - 1 - i));
      }
      while (length != null && bits.length < length) {
        bits.push(0);
      }
      return bits;
    };

    /**
     * Transforms the given array of bits to a number.
     * @memberof jiff-instance.helpers
     * @instance
     * @param {bits} number[] - the array of bits to compose as a number, starting from least to most significant bits.
     * @param {length} [length = bits.length] - if provided, only the first 'length' bits will be used
     * @return {number} the array of bits.
     */
    jiff.helpers.bits_to_number = function (bits, length) {
      if (length == null || length > bits.length) {
        length = bits.length;
      }
      return parseInt(bits.slice(0, length).reverse().join(''), 2);
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
     * @returns {object} a map (of size equal to the number of sending parties)
     *          where the key is the party id (from 1 to n)
     *          and the value is the share object that wraps
     *          the value sent from that party (the internal value maybe deferred).
     * @example
     * // share an input value with all parties, and receive all other parties' inputs
     * var shares = jiff_instance.share(input);
     * // my party id is '1', so the first share is mine (technically my share of my input value)
     * var my_share = shares[1];
     *
     * // my share of party 2's input
     * var p2_share = shares[2];
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
     * @param {string|number} [op_id=auto_gen()] - the operation id to be used to tag outgoing messages.
     * @returns {promise|null} a (JQuery) promise to the open value of the secret, null if the party is not specified in the parties array as a receiver.
     * @throws error if share does not belong to the passed jiff instance.
     * @example
     * var shares = jiff_instance.share(input);
     * //multiply the inputs of party 1 and 2 together
     * var result = shares[1].mult(shares[2]);
     * // reveal the result of the multiplication to all parties
     * return jiff_instance.open(result);
     */
    jiff.open = function (share, parties, op_id) {
      return jiff.internal_open(share, parties, op_id);
    };

    /**
     * Same as jiff-instance.open, but used by internal JIFF primitives/protocols (comparisons and secret multiplication).
     */
    jiff.internal_open = function (share, parties, op_id) {
      return jiff_open(jiff, share, parties, op_id);
    };

    /**
     * Opens an array of secret shares.
     * @method open_array
     * @memberof jiff-instance
     * @instance
     * @param {SecretShare[]} shares - an array containing this party's shares of the secrets to reconstruct.
     * @param {Array} [parties=all_parties] - an array with party ids (1 to n) of receiving parties.
     * @param {string|number} [op_id=auto_gen()] - same as jiff_instance.open
     * @returns {promise} a (JQuery) promise to ALL the open values of the secret, the promise will yield
     *                    an array of values matching the corresponding given secret share by index.
     * @throws error if some shares does not belong to the passed jiff instance.
     */
    jiff.open_array = function (shares, parties, op_id) {
      return jiff_open_array(jiff, shares, parties, op_id);
    };

    /**
     * Opens a 2D array of secret shares.
     * @method open_2D_array
     * @memberof jiff-instance
     * @instance
     * @param {SecretShare[][]} shares - an array containing this party's shares of the secrets to reconstruct.
     * @param {jiff-instance} jiff - the jiff instance.
     * @param {SecretShare[]} shares - an array containing this party's shares of the secrets to reconstruct.
     * @param {Array} [parties=all_parties] - an array with party ids (1 to n) of receiving parties.
     * @param {string|number} [op_id=auto_gen()] - same as jiff_instance.open
     * @returns {promise} a (JQuery) promise to ALL the open values of the secret, the promise will yield
     *                    a 2D array of values matching the corresponding given secret share by indices.
     * @throws error if some shares does not belong to the passed jiff instance.
     */
    jiff.open_2D_array = function (shares, parties, op_id) {
      // Default values
      if (parties == null || parties === []) {
        parties = [];
        for (i = 1; i <= jiff.party_count; i++) {
          parties.push(i);
        }
      }

      // Compute operation ids (one for each party that will receive a result
      if (op_id == null) {
        op_id = jiff.counters.gen_op_id2('open_2D_array', parties, shares[0].holders);
      }

      var promises = [];
      for (var i = 0; i < shares.length; i++) {
        var row = shares[i];

        // share
        var promise = jiff.open_array(row, parties, op_id + ':' + i);
        if (promise != null) {
          promises.push(promise);
        }
      }

      if (promises.length === 0) {
        return null;
      }

      return Promise.all(promises);
    };

    /**
     * Receive shares from the specified parties and reconstruct their secret.
     * Use this function in a party that will receive some answer/value but does not have a share of it.
     * @method receive_open
     * @memberof jiff-instance
     * @instance
     * @param {Array} senders - an array with party ids (1 to n) specifying the parties sending the shares.
     * @param {Array} [receivers=all_parties] - an array with party ids (1 to n) specifying the parties receiving the result.
     * @param {number} [threshold=senders.length] - the min number of parties needed to reconstruct the secret, defaults to all the senders.
     * @param {number} [Zp=jiff_instance.Zp] - the mod (if null then the default Zp for the instance is used).
     * @param {string|number} [op_id=auto_Gen()] - same as jiff-instance.open
     * @returns {promise} a (JQuery) promise to the open value of the secret.
     */
    jiff.receive_open = function (senders, receivers, threshold, Zp, op_id) {
      if (senders == null) {
        throw new Error('Must provide "senders" parameter in receive_open');
      }
      if (Zp == null) {
        Zp = jiff.Zp;
      }
      return jiff_open(jiff, jiff.secret_share(jiff, true, null, null, senders, (threshold == null ? senders.length : threshold), Zp), receivers, op_id);
    };

    /**
     * Requests secret(s) from the server (crypto provider) of type matching the given label.
     * @method from_crypto_provider
     * @memberof jiff-instance
     * @instance
     * @param {string} label - the type of secret(s) being requested from crypto_provider (e.g. triplet, bit, etc)
     * @param {Array} [receivers_list=all_parties] - array of party ids that want to receive the secret(s), by default, this includes all parties.
     * @param {number} [threshold=receivers_list.length] - the min number of parties needed to reconstruct the secret(s).
     * @param {number} [Zp=jiff_instance.Zp] - the mod, defaults to the Zp of the instance.
     * @param {string} [op_id=auto_Gen()] - an id which is used to identify the secret requested, so that every party
     *                              gets a share from the same secret for every matching instruction. An automatic id
     *                              is generated by increasing a local counter per label, default ids suffice when all
     *                              parties execute all instructions in the same order.
     * @returns {promise} a promise to the secret(s) provided by the server/crypto provider, the promise returns an object with the given format:
     *                               { values: <any values returned by the server side>, shares: <array of secret share objects matching shares returned by server by index>}
     */
    jiff.from_crypto_provider = function (label, receivers_list, threshold, Zp, op_id, params) {
      return from_crypto_provider(jiff, label, receivers_list, threshold, Zp, op_id, params);
    };

    /**
     * A collection of useful protocols to be used during computation or preprocessing: extensions are encouraged to add useful
     * common protocols here, under a sub namespace corresponding to the extension name.
     * @memberof jiff-instance
     * @namespace protocols
     */
    jiff.protocols = {};

    /**
     * share an existing share (value) under a new threshold or to a new set of parties. Should not be used to refresh a share (use share.refresh() instead).
     * @method reshare
     * @instance
     * @memberof jiff-instance.protocols
     * @param {secret_share} [share=null] - the share you would like to reshare (null if you are a receiver but not a sender).
     * @param {number} [threshold=receivers_list.length] - the new threshold, defaults to the length of receivers_list param
     * @param {Array} [receivers_list=all_parties] - array of party ids to receive from, by default, this includes all parties.
     * @param {Array} [senders_list=all_parties] - array of party ids that posses the share and will reshare it with the receivers, by default, this includes all parties.
     * @param {number} [Zp=jiff.Zp] - the Zp of the existing share.
     * @param {string} [op_id=auto_gen()] - the operation id which is used to identify this multiplication (and internally, the corresponding beaver triplet).
     *                         This id must be unique, and must be passed by all parties to the same instruction.
     *                         this ensures that every party gets a share from the same triplet for every matching instruction. An automatic id
     *                         is generated by increasing a local counter, default ids suffice when all parties execute the
     *                         instructions in the same order.
     * @return {SecretShare} this party's share of the result under the new threshold, or null if this party is not a receiver.
     */
    jiff.protocols.reshare = function (share, threshold, receivers_list, senders_list, Zp, op_id) {
      var i;

      // default values
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
      if (Zp == null) {
        Zp = jiff.Zp;
      }

      if (op_id == null) {
        op_id = jiff.counters.gen_op_id('reshare', senders_list);
      }

      // Check if this party is a sender or receiver
      var isSender = senders_list.indexOf(jiff.id) > -1;
      var isReceiver = receivers_list.indexOf(jiff.id) > -1;
      if (!isSender && !isReceiver) {
        return null;
      }

      // optimization, if nothing changes, keep share
      if (share != null && JSON.stringify(receivers_list) === JSON.stringify(senders_list) && threshold === share.threshold) {
        return share;
      }

      // Setup the result
      var final_deferred;
      var result = null;
      if (isReceiver) {
        final_deferred = new jiff.helpers.Deferred;
        result = jiff.secret_share(jiff, false, final_deferred.promise, undefined, receivers_list, threshold, Zp);
      }

      // This function is called when the share is ready: the value of the share has been received.
      var ready_share = function () {
        var intermediate_shares = jiff.internal_share(isSender ? share.value : null, threshold, receivers_list, senders_list, Zp, op_id);

        if (isReceiver) {
          var promises = [];
          for (var i = 0; i < senders_list.length; i++) {
            var party_id = senders_list[i];
            promises.push(intermediate_shares[party_id].promise);
          }

          // Reconstruct share under new threshold
          Promise.all(promises).then(function () {
            var reconstruct_parts = [];
            for (var i = 0; i < senders_list.length; i++) {
              var party_id = senders_list[i];
              //shamir reconstruct takes an array of objects
              //has attributes: {value: x, sender_id: y, Zp: jiff_instance.Zp}
              reconstruct_parts[i] = {value: intermediate_shares[party_id].value, sender_id: party_id, Zp: Zp};
            }
            var value = jiff.hooks.reconstructShare(jiff, reconstruct_parts);
            final_deferred.resolve(value);
          });
        }
      };

      if (isSender && !share.ready) {
        share.promise.then(ready_share);
      } else { // either a receiver or share is ready
        ready_share();
      }

      return result;
    };

    /**
     * Creates shares of an unknown random number. Every party comes up with its own random number and shares it.
     * Then every party combines all the received shares to construct one share of the random unknown number.
     * @method generate_random_number
     * @memberof jiff-instance.protocols
     * @instance
     * @param {number} threshold - the min number of parties needed to reconstruct the secret after it is computed.
     * @param {Array} receivers_list - array of party ids to receive the result.
     * @param {Array} compute_list - array of party ids to perform the protocol.
     * @param {number} Zp - the mod.
     * @param {object} params - an object containing extra parameters passed by the user.
     *                                 Expects:
     *                               - op_id: the base id to use for operation during the execution of this protocol, defaults to auto generated.
     *                               - compute_threshold: the threshold to use during computation: defaults to compute_list.length
     * @return {Object} contains 'share' (this party's share of the result) and 'promise'.
     */
    jiff.protocols.generate_random_number = function (threshold, receivers_list, compute_list, Zp, params) {
      if (params.op_id == null) {
        params.op_id = jiff.counters.gen_op_id2('generate_random_number', receivers_list, compute_list);
      }
      return jiff_share_all_number(jiff, jiff.helpers.random(Zp), threshold, receivers_list, compute_list, Zp, params);
    };

    /**
     * Creates shares of 0, such that no party knows the other parties' shares.
     * Every party secret shares 0, then every party sums all the shares they received, resulting
     * in a new share of 0 for every party.
     * @method generate_zero
     * @memberof jiff-instance.protocols
     * @instance
     * @param {number} threshold - the min number of parties needed to reconstruct the secret after it is computed.
     * @param {Array} receivers_list - array of party ids to receive the result.
     * @param {Array} compute_list - array of party ids to perform the protocol.
     * @param {number} Zp - the mod.
     * @param {object} params - an object containing extra parameters passed by the user.
     *                                 Expects:
     *                               - op_id: the base id to use for operation during the execution of this protocol, defaults to auto generated.
     *                               - compute_threshold: the threshold to use during computation: defaults to compute_list.length
     * @return {Object} contains 'share' (this party's share of the result) and 'promise'.
     */
    jiff.protocols.generate_zero = function (threshold, receivers_list, compute_list, Zp, params) {
      if (params.op_id == null) {
        params.op_id = jiff.counters.gen_op_id2('generate_random_number', receivers_list, compute_list);
      }
      return jiff_share_all_number(jiff, 0, threshold, receivers_list, compute_list, Zp, params);
    };

    /**
     * Creates shares of r and x, such that r is a uniform random number between 0 and Zp, and x is floor(r/constant)
     * where constant is provided by the extra params.
     * @method generate_random_and_quotient
     * @memberof jiff-instance.protocols
     * @instance
     * @param {number} threshold - the min number of parties needed to reconstruct the secret after it is computed.
     * @param {Array} receivers_list - array of party ids to receive the result.
     * @param {Array} compute_list - array of party ids to perform the protocol.
     * @param {number} Zp - the mod.
     * @param {object} params - an object containing extra parameters passed by the user.
     *                                 Expects:
     *                               - op_id: the base id to use for operation during the execution of this protocol, defaults to auto generated.
     *                               - compute_threshold: the threshold to use during computation: defaults to compute_list.length
     *                               - constant: the constant to divide the random number by.
     *                               - output_op_id: the set op id of the output quotient and noise.
     * @return {Object} contains 'share' (this party's share of the result) and 'promise'.
     */
    jiff.protocols.generate_random_and_quotient = function (threshold, receivers_list, compute_list, Zp, params, protocols) {
      // consistent and unique op_id for compute and receiver parties
      if (params.op_id == null) {
        params.op_id = jiff.counters.gen_op_id2('generate_random_and_quotient', receivers_list, compute_list);
      }
      if (params.compute_threshold == null) {
        params.compute_threshold = Math.floor((compute_list.length + 1) / 2); // honest majority BGW
      }

      // read only copy
      var _params = params;

      var promise = null;
      // do preprocessing for this function
      if (params.ondemand !== true) {
        var intermediate_output_op_id = params.constant != null ? params.op_id : params.output_op_id;
        params = Object.assign({}, _params);
        params.op_id = params.op_id + ':preprocessing';
        params.output_op_id = intermediate_output_op_id;
        promise = jiff.__preprocessing('__generate_random_and_quotient', 1, protocols, params.compute_threshold, compute_list, compute_list, Zp, [intermediate_output_op_id], params);
      }

      // execute the actual function
      if (_params.constant == null) {
        return {share: { ondemand: true }, promise: promise};
      }

      var constant = _params.constant;
      var op_id = _params.op_id;

      // stores the result
      var r, q;

      // for compute parties
      var promise;
      if (compute_list.indexOf(jiff.id) > -1) {
        var largest_quotient, largest_multiple;
        if (Zp.isBigNumber === true) {
          largest_quotient = Zp.div(constant).floor();
          largest_multiple = largest_quotient.times(constant);
        } else {
          largest_quotient = Math.floor(Zp / constant);
          largest_multiple = largest_quotient * constant;
        }

        // Uniform random number between 0 and Zp
        var r_bits = jiff.get_preprocessing(op_id + ':rejection1');
        var cmp = jiff.protocols.bits.cgteq(r_bits, largest_multiple, op_id + ':bits_cgteq');
        var r1 = jiff.protocols.bits.bit_composition(r_bits); // assume cmp = 1

        // assume cmp = 0
        params = Object.assign({}, _params);
        params.op_id = op_id + ':rejection2';
        params.upper_bound = largest_quotient;
        var div = jiff.protocols.bits.rejection_sampling(params.compute_threshold, compute_list, compute_list, Zp, params, protocols).share;
        div = jiff.protocols.bits.bit_composition(div);

        params = Object.assign({}, params);
        params.op_id = op_id + ':rejection3';
        params.upper_bound = constant;
        var mod = jiff.protocols.bits.rejection_sampling(params.compute_threshold, compute_list, compute_list, Zp, params, protocols).share;
        mod = jiff.protocols.bits.bit_composition(mod);
        var r2 = div.icmult(constant).isadd(mod);

        // choose either (r1, largest_quotient) or (r2, div) based on cmp result
        r = cmp.iif_else(r1, r2, op_id + ':ifelse1');
        q = cmp.iif_else(largest_quotient, div, op_id + ':ifelse2');
        promise = Promise.all([r.promise, q.promise]);
      }

      // reshare the result with the designated receivers
      r = jiff.protocols.reshare(r, threshold, receivers_list, compute_list, Zp, op_id + ':reshare1');
      q = jiff.protocols.reshare(q, threshold, receivers_list, compute_list, Zp, op_id + ':reshare2');

      // return result
      if (receivers_list.indexOf(jiff.id) > -1) {
        promise = Promise.all([r.promise, q.promise]);
      }
      return {share: {r: r, q: q}, promise: promise};
    };

    /**
     * generation of beaver triplet via MPC, uses the server for communication channels, but not for generation.
     * @method generate_beaver_bgw
     * @memberof jiff-instance.protocols
     * @instance
     * @param {number} threshold - the threshold of the triplets when stored by receivers after generation.
     * @param {Array} receivers_list - array of party ids that want to receive the triplet shares.
     * @param {Array} compute_list - array of party ids that will perform this protocol.
     * @param {number} Zp - the mod.
     * @param {object} params - an object containing extra parameters passed by the user.
     *                               Expects:
     *                               - op_id: the base id to use for operation during the execution of this protocol, defaults to auto generated.
     *                               - an optional number compute_threshold parameter, which specifies threshold used
     *                               during the protocol execution. By default, this is the length of the (compute_list+1)/2.
     * @param {object} protocols - the sub protocols to use for preprocessing.
     * @return {object} all pre-processing protocols must return an object with these keys:
     *  {
     *    'share': the share(s)/value(s) to store attached to op_id for later use by the computation (i.e. the result of preprocessing),
     *    'promise': a promise for when this protocol is fully completed (could be null if the protocol was already completed)
     *  }
     *  In this case, 'share' is an array of this party's shares of the resulting triplet, a,b,c such that a*b=c.
     */
    jiff.protocols.generate_beaver_bgw = function (threshold, receivers_list, compute_list, Zp, params, protocols) {
      if (params.compute_threshold == null) {
        params.compute_threshold = Math.floor((compute_list.length + 1) / 2); // honest majority BGW
      }
      if (params.op_id == null) {
        params.op_id = jiff.counters.gen_op_id2('generate_beaver_bgw', receivers_list, compute_list);
      }
      var op_id = params.op_id;
      var _params = params;

      var a, b, c, promises;
      if (compute_list.indexOf(jiff.id) > -1) {
        params = Object.assign({}, _params);
        params.op_id = op_id + ':share_a';
        a = protocols.generate_random_number(params.compute_threshold, compute_list, compute_list, Zp, params, protocols).share;

        params = Object.assign({}, _params);
        params.op_id = op_id + ':share_b';
        b = protocols.generate_random_number(params.compute_threshold, compute_list, compute_list, Zp, params, protocols).share;

        c = a.ismult_bgw(b, op_id + ':smult_bgw');
        promises = [a.promise, b.promise, c.promise];
      }

      a = jiff.protocols.reshare(a, threshold, receivers_list, compute_list, Zp, op_id + ':reshare_a');
      b = jiff.protocols.reshare(b, threshold, receivers_list, compute_list, Zp, op_id + ':reshare_b');
      c = jiff.protocols.reshare(c, threshold, receivers_list, compute_list, Zp, op_id + ':reshare_c');
      if (receivers_list.indexOf(jiff.id) > -1) {
        promises = [a.promise, b.promise, c.promise];
      }

      return { share: [a, b, c], promise: Promise.all(promises) };
    };

    /**
     * generates a random bit under MPC by xoring all bits sent by participating parties
     * @method generate_random_bit_bgw
     * @memberof jiff-instance.protocols
     * @instance
     * @param {number} threshold - the min number of parties needed to reconstruct the secret after it is computed.
     * @param {Array} receivers_list - array of party ids to receive the result.
     * @param {Array} compute_list - array of party ids to perform the protocol.
     * @param {number} Zp - the mod.
     * @param {object} params - an object containing extra parameters passed by the user.
     *                                 Expects:
     *                               - op_id: the base id to use for operation during the execution of this protocol, defaults to auto generated.
     *                               - compute_threshold: the threshold to use during computation: defaults to compute_list.length
     * @return {Object} contains 'share' (this party's share of the generated bit) and 'promise'.
     */
    jiff.protocols.generate_random_bit_bgw  = function (threshold, receivers_list, compute_list, Zp, params) {
      if (params.op_id == null) {
        params.op_id = jiff.counters.gen_op_id2('generate_random_bit_bgw', receivers_list, compute_list);
      }
      if (params.compute_threshold == null) {
        params.compute_threshold = Math.floor((compute_list.length + 1) / 2); // honest majority BGW
      }

      var op_id = params.op_id;

      // Generate random bit
      var random_bit, promise;
      if (compute_list.indexOf(jiff.id) > -1) {
        var bit = jiff.helpers.random(2);
        var bit_shares = jiff.internal_share(bit, params.compute_threshold, compute_list, compute_list, Zp, op_id + ':share');

        random_bit = bit_shares[compute_list[0]];
        for (var i = 1; i < compute_list.length; i++) {
          var party_id = compute_list[i];
          var obit = bit_shares[party_id];
          random_bit = random_bit.isadd(obit).issub(random_bit.ismult_bgw(obit, op_id + ':smult' + i).icmult(2));
        }

        promise = random_bit.promise;
      }

      // Reshare
      random_bit = jiff.protocols.reshare(random_bit, threshold, receivers_list, compute_list, Zp, op_id+':reshare');
      if (receivers_list.indexOf(jiff.id) > -1) {
        promise = random_bit.promise;
      }
      return { share: random_bit, promise: promise };
    };

    /**
     * generates a sequence of random bits under MPC.
     * @method generate_random_bits
     * @memberof jiff-instance.protocols
     * @instance
     * @param {number} [threshold=receivers_list.length] - the threshold of the bit when stored by receivers after generation.     * @param {number} threshold - the min number of parties needed to reconstruct the secret after it is computed.
     * @param {Array} receivers_list - array of party ids to receive the result.
     * @param {Array} compute_list - array of party ids to perform the protocol.
     * @param {number} Zp - the mod.
     * @param {object} params - an object containing extra parameters passed by the user.
     *                                 Expects:
     *                               - op_id: the base id to use for operation during the execution of this protocol, defaults to auto generated.
     *                               - count: how many random bits to generate.
     *                               - compute_threshold: the threshold to use during computation: defaults to compute_list.length
     * @param {object} protocols - the protocols to use for preprocessing.
     * @return {Object} contains 'share' (array of secret shares bits) and 'promise'.
     */
    jiff.protocols.generate_random_bits = function (threshold, receivers_list, compute_list, Zp, params, protocols) {
      if (params.count == null) {
        params.count = 1;
      }
      if (params.op_id == null) {
        params.op_id = jiff.counters.gen_op_id2('generate_random_bits', receivers_list, compute_list);
      }

      var op_id = params.op_id;
      var _params = params;

      var promises = [];
      var bits = [];
      for (var i = 0; i < params.count; i++) {
        params = Object.assign({}, _params);
        params.op_id = op_id + ':' + i;

        var bit = protocols.generate_random_bit(threshold, receivers_list, compute_list, Zp, params, protocols);

        promises.push(bit.promise);
        if (bit.share != null) {
          bits.push(bit.share);
        }
      }

      if (bits.length === 0) {
        bits = null;
      }
      return {share: bits, promise: Promise.all(promises)};
    };

    /**
     * A collection of useful protocols for manipulating bitwise shared numbers, and transforming them from and to regular numeric shares.
     * @memberof jiff-instance.protocols
     * @namespace bits
     */
    jiff.protocols.bits = {};

    /**
     * Creates a secret share of the number represented by the given array of secret shared bits.
     * Requires no communication, only local operations.
     * @method bit_composition
     * @memberof jiff-instance.protocols.bits
     * @instance
     * @param {SecretShare[]} bits - an array of the secret shares of bits, starting from least to most significant bits.
     * @returns {SecretShare} a secret share of the number represented by bits.
     */
    jiff.protocols.bits.bit_composition = function (bits) {
      var result = bits[0];
      var pow = 1;
      for (var i = 1; i < bits.length; i++) {
        pow = pow * 2;
        result = result.isadd(bits[i].icmult(pow));
      }
      return result;
    };

    /**
     * Share a number as an array of secret bits
     * This takes the same parameters as jiff-instance.share, but returns an array of secret bit shares per sending party.
     * Each bit array starts with the least significant bit at index 0, and most significant bit at index length-1.
     * @method share_bits
     * @memberof jiff-instance.protocols.bits
     * @instance
     * @param {number} secret - the number to share (this party's input)
     * @param {number} [bit_length=jiff_instance.Zp] - the number of generated bits, if the secret has less bits, it will be
     *                                                 padded with zeros.
     * @param {number} [threshold=receivers_list.length] - threshold of each shared bit.
     * @param {Array} [receivers_list=all_parties] - receivers of every bits.
     * @param {Array} [senders_list=all_parties] - senders of evey bit.
     * @param {number} [Zp=jiff_instance.Zp] - the field of sharing for every bit.
     * @param {string|number} [share_id=auto_gen()] - synchronization id.
     * @returns {object} a map (of size equal to the number of parties)
     *          where the key is the party id (from 1 to n)
     *          and the value is an array of secret shared bits.
     */
    jiff.protocols.bits.share_bits = function (secret, bit_length, threshold, receivers_list, senders_list, Zp, share_id) {
      var i;
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

      if (share_id == null) {
        share_id = jiff.counters.gen_op_id2('share_bits', receivers_list, senders_list);
      }

      if (bit_length == null) {
        bit_length = Zp.toString(2).length;
      }

      // to allow for secret=null when party is not a sender
      var local_bits = [];
      if (secret != null) {
        local_bits = jiff.helpers.number_to_bits(secret, bit_length);
      }

      var shared_bits = {};
      for (i = 0; i < senders_list.length; i++) {
        shared_bits[senders_list[i]] = [];
      }

      for (i = 0; i < bit_length; i++) {
        var round = jiff.internal_share(local_bits[i], threshold, receivers_list, senders_list, Zp, share_id + ':' + i);
        for (var si = 0; si < senders_list.length; si++) {
          var pid = senders_list[si];
          shared_bits[pid].push(round[pid]);
        }
      }

      return shared_bits;
    };

    /**
     * Opens the given array of secret shared bits.
     * This works regardless of whether the represented value fit inside the corresponding field or not.
     * @method open
     * @memberof jiff-instance.protocols.bits
     * @instance
     * @param {SecretShare[]} bits - an array of the secret shares of bits, starting from least to most significant bits.
     * @param {number[]} parties - parties to open (same as jiff_instance.open)
     * @param {string|number} [op_id=auto_gen()] - same as jiff_instance.open
     * @returns {promise} a promise to the number represented by bits.
     */
    jiff.protocols.bits.open = function (bits, parties, op_id) {
      // Default values
      if (parties == null || parties === []) {
        parties = [];
        for (var p = 1; p <= jiff.party_count; p++) {
          parties.push(p);
        }
      }

      // Compute operation ids (one for each party that will receive a result
      if (op_id == null) {
        op_id = jiff.counters.gen_op_id2('bits.open', parties, bits[0].holders);
      }

      var opened_bits = [];
      for (var i = 0; i < bits.length; i++) {
        opened_bits[i] = jiff.internal_open(bits[i], parties, op_id + ':' + i);
      }

      return Promise.all(opened_bits).then(function (bits) {
        return jiff.helpers.bits_to_number(bits, bits.length);
      });
    };

    /**
     * Receives an opening of an array of secret bits without owning shares of the underlying value.
     * Similar to jiff.receive_open() but for bits.
     * This works regardless of whether the represented value fit inside the corresponding field or not.
     * @method receive_open
     * @memberOf jiff-instance.protocols.bits
     * @instance
     * @param {Array} senders - an array with party ids (1 to n) specifying the parties sending the shares.
     * @param {Array} [receivers=all_parties] - an array with party ids (1 to n) specifying the parties receiving the result.
     * @param {number} [count=ceil(log2(Zp))] - the number of bits being opened.
     * @param {number} [threshold=parties.length] - the min number of parties needed to reconstruct the secret, defaults to all the senders.
     * @param {number} [Zp=jiff_instance.Zp] - the mod (if null then the default Zp for the instance is used).
     * @param {string|number|object} [op_id=auto_gen()] - unique and consistent synchronization id between all parties.
     * @returns {promise} a (JQuery) promise to the open value of the secret.
     */
    jiff.protocols.bits.receive_open = function (senders, receivers, count, threshold, Zp, op_id) {
      if (senders == null) {
        throw new Error('Must provide "senders" parameter in receive_open');
      }
      // Default values
      if (receivers == null) {
        receivers = [];
        for (i = 1; i <= jiff.party_count; i++) {
          receivers.push(i);
        }
      }

      if (op_id == null) {
        op_id = jiff.counters.gen_op_id2('bits.open', receivers, senders);
      }

      if (count == null) {
        if (Zp == null) {
          Zp = jiff.Zp;
        }
        count = Zp.toString(2).length;
      }

      var opened_bits = [];
      for (var i = 0; i < count; i++) {
        opened_bits[i] = jiff.receive_open(senders, receivers, threshold, Zp, op_id + ':' + i);
      }

      return Promise.all(opened_bits).then(function (bits) {
        return jiff.helpers.bits_to_number(bits, bits.length);
      });
    };

    /**
     * Checks whether the given bitwise secret shared number and numeric constant are equal.
     * @method ceq
     * @memberof jiff-instance.protocols.bits
     * @instance
     * @param {SecretShare[]} bits - an array of secret shares of bits, starting from least to most significant bits.
     * @param {number} constant - the constant number.
     * @param {string} [op_id=<auto-generate-id>] - the base operation id to use when generating unique ids for multiplications.
     *                                              default value should suffice when the code of all parties executes all instructions
     *                                              in the same exact order, otherwise, a unique base name is needed here.
     * @returns {SecretShare|boolean} a secret share of 1 if parameters are equal, 0 otherwise. If result is known
     *                                (e.g. constant has a greater non-zero bit than bits' most significant bit), the result is
     *                                returned immediately as a boolean.
     */
    jiff.protocols.bits.ceq = function (bits, constant, op_id) {
      if (!(bits[0].isConstant(constant))) {
        throw new Error('parameter should be a number (bits.ceq)');
      }
      if (op_id == null) {
        op_id = jiff.counters.gen_op_id('bits.ceq', bits[0].holders);
      }
      var result = jiff.protocols.bits.cneq(bits, constant, op_id);
      if (result === true || result === false) {
        return !result;
      }
      return result.inot();
    };

    /**
     * Checks whether the given bitwise secret shared number and numeric constant are not equal.
     * @method cneq
     * @memberof jiff-instance.protocols.bits
     * @instance
     * @param {SecretShare[]} bits - an array of secret shares of bits, starting from least to most significant bits.
     * @param {number} constant - the constant number.
     * @param {string} [op_id=<auto-generate-id>] - the base operation id to use when generating unique ids for multiplications.
     *                                              default value should suffice when the code of all parties executes all instructions
     *                                              in the same exact order, otherwise, a unique base name is needed here.
     * @returns {SecretShare|boolean} a secret share of 1 if parameters are not equal, 0 otherwise. If result is known
     *                                (e.g. constant has a greater non-zero bit than bits' most significant bit), the result is
     *                                returned immediately as a boolean.
     */
    jiff.protocols.bits.cneq = function (bits, constant, op_id) {
      if (!(bits[0].isConstant(constant))) {
        throw new Error('parameter should be a number (bits.cneq)');
      }

      if (op_id == null) {
        op_id = jiff.counters.gen_op_id('bits.cneq', bits[0].holders);
      }

      // copy to avoid aliasing problems during execution
      bits = bits.slice();

      var constant_bits = jiff.helpers.number_to_bits(constant, bits.length);
      if (constant_bits.length > bits.length) {
        // Optimization: if constant has more bits, one of them must be 1, constant must be greater than bits.
        return true;
      }

      var deferred = new jiff.helpers.Deferred();
      var result = jiff.secret_share(jiff, false, deferred.promise, undefined, bits[0].holders, bits[0].threshold, bits[0].Zp);

      // big or of bitwise XORs
      var initial = bits[0].icxor_bit(constant_bits[0]);
      bit_combinator(deferred, 1, bits.length, initial, function (i, prev) {
        var xor = bits[i].icxor_bit(constant_bits[i]);
        xor = prev.isor_bit(xor, op_id + ':sor_bit:' + (i - 1));
        return xor;
      });

      return result;
    };

    /**
     * Checks whether given secret shared bits are greater than the given constant.
     * @method cgt
     * @memberof jiff-instance.protocols.bits
     * @instance
     * @param {SecretShare[]} bits - an array of the secret shares of bits, starting from least to most significant bits.
     * @param {number} constant - the constant number.
     * @param {string} [op_id=<auto-generate-id>] - the base operation id to use when generating unique ids for multiplications.
     *                                              default value should suffice when the code of all parties executes all instructions
     *                                              in the same exact order, otherwise, a unique base name is needed here.
     * @returns {SecretShare|boolean} a secret share of 1 if bits are greater than constant, 0 otherwise, if result is known
     *                                (e.g. constant has greater non-zero bit than bits' most significant bit), the result is
     *                                returned immediately as a boolean.
     */
    jiff.protocols.bits.cgt = function (bits, constant, op_id) {
      if (!(bits[0].isConstant(constant))) {
        throw new Error('parameter should be a number (bits.cgt)');
      }
      if (op_id == null) {
        op_id = jiff.counters.gen_op_id('bits.cgt', bits[0].holders);
      }
      return jiff.protocols.bits.cgteq(bits, constant+1, op_id);
    };

    /**
     * Checks whether given secret shared bits are greater or equal to the given constant.
     * @method cgteq
     * @memberof jiff-instance.protocols.bits
     * @instance
     * @param {SecretShare[]} bits - an array of the secret shares of bits, starting from least to most significant bits.
     * @param {number} constant - the constant number.
     * @param {string} [op_id=<auto-generate-id>] - the base operation id to use when generating unique ids for multiplications.
     *                                              default value should suffice when the code of all parties executes all instructions
     *                                              in the same exact order, otherwise, a unique base name is needed here.
     * @returns {SecretShare|boolean} a secret share of 1 if bits are greater or equal to constant, 0 otherwise, if result is known
     *                                (e.g. constant has greater non-zero bit than bits' most significant bit or constant is zero), the result is
     *                                returned immediately as a boolean.
     */
    jiff.protocols.bits.cgteq = function (bits, constant, op_id) {
      if (!(bits[0].isConstant(constant))) {
        throw new Error('parameter should be a number (bits.cgteq)');
      }

      if (op_id == null) {
        op_id = jiff.counters.gen_op_id('bits.cgteq', bits[0].holders);
      }

      // copy to avoid aliasing problems during execution
      bits = bits.slice();

      // Optimization: the bits are a share of non-negative number, if constant <= 0, return true
      if (constant.toString().startsWith('-') || constant.toString() === '0') {
        return true;
      }

      // decompose result into bits
      var constant_bits = jiff.helpers.number_to_bits(constant, bits.length);
      if (constant_bits.length > bits.length) {
        // Optimization: if constant has more bits, one of them must be 1, constant must be greater than bits.
        return false;
      }

      // initialize result
      var deferred = new jiff.helpers.Deferred();
      var result = jiff.secret_share(jiff, false, deferred.promise, undefined, bits[0].holders, bits[0].threshold, bits[0].Zp);

      // Subtract bits2 from bits1, only keeping track of borrow
      var borrow = bits[0].inot().icmult(constant_bits[0]);

      // compute one bit at a time, propagating borrow
      bit_combinator(deferred, 1, bits.length, borrow, function (i, borrow) {
        var xor = bits[i].icxor_bit(constant_bits[i]);
        var andNot = bits[i].inot().icmult(constant_bits[i]);

        // save and update borrow
        borrow = xor.inot().ismult(borrow, op_id + ':smult:' + (i - 1));
        return borrow.isadd(andNot);
      });

      return result.inot();
    };

    /**
     * Checks whether given secret shared bits are less than the given constant.
     * @method clt
     * @memberof jiff-instance.protocols.bits
     * @instance
     * @param {SecretShare[]} bits - an array of the secret shares of bits, starting from least to most significant bits.
     * @param {number} constant - the constant number.
     * @param {string} [op_id=<auto-generate-id>] - the base operation id to use when generating unique ids for multiplications.
     *                                              default value should suffice when the code of all parties executes all instructions
     *                                              in the same exact order, otherwise, a unique base name is needed here.
     * @returns {SecretShare|boolean} a secret share of 1 if bits are less than the constant, 0 otherwise, if result is known
     *                                (e.g. constant has greater non-zero bit than bits' most significant bit), the result is
     *                                returned immediately as a boolean.
     */
    jiff.protocols.bits.clt = function (bits, constant, op_id) {
      if (!(bits[0].isConstant(constant))) {
        throw new Error('parameter should be a number (bits.clt)');
      }
      if (op_id == null) {
        op_id = jiff.counters.gen_op_id('bits.clt', bits[0].holders);
      }
      var result = jiff.protocols.bits.cgteq(bits, constant, op_id);
      if (result === true || result === false) {
        return !result;
      }
      return result.inot();
    };

    /**
     * Checks whether given secret shared bits are less or equal to the given constant.
     * @method clteq
     * @memberof jiff-instance.protocols.bits
     * @instance
     * @param {SecretShare[]} bits - an array of the secret shares of bits, starting from least to most significant bits.
     * @param {number} constant - the constant number.
     * @param {string} [op_id=<auto-generate-id>] - the base operation id to use when generating unique ids for multiplications.
     *                                              default value should suffice when the code of all parties executes all instructions
     *                                              in the same exact order, otherwise, a unique base name is needed here.
     * @returns {SecretShare|boolean} a secret share of 1 if bits are less or equal to constant, 0 otherwise, if result is known
     *                                (e.g. constant has greater non-zero bit than bits' most significant bit), the result is
     *                                returned immediately as a boolean.
     */
    jiff.protocols.bits.clteq = function (bits, constant, op_id) {
      if (!(bits[0].isConstant(constant))) {
        throw new Error('parameter should be a number (bits.clteq)');
      }
      if (op_id == null) {
        op_id = jiff.counters.gen_op_id('bits.clteq', bits[0].holders);
      }
      var result = jiff.protocols.bits.cgt(bits, constant, op_id);
      if (result === true || result === false) {
        return !result;
      }
      return result.inot();
    };

    // private
    var __rejection_sampling = function (lower_bound, upper_bound, compute_list, Zp, params, protocols) {
      // Figure out sampling range
      var range;
      if (upper_bound.isBigNumber === true) {
        range = upper_bound.minus(lower_bound);
      } else {
        range = upper_bound - lower_bound;
      }

      // Figure out final bit size (after adding back lower)
      var finalLength = jiff.helpers.ceil(jiff.helpers.bLog(upper_bound, 2));
      finalLength = parseInt(finalLength.toString(), 10);
      finalLength = Math.max(finalLength, 1); // special case: when upper_bound is 1!

      // Special cases
      if (range.toString() === '0') {
        throw new Error('rejection sampling called with range 0, no numbers to sample!');
      }
      if (range.toString() === '1') {
        var zero = protocols.generate_zero(params.compute_threshold, compute_list, compute_list, Zp, params, protocols).share;
        // special case: cadd can be performed locally on bit arrays of length 1!
        var resultOne = jiff.protocols.bits.cadd([zero], lower_bound);
        while (resultOne.length > finalLength) {
          resultOne.pop();
        }
        return resultOne;
      }

      // Transform sampling range into bit size
      var bitLength = jiff.helpers.ceil(jiff.helpers.bLog(range, 2));
      bitLength = parseInt(bitLength.toString(), 10);

      // Create output array of bit shares
      var many_shares = many_secret_shares(jiff, finalLength, compute_list, params.compute_threshold, Zp);
      var deferreds = many_shares.deferreds;
      var result = many_shares.shares;

      // Sample and resample output
      (function resample(reject_count) {
        var paramsCopy = Object.assign({}, params);
        paramsCopy['count'] = bitLength;
        paramsCopy['op_id'] = params.op_id + ':sampling:' + reject_count;
        var bits = protocols.generate_random_bits(params.compute_threshold, compute_list, compute_list, Zp, paramsCopy, protocols).share;

        // Rejection protocol
        var online_resample = function () {
          var bits_add = bits;
          if (lower_bound.toString() !== '0') {
            bits_add = jiff.protocols.bits.cadd(bits, lower_bound, params.op_id + ':bits.cadd:' + reject_count);
          }

          var cmp = jiff.protocols.bits.clt(bits, range, params.op_id + ':bits.clt:' + reject_count);
          if (cmp === true) { // need to resample
            return resolve_many_secrets(deferreds, bits_add);
          } else if (cmp === false) {
            return resample(reject_count+1);
          }

          var promise = jiff.internal_open(cmp, compute_list, params.op_id + ':open:' + reject_count);
          promise.then(function (cmp) {
            if (cmp.toString() === '1') {
              return resolve_many_secrets(deferreds, bits_add);
            }
            resample(reject_count+1);
          });
        };

        // if run with pre-processing, do the pre-processing on demand
        if (jiff.crypto_provider === true) {
          online_resample();
        } else {
          // Request pre-processing during the protocol, since this protocol is meant to run in pre-processing itself,
          // and because we cannot know ahead of time how many rejections are needed to be pre-processed.
          paramsCopy = Object.assign({}, params);
          paramsCopy['namespace'] = 'base';
          paramsCopy['bitLength'] = bits.length;
          paramsCopy['op_id'] = params.op_id + ':preprocessing:bits.clt';

          var promises = [];
          if (jiff.helpers.bLog(range, 2).toString().indexOf('.') > -1) { // this is ok since range > 1 here.
            // we do not need to really do a comparison when range is a power of 2, we know the result is true!
            var promise1 = jiff.__preprocessing('bits.clt', 1, protocols, params.compute_threshold, compute_list, compute_list, Zp, [params.op_id + ':bits.clt:' + reject_count], paramsCopy);
            var promise2 = jiff.__preprocessing('open', 1, protocols, params.compute_threshold, compute_list, compute_list, Zp, [params.op_id + ':open:' + reject_count], paramsCopy);
            promises = [promise1, promise2];
          }

          if (lower_bound.toString() !== '0' && bitLength > 1) {
            // bits.cadd is free for arrays of length 1!
            paramsCopy['op_id'] = params.op_id + ':preprocessing:bits.cadd';
            var promise3 = jiff.__preprocessing('bits.cadd', 1, protocols, params.compute_threshold, compute_list, compute_list, Zp, [params.op_id + ':bits.cadd:' + reject_count], paramsCopy);
            promises.push(promise3);
          }
          Promise.all(promises).then(online_resample);
        }
      })(0);

      return result;
    };

    /**
     * Wrapper for when doing rejection sampling during pre processing.
     * @method rejection_sampling
     * @memberof jiff-instance.protocols.bits
     * @instance
     * @param {number} [threshold=receivers_list.length] - the threshold of the resulting shares after sampling.
     * @param {Array} [receivers_list=all_parties] - array of party ids that want to receive the sampling shares, by default, this includes all parties.
     * @param {Array} [compute_list=all_parties] - array of party ids that will perform this protocol, by default, this includes all parties.
     * @param {number} [Zp=jiff-instance.Zp] - the mod (if null then the default Zp for the instance is used).
     * @param {string} [op_id=auto_gen()] - the operation id which is used to identify this operation.
     *                         This id must be unique, and must be passed by all parties to the same instruction, to
     *                         ensure that corresponding instructions across different parties are matched correctly.
     * @param {object} [params={}] - an object containing extra parameters passed by the user.
     *                               Expects:
     *                               - an optional number compute_threshold parameter, which specifies threshold used
     *                               during the protocol execution. By default, this is (|compute_list|+1)/2.
     *                               - optional 'lower_bound' and 'upper_bound' numeric parameters, default to 0 and Zp respectively.
     *                               - op_id, the base op_id to tag operations inside this protocol with, defaults to auto generated.
     * @param {object} [protocols=defaults] - the protocols to use for preprocessing, any protocol(s) not provided will be replaced with defaults.
     * @returns {Object} an object containing keys: 'share', and 'promise'. The promise is resolved when the rejection sampling is completed.
     *                   The object is consumed by <jiff_instance>.preprocessing:
     *                        - 'share' attribute contains the resulting array of secret shared bits representing the sampled value, and is stored in the preprocessing table internally.
     *                        - The promise is consumed and a new promise is returned by <jiff_instance>.preprocessing that is resolved after this returned promise (and all other promise generated by that .preprocessing call) are resolved.
     */
    jiff.protocols.bits.rejection_sampling = function (threshold, receivers_list, compute_list, Zp, params, protocols) {
      // rejection sampling is both an internal preprocessing function and also user facing
      // must have defaults for simplicity of user-facing API!
      protocols = Object.assign({}, jiff.default_preprocessing_protocols, protocols);

      // Defaults (only for user facing case)
      if (compute_list == null) {
        compute_list = [];
        for (var p = 1; p <= jiff.party_count; p++) {
          compute_list.push(p);
        }
      }
      if (receivers_list == null) {
        receivers_list = [];
        for (p = 1; p <= jiff.party_count; p++) {
          receivers_list.push(p);
        }
      }
      threshold = threshold != null ? threshold : receivers_list.length;
      Zp = Zp != null ? Zp : jiff.Zp;
      params = params != null ? params : {};

      // If not a compute nor receiver party, return null (only for user facing case)
      if (compute_list.indexOf(jiff.id) === -1 && receivers_list.indexOf(jiff.id) === -1) {
        return null;
      }

      // More defaults (both user-facing and internal preprocessing)
      var lower_bound = params.lower_bound != null ? params.lower_bound : 0;
      var upper_bound = params.upper_bound != null ? params.upper_bound : Zp;
      if (params.compute_threshold == null) { // honest majority BGW
        params.compute_threshold = Math.floor((compute_list.length + 1) / 2);
      }
      if (params.op_id == null) { // op_id must be unique to both compute and receivers
        params.op_id = jiff.counters.gen_op_id2('rejection_sampling', receivers_list, compute_list);
      }
      var op_id = params.op_id;

      // execute protocol
      var result = [];
      var promises = [];
      if (compute_list.indexOf(jiff.id) > -1) {
        result = __rejection_sampling(lower_bound, upper_bound, compute_list, Zp, params, protocols);
        for (var j = 0; j < result.length; j++) {
          promises.push(result[j].promise);
        }
      }

      // fix threshold
      for (var i = 0; i < result.length; i++) {
        result[i] = jiff.protocols.reshare(result[i], threshold, receivers_list, compute_list, Zp, op_id + ':reshare:' + i);
        if (receivers_list.indexOf(jiff.id) > -1) {
          promises[i] = result[i].promise;
        }
      }

      // return output
      if (receivers_list.indexOf(jiff.id) === -1) {
        result = null;
      }
      return { share: result, promise: Promise.all(promises) };
    };

    /**
     * Compute sum of bitwise secret shared number and a constant.
     * @method cadd
     * @memberof jiff-instance.protocols.bits
     * @instance
     * @param {SecretShare[]} bits - the bit wise secret shares.
     * @param {number} constant - the constant.
     * @param {string} [op_id=<auto-generate-id>] - the base operation id to use when generating unique ids for communication.
     *                                              default value should suffice when the code of all parties executes all instructions
     *                                              in the same exact order, otherwise, a unique base name is needed here.
     * @returns {SecretShare[]} bitwise sharing of the result. Note that the length here will be max(|bits|, |constant|) + 1
     *                          in case of potential overflow / carry.
     */
    jiff.protocols.bits.cadd = function (bits, constant, op_id) {
      if (!(bits[0].isConstant(constant))) {
        throw new Error('parameter should be a number (bits.cadd)');
      }
      if (op_id == null) {
        op_id = jiff.counters.gen_op_id('bits.cadd', bits[0].holders);
      }

      // copy to avoid aliasing problems during execution
      bits = bits.slice();

      // decompose constant into bits
      var constant_bits = jiff.helpers.number_to_bits(constant, bits.length); // pads with zeros to bits.length

      // initialize results
      var result = many_secret_shares(jiff, Math.max(constant_bits.length, bits.length), bits[0].holders, bits[0].threshold, bits[0].Zp);
      var deferreds = result.deferreds;
      result = result.shares;

      var sum = bits[0].icxor_bit(constant_bits[0]);
      var carry = bits[0].icmult(constant_bits[0]);

      // put initial bit at head of result array
      result.unshift(sum);
      deferreds.unshift(null);

      // compute sum one bit at a time, propagating carry
      bit_combinator(deferreds[deferreds.length-1], 1, deferreds.length-1, carry, function (i, carry) {
        var sum;
        if (i < bits.length) {
          var and = bits[i].icmult(constant_bits[i]);
          var xor = bits[i].icxor_bit(constant_bits[i]);
          var xorAndCarry = xor.ismult(carry, op_id + ':smult:' + (i - 1));

          sum = xor.isxor_bit(carry, op_id + ':sxor_bit:' + (i - 1));
          carry = and.isadd(xorAndCarry); // cheap or, xor and and cannot both be true!
        } else {
          // bits.length <= i < constant_bits.length
          // and is zero, xor is constant_bits[i]
          sum = carry.icxor_bit(constant_bits[i]);
          carry = carry.icmult(constant_bits[i]);
        }

        sum.wThen(deferreds[i].resolve);
        return carry;
      });

      return result;
    };

    /**
     * Compute [secret bits] - [constant bits].
     * @method csubl
     * @memberof jiff-instance.protocols.bits
     * @instance
     * @param {number} constant - the constant.
     * @param {SecretShare[]} bits - the bit wise secret shares.
     * @param {string} [op_id=<auto-generate-id>] - the base operation id to use when generating unique ids for communication.
     *                                              default value should suffice when the code of all parties executes all instructions
     *                                              in the same exact order, otherwise, a unique base name is needed here.
     * @returns {SecretShare[]} bitwise sharing of the result. Note that the length of the returned result is |bits|+1, where
     *                          the bit at index 0 is the least significant bit. The bit at index 1 is the most significant bit,
     *                          and the bit at index |bits| is 1 if the result overflows, or 0 otherwise.
     */
    jiff.protocols.bits.csubl = function (bits, constant, op_id) {
      if (!(bits[0].isConstant(constant))) {
        throw new Error('parameter should be a number (bits.csubl)');
      }
      if (op_id == null) {
        op_id = jiff.counters.gen_op_id('bits.csubl', bits[0].holders);
      }

      // copy to avoid aliasing problems during execution
      bits = bits.slice();

      // decompose constant into bits
      var constant_bits = jiff.helpers.number_to_bits(constant, bits.length); // pads with zeros to bits.length

      // initialize results
      var result = many_secret_shares(jiff, Math.max(constant_bits.length, bits.length), bits[0].holders, bits[0].threshold, bits[0].Zp);
      var deferreds = result.deferreds;
      result = result.shares;

      var diff = bits[0].icxor_bit(constant_bits[0]);
      var borrow = bits[0].inot().icmult(constant_bits[0]);

      // put initial bit at head of result array
      result.unshift(diff);
      deferreds.unshift(null);

      // compute diff one bit at a time, propagating borrow
      bit_combinator(deferreds[deferreds.length-1], 1, deferreds.length-1, borrow, function (i, borrow) {
        var diff;
        if (i < bits.length) {
          var xor = bits[i].icxor_bit(constant_bits[i]);
          var andNot = bits[i].inot().icmult(constant_bits[i]);

          // save and update borrow
          diff = xor.isxor_bit(borrow, op_id + ':sxor_bit:' + (i - 1));
          borrow = xor.inot().ismult(borrow, op_id + ':smult:' + (i - 1));
          borrow = borrow.isadd(andNot);
        } else {
          // bits.length <= i < constant_bits.length
          // xor and andNot are equal to the constant bit value since secret bit is always zero here
          diff = borrow.icxor_bit(constant_bits[i]);
          borrow = borrow.issub(borrow.icmult(constant_bits[i]));
          borrow = borrow.icadd(constant_bits[i]);
        }

        diff.wThen(deferreds[i].resolve);
        return borrow;
      });

      return result;
    };

    /**
     * Compute [constant bits] - [secret bits].
     * @method csubr
     * @memberof jiff-instance.protocols.bits
     * @instance
     * @param {number} constant - the constant.
     * @param {SecretShare[]} bits - the bit wise secret shares.
     * @param {string} [op_id=<auto-generate-id>] - the base operation id to use when generating unique ids for communication.
     *                                              default value should suffice when the code of all parties executes all instructions
     *                                              in the same exact order, otherwise, a unique base name is needed here.
     * @returns {SecretShare[]} bitwise sharing of the result. Note that the length of the returned result is |bits|+1, where
     *                          the bit at index 0 is the least significant bit. The bit at index 1 is the most significant bit,
     *                          and the bit at index |bits| is 1 if the result overflows, or 0 otherwise.
     */
    jiff.protocols.bits.csubr = function (constant, bits, op_id) {
      if (!(bits[0].isConstant(constant))) {
        throw new Error('parameter should be a number (bits.csubr)');
      }
      if (op_id == null) {
        op_id = jiff.counters.gen_op_id('bits.csubr', bits[0].holders);
      }

      // copy to avoid aliasing problems during execution
      bits = bits.slice();

      // decompose constant into bits
      var constant_bits = jiff.helpers.number_to_bits(constant, bits.length); // pads with zeros to bits.length

      // initialize results
      var result = many_secret_shares(jiff, Math.max(constant_bits.length, bits.length), bits[0].holders, bits[0].threshold, bits[0].Zp);
      var deferreds = result.deferreds;
      result = result.shares;

      var diff = bits[0].icxor_bit(constant_bits[0]);
      var borrow = bits[0].issub(bits[0].icmult(constant_bits[0]));

      // put initial bit at head of result array
      result.unshift(diff);
      deferreds.unshift(null);

      // compute diff one bit at a time, propagating borrow
      bit_combinator(deferreds[deferreds.length-1], 1, deferreds.length-1, borrow, function (i, borrow) {
        var diff;
        if (i < bits.length) {
          var xor = bits[i].icxor_bit(constant_bits[i]);
          var andNot = bits[i].issub(bits[i].icmult(constant_bits[i]));

          // save and update borrow
          diff = xor.isxor_bit(borrow, op_id + ':sxor_bit:' + (i - 1));
          borrow = xor.inot().ismult(borrow, op_id + ':smult:' + (i - 1));
          borrow = borrow.isadd(andNot);
        } else {
          // andNot is zero and xor is equal to the constant bit since secret bit is always zero here.
          diff = borrow.icxor_bit(constant_bits[i]);
          borrow = borrow.icmult(constant_bits[i] === 1 ? 0 : 1);
        }

        diff.wThen(deferreds[i].resolve);
        return borrow;
      });

      return result;
    };

    /**
     *
     * Compute [secret bits1] + [secret bits2].
     * @method sadd
     * @memberof jiff-instance.protocols.bits
     * @instance
     * @param {SecretShare[]} bits1 - the first bitwise shared number: array of secrets with index 0 being least significant bit.
     * @param {SecretShare[]} bits2 - the second bitwise shared number (length may be different).
     * @param {string} [op_id=<auto-generate-id>] - the base operation id to use when generating unique ids for communication.
     *                                              default value should suffice when the code of all parties executes all instructions
     *                                              in the same exact order, otherwise, a unique base name is needed here.
     * @returns {SecretShare[]} bitwise sharing of the result. Note that the length of the returned result is |bits|+1, where
     *                          the bit at index 0 is the least significant bit.
     */
    jiff.protocols.bits.sadd = function (bits1, bits2, op_id) {
      if (op_id == null) {
        op_id = jiff.counters.gen_op_id('bits.sadd', bits1[0].holders);
      }

      // copy to avoid aliasing problems during execution
      bits1 = bits1.slice();
      bits2 = bits2.slice();

      var tmp = bits1.length > bits2.length ? bits1 : bits2;
      bits2 = bits1.length > bits2.length ? bits2 : bits1; // shortest array
      bits1 = tmp; // longest array

      // initialize results
      var result = many_secret_shares(jiff, bits1.length, bits1[0].holders, Math.max(bits1[0].threshold, bits2[0].threshold), bits1[0].Zp);
      var deferreds = result.deferreds;
      result = result.shares;

      var sum = bits1[0].isxor_bit(bits2[0], op_id + ':sxor_bit:initial');
      var carry = bits1[0].ismult(bits2[0], op_id + ':smult:initial');

      // put initial bit at head of result array
      result.unshift(sum);
      deferreds.unshift(null);

      // compute sum one bit at a time, propagating carry
      bit_combinator(deferreds[deferreds.length-1], 1, deferreds.length-1, carry, function (i, carry) {
        var sum;
        if (i < bits2.length) {
          var and = bits1[i].ismult(bits2[i], op_id + ':smult1:' + (i - 1));
          var xor = bits1[i].isxor_bit(bits2[i], op_id + ':sxor_bit1:' + (i - 1));
          var xorAndCarry = xor.ismult(carry, op_id + ':smult2:' + (i - 1));

          sum = xor.isxor_bit(carry, op_id + ':sxor_bit2:' + (i - 1));
          carry = and.isadd(xorAndCarry); // cheap or, xor and and cannot both be true!
        } else {
          // and is always zero, xor is equal to bits1[i]
          sum = bits1[i].isxor_bit(carry, op_id + ':sxor_bit1:' + (i - 1));
          carry = bits1[i].ismult(carry, op_id + ':smult1:' + (i - 1));
        }

        sum.wThen(deferreds[i].resolve);
        return carry;
      });

      return result;
    };

    /**
     * Compute [secret bits1] - [secret bits2].
     * @method ssub
     * @memberof jiff-instance.protocols.bits
     * @instance
     * @param {SecretShare[]} bits1 - first bitwise secret shared number: lower indices represent less significant bits.
     * @param {SecretShare[]} bits2 - second bitwise secret shared number (length may be different).
     * @param {string} [op_id=<auto-generate-id>] - the base operation id to use when generating unique ids for communication.
     *                                              default value should suffice when the code of all parties executes all instructions
     *                                              in the same exact order, otherwise, a unique base name is needed here.
     * @returns {SecretShare[]} bitwise sharing of the result. Note that the length of the returned result is |bits|+1, where
     *                          the bit at index 0 is the least significant bit. The bit at index 1 is the most significant bit,
     *                          and the bit at index |bits| is 1 if the result overflows, or 0 otherwise.
     */
    jiff.protocols.bits.ssub = function (bits1, bits2, op_id) {
      if (op_id == null) {
        op_id = jiff.counters.gen_op_id('bits.ssub', bits1[0].holders);
      }

      // copy to avoid aliasing problems during execution
      bits1 = bits1.slice();
      bits2 = bits2.slice();

      // initialize results
      var result = many_secret_shares(jiff, Math.max(bits1.length, bits2.length), bits1[0].holders, Math.max(bits1[0].threshold, bits2[0].threshold), bits1[0].Zp);
      var deferreds = result.deferreds;
      result = result.shares;

      var diff = bits1[0].isxor_bit(bits2[0], op_id + ':sxor_bit:initial');
      var borrow = bits1[0].inot().ismult(bits2[0], op_id + ':smult:initial');

      // put initial bit at head of result array
      result.unshift(diff);
      deferreds.unshift(null);

      // compute diff one bit at a time, propagating borrow
      bit_combinator(deferreds[deferreds.length-1], 1, deferreds.length-1, borrow, function (i, borrow) {
        var diff;
        if (i < bits1.length && i < bits2.length) {
          var xor = bits1[i].isxor_bit(bits2[i], op_id + ':sxor_bit1:' + (i - 1));
          var andNot = bits1[i].inot().ismult(bits2[i], op_id + ':smult1:' + (i - 1));

          // save and update borrow
          diff = xor.isxor_bit(borrow, op_id + ':sxor_bit2:' + (i - 1));
          borrow = xor.inot().ismult(borrow, op_id + ':smult2:' + (i - 1));
          borrow = borrow.isadd(andNot);
        } else if (i < bits1.length) {
          // xor is equal to the value of bits1[i], andNot is equal to 0, since bits[2] is all zeros here
          diff = bits1[i].isxor_bit(borrow, op_id + ':sxor_bit1:' + (i - 1));
          borrow = bits1[i].inot().ismult(borrow, op_id + ':smult1:' + (i - 1));
        } else { // i < bits2.length
          // xor and andNot are equal to the value of bits2[i]
          diff = bits2[i].isxor_bit(borrow, op_id + ':sxor_bit1:' + (i - 1));
          borrow = bits2[i].inot().ismult(borrow, op_id + ':smult1:' + (i - 1));
          borrow = borrow.isadd(bits2[i]);
        }

        diff.wThen(deferreds[i].resolve);
        return borrow;
      });

      return result;
    };

    /**
     * Compute [secret bits] * constant.
     * @method cmult
     * @memberof jiff-instance.protocols.bits
     * @instance
     * @param {SecretShare[]} bits - bitwise shared secret to multiply: lower indices represent less significant bits.
     * @param {number} constant - constant to multiply with.
     * @param {string} [op_id=<auto-generate-id>] - the base operation id to use when generating unique ids for communication.
     *                                              default value should suffice when the code of all parties executes all instructions
     *                                              in the same exact order, otherwise, a unique base name is needed here.
     * @returns {SecretShare[]} bitwise sharing of the result, the length of the result will be bits.length + ceil(log2(constant)), except
     *                          if constant is zero, the result will then be [ zero share ].
     */
    jiff.protocols.bits.cmult = function (bits, constant, op_id) {
      if (!(bits[0].isConstant(constant))) {
        throw new Error('parameter should be a number (bits.cmult)');
      }
      if (op_id == null) {
        op_id = jiff.counters.gen_op_id('bits.cmult', bits[0].holders);
      }

      // copy to avoid aliasing problems during execution
      bits = bits.slice();

      // decompose constant into bits
      var constant_bits = jiff.helpers.number_to_bits(constant); // do not pad

      // Initialize the result
      var result = many_secret_shares(jiff, bits.length + constant_bits.length, bits[0].holders, bits[0].threshold, bits[0].Zp);
      var deferreds = result.deferreds;
      result = result.shares;

      // Resolve result when ready
      var final_deferred = new jiff.helpers.Deferred();
      final_deferred.promise.then(resolve_many_secrets.bind(null, deferreds));

      // get useless share of zero (just for padding)
      var zero = jiff.secret_share(jiff, true, null, 0, bits[0].holders, bits[0].threshold, bits[0].Zp);
      var initial = [ zero ];

      // special case
      if (constant.toString() === '0') {
        return initial;
      }

      // main function
      bit_combinator(final_deferred, 0, constant_bits.length, initial, function (i, intermediate) {
        // Shift bits to create the intermediate values,
        // and sum if the corresponding bit in a is 1
        if (constant_bits[i].toString() === '1') {
          intermediate = jiff.protocols.bits.sadd(intermediate, bits, op_id + ':bits.sadd:' + i);
        }

        bits.unshift(zero);
        return intermediate;
      }, function (intermediate) {
        // promise-ify an array of intermediate results
        var promises = [];
        for (var i = 0; i < intermediate.length; i++) {
          promises.push(intermediate[i].promise);
        }
        return Promise.all(promises);
      }, function (result) {
        // identity
        return result;
      });

      return result;
    };

    /**
     * Compute [secret bits1] * [secret bits2].
     * @method smult
     * @memberof jiff-instance.protocols.bits
     * @instance
     * @param {SecretShare[]} bits1 - bitwise shared secret to multiply: lower indices represent less significant bits.
     * @param {SecretShare[]} bits2 - bitwise shared secret to multiply.
     * @param {string} [op_id=<auto-generate-id>] - the base operation id to use when generating unique ids for communication.
     *                                              default value should suffice when the code of all parties executes all instructions
     *                                              in the same exact order, otherwise, a unique base name is needed here.
     * @returns {SecretShare[]} bitwise sharing of the result, the length of the result will be bits1.length + bits2.length.
     */
    jiff.protocols.bits.smult = function (bits1, bits2, op_id) {
      if (op_id == null) {
        op_id = jiff.counters.gen_op_id('bits.smult', bits1[0].holders);
      }

      // copy to avoid aliasing problems during execution
      bits1 = bits1.slice();
      bits2 = bits2.slice();

      // bits1 will be the longest array, bits2 will be the shortest
      var tmp = bits1.length > bits2.length ? bits1 : bits2;
      bits2 = bits1.length > bits2.length ? bits2 : bits1;
      bits1 = tmp;

      // Initialize the result
      var offset = bits2.length === 1 ? -1 : 0;
      var result = many_secret_shares(jiff, bits1.length + bits2.length + offset, bits1[0].holders, Math.max(bits1[0].threshold, bits2[0].threshold), bits1[0].Zp);
      var deferreds = result.deferreds;
      result = result.shares;

      // Resolve result when ready
      var final_deferred = new jiff.helpers.Deferred();
      final_deferred.promise.then(resolve_many_secrets.bind(null, deferreds));

      // Loop over *shortest* array one bit at a time
      bit_combinator(final_deferred, 0, bits2.length, bits2, function (i, intermediate) {
        var this_bit = bits2[i];
        var bit_mult = []; // add bits1 or 0 to the result according to this bit
        for (var j = 0; j < bits1.length; j++) {
          bit_mult[j] = this_bit.iif_else(bits1[j], 0, op_id + ':if_else:' + i + ':' + j);
        }
        bits1.unshift(0); // increase magnitude

        if (i === 0) {
          return bit_mult;
        }

        return jiff.protocols.bits.sadd(intermediate, bit_mult, op_id + ':bits.sadd:' + i);
      }, function (intermediate) {
        // promise-ify an array of intermediate results
        var promises = [];
        for (var i = 0; i < intermediate.length; i++) {
          promises.push(intermediate[i].promise);
        }
        return Promise.all(promises);
      }, function (result) {
        // identity
        return result;
      });

      return result;
    };

    /**
     * Checks whether the two given bitwise secret shared numbers are equal.
     * @method seq
     * @memberof jiff-instance.protocols.bits
     * @instance
     * @param {SecretShare[]} bits1 - an array of secret shares of bits, starting from least to most significant bits.
     * @param {SecretShare[]} bits2 - the second bitwise shared number.
     * @param {string} [op_id=<auto-generate-id>] - the base operation id to use when generating unique ids for multiplications.
     *                                              default value should suffice when the code of all parties executes all instructions
     *                                              in the same exact order, otherwise, a unique base name is needed here.
     * @returns {SecretShare} a secret share of 1 if bits are equal, 0 otherwise.
     */
    jiff.protocols.bits.seq = function (bits1, bits2, op_id) {
      if (op_id == null) {
        op_id = jiff.counters.gen_op_id('bits.seq', bits1[0].holders);
      }
      return jiff.protocols.bits.sneq(bits1, bits2, op_id).inot();
    };

    /**
     * Checks whether the two given bitwise secret shared numbers are not equal.
     * @method sneq
     * @memberof jiff-instance.protocols.bits
     * @instance
     * @param {SecretShare[]} bits1 - an array of secret shares of bits, starting from least to most significant bits.
     * @param {SecretShare[]} bits2 - the second bitwise shared number.
     * @param {string} [op_id=<auto-generate-id>] - the base operation id to use when generating unique ids for multiplications.
     *                                              default value should suffice when the code of all parties executes all instructions
     *                                              in the same exact order, otherwise, a unique base name is needed here.
     * @returns {SecretShare} a secret share of 1 if bits are not equal, 0 otherwise.
     */
    jiff.protocols.bits.sneq = function (bits1, bits2, op_id) {
      if (op_id == null) {
        op_id = jiff.counters.gen_op_id('bits.sneq', bits1[0].holders);
      }

      var tmp = bits1.length > bits2.length ? bits1 : bits2;
      bits2 = bits1.length > bits2.length ? bits2 : bits1; // shortest array
      bits1 = tmp; // longest array

      // copy to avoid aliasing problems during execution
      bits1 = bits1.slice();
      bits2 = bits2.slice();

      // initialize result
      var deferred = new jiff.helpers.Deferred();
      var result = jiff.secret_share(jiff, false, deferred.promise, undefined, bits1[0].holders, Math.max(bits1[0].threshold, bits2[0].threshold), bits1[0].Zp);

      // big or of bitwise XORs
      var initial = bits1[0].isxor_bit(bits2[0], op_id + ':sxor_bit:initial');
      bit_combinator(deferred, 1, bits1.length, initial, function (i, prev) {
        var next;
        if (i < bits2.length) {
          var xor = bits1[i].isxor_bit(bits2[i], op_id + ':sxor_bit:' + (i - 1));
          next = prev.isor_bit(xor, op_id + ':sor_bit:' + (i - 1));
        } else {
          // xor is equal to bits1[i] since bits2[i] is zero
          next = prev.isor_bit(bits1[i], op_id + ':sor_bit:' + (i - 1));
        }
        return next;
      });

      return result;
    };

    /**
     * Checks whether the first given bitwise secret shared number is greater than the second bitwise secret shared number.
     * @method sgt
     * @memberof jiff-instance.protocols.bits
     * @instance
     * @param {SecretShare[]} bits1 - an array of secret shares of bits, starting from least to most significant bits.
     * @param {SecretShare[]} bits2 - the second bitwise shared number.
     * @param {string} [op_id=<auto-generate-id>] - the base operation id to use when generating unique ids for multiplications.
     *                                              default value should suffice when the code of all parties executes all instructions
     *                                              in the same exact order, otherwise, a unique base name is needed here.
     * @returns {SecretShare} a secret share of 1 if the first number is greater than the second, 0 otherwise.
     */
    jiff.protocols.bits.sgt = function (bits1, bits2, op_id) {
      if (op_id == null) {
        op_id = jiff.counters.gen_op_id('bits.sgt', bits1[0].holders);
      }

      var gteq = jiff.protocols.bits.sgteq(bits1, bits2, op_id + ':bits.sgteq');
      var neq = jiff.protocols.bits.sneq(bits1, bits2, op_id + ':bits.sneq');
      return gteq.ismult(neq, op_id + ':smult');
    };

    /**
     * Checks whether the first given bitwise secret shared number is greater than or equal to the second bitwise secret shared number.
     * @method sgteq
     * @memberof jiff-instance.protocols.bits
     * @instance
     * @param {SecretShare[]} bits1 - an array of secret shares of bits, starting from least to most significant bits.
     * @param {SecretShare[]} bits2 - the second bitwise shared number.
     * @param {string} [op_id=<auto-generate-id>] - the base operation id to use when generating unique ids for multiplications.
     *                                              default value should suffice when the code of all parties executes all instructions
     *                                              in the same exact order, otherwise, a unique base name is needed here.
     * @returns {SecretShare} a secret share of 1 if the first number is greater or equal to the second, 0 otherwise.
     */
    jiff.protocols.bits.sgteq = function (bits1, bits2, op_id) {
      if (op_id == null) {
        op_id = jiff.counters.gen_op_id('bits.sgteq', bits1[0].holders);
      }

      // copy to avoid aliasing problems during execution
      bits1 = bits1.slice();
      bits2 = bits2.slice();

      // initialize result
      var deferred = new jiff.helpers.Deferred();
      var result = jiff.secret_share(jiff, false, deferred.promise, undefined, bits1[0].holders, Math.max(bits1[0].threshold, bits2[0].threshold), bits1[0].Zp);

      // Subtract bits2 from bits1, only keeping track of borrow
      var borrow = bits1[0].inot().ismult(bits2[0], op_id + ':smult:initial');
      var n = Math.max(bits1.length, bits2.length);
      bit_combinator(deferred, 1, n, borrow, function (i, borrow) {
        if (i < bits1.length && i < bits2.length) {
          var xor = bits1[i].isxor_bit(bits2[i], op_id + ':sxor_bit1:' + (i - 1));
          var andNot = bits1[i].inot().ismult(bits2[i], op_id + ':smult1:' + (i - 1));

          // save and update borrow
          borrow = xor.inot().ismult(borrow, op_id + ':smult2:' + (i - 1));
          borrow = borrow.isadd(andNot);
        } else if (i < bits1.length) {
          // xor is equal to the value of bits1[i], andNot is equal to 0, since bits[2] is all zeros here
          borrow = bits1[i].inot().ismult(borrow, op_id + ':smult1:' + (i - 1));
        } else { // i < bits2.length
          // xor and andNot are equal to the value of bits2[i]
          borrow = bits2[i].inot().ismult(borrow, op_id + ':smult1:' + (i - 1));
          borrow = borrow.isadd(bits2[i]);
        }

        return borrow;
      });

      return result.inot();
    };

    /**
     * Checks whether the first given bitwise secret shared number is less than the second bitwise secret shared number.
     * @method slt
     * @memberof jiff-instance.protocols.bits
     * @instance
     * @param {SecretShare[]} bits1 - an array of secret shares of bits, starting from least to most significant bits.
     * @param {SecretShare[]} bits2 - the second bitwise shared number.
     * @param {string} [op_id=<auto-generate-id>] - the base operation id to use when generating unique ids for multiplications.
     *                                              default value should suffice when the code of all parties executes all instructions
     *                                              in the same exact order, otherwise, a unique base name is needed here.
     * @returns {SecretShare} a secret share of 1 if the first number is less than the second, 0 otherwise.
     */
    jiff.protocols.bits.slt = function (bits1, bits2, op_id) {
      if (op_id == null) {
        op_id = jiff.counters.gen_op_id('bits.slt', bits1[0].holders);
      }
      var result = jiff.protocols.bits.sgteq(bits1, bits2, op_id);
      return result.inot();
    };

    /**
     * Checks whether the first given bitwise secret shared number is less or equal to the second bitwise secret shared number.
     * @method slteq
     * @memberof jiff-instance.protocols.bits
     * @instance
     * @param {SecretShare[]} bits1 - an array of secret shares of bits, starting from least to most significant bits.
     * @param {SecretShare[]} bits2 - the second bitwise shared number.
     * @param {string} [op_id=<auto-generate-id>] - the base operation id to use when generating unique ids for multiplications.
     *                                              default value should suffice when the code of all parties executes all instructions
     *                                              in the same exact order, otherwise, a unique base name is needed here.
     * @returns {SecretShare} a secret share of 1 if the first number is less than or equal to the second, 0 otherwise.
     */
    jiff.protocols.bits.slteq = function (bits1, bits2, op_id) {
      if (op_id == null) {
        op_id = jiff.counters.gen_op_id('bits.slteq', bits1[0].holders);
      }
      var result = jiff.protocols.bits.sgt(bits1, bits2, op_id);
      return result.inot();
    };

    /**
     * Computes integer division of [secret bits 1] / [secret bits 2].
     * @method sdiv
     * @memberof jiff-instance.protocols.bits
     * @instance
     * @param {SecretShare[]} bits1 - an array of secret shares of bits, starting from least to most significant bits.
     * @param {SecretShare[]} bits2 - the second bitwise shared number.
     * @param {string} [op_id=<auto-generate-id>] - the base operation id to use when generating unique ids for multiplications.
     *                                              default value should suffice when the code of all parties executes all instructions
     *                                              in the same exact order, otherwise, a unique base name is needed here.
     * @returns {{quotient: SecretShare[], remainder: SecretShare[]}} the quotient and remainder bits arrays, note that
     *                                                                the quotient array has the same length as bits1,
     *                                                                and the remainder array has the same length as bits2 or bits1, whichever is smaller.
     *                                                                Note: if bits2 represent 0, the returned result is the maximum
     *                                                                number that fits in the number of bits (all 1), and the remainder
     *                                                                is equal to bits1.
     */
    jiff.protocols.bits.sdiv = function (bits1, bits2, op_id) {
      if (op_id == null) {
        op_id = jiff.counters.gen_op_id('bits.sdiv', bits1[0].holders);
      }

      // copy to avoid aliasing problems during execution
      bits1 = bits1.slice();
      bits2 = bits2.slice();

      // Initialize the result
      var quotient = many_secret_shares(jiff, bits1.length, bits1[0].holders, Math.max(bits1[0].threshold, bits2[0].threshold), bits1[0].Zp);
      var quotientDeferreds = quotient.deferreds;
      quotient = quotient.shares;

      var remainder = many_secret_shares(jiff, Math.min(bits1.length, bits2.length), bits1[0].holders, Math.max(bits1[0].threshold, bits2[0].threshold), bits1[0].Zp);
      var remainderDeferreds = remainder.deferreds;
      remainder = remainder.shares;

      // Resolve result when ready
      var final_deferred = new jiff.helpers.Deferred();
      final_deferred.promise.then(function (result) {
        resolve_many_secrets(remainderDeferreds, result);
      });

      var initial = []; // initial remainder
      bit_combinator(final_deferred, bits1.length-1, -1, initial, function (i, _remainder) {
        var iterationCounter = (bits1.length - i - 1);

        // add bit i to the head of remainder (least significant bit)
        _remainder.unshift(bits1[i]);

        // Get the next bit of the quotient
        // and conditionally subtract b from the
        // intermediate remainder to continue
        var sub = jiff.protocols.bits.ssub(_remainder, bits2, op_id + ':bits.ssub:' + iterationCounter);
        var noUnderflow = sub.pop().inot(); // get the overflow bit, sub is now the result of subtraction

        // Get next bit of quotient
        noUnderflow.wThen(quotientDeferreds[i].resolve);

        // Update remainder
        for (var j = 0; j < _remainder.length; j++) {
          // note, if noUnderflow, then |# bits in sub| <= |# bits in remainder|
          _remainder[j] = noUnderflow.iif_else(sub[j], _remainder[j], op_id + ':if_else:' + iterationCounter + ':' + j);
        }

        // Remainder cannot be greater than divisor at this point
        while (_remainder.length > remainder.length) {
          _remainder.pop();
        }

        return _remainder;
      }, function (intermediate) {
        // promise-ify an array of intermediate results
        var promises = [];
        for (var i = 0; i < intermediate.length; i++) {
          promises.push(intermediate[i].promise);
        }
        return Promise.all(promises);
      }, function (result) {
        // identity
        return result;
      });

      return {quotient: quotient, remainder: remainder}
    };

    /**
     * Computes integer division of [secret bits] / constant.
     * @method cdivl
     * @memberof jiff-instance.protocols.bits
     * @instance
     * @param {SecretShare[]} bits - numerator: an array of secret shares of bits, starting from least to most significant bits.
     * @param {number} constant - the denominator number.
     * @param {string} [op_id=<auto-generate-id>] - the base operation id to use when generating unique ids for multiplications.
     *                                              default value should suffice when the code of all parties executes all instructions
     *                                              in the same exact order, otherwise, a unique base name is needed here.
     * @returns {{quotient: SecretShare[], remainder: SecretShare[]}} the quotient and remainder bits arrays, note that
     *                                                                the quotient array has the same length as bits,
     *                                                                and the remainder array has the same length as
     *                                                                constant or bits, whichever is smaller.
     * @throws if constant is 0.
     */
    jiff.protocols.bits.cdivl = function (bits, constant, op_id) {
      if (!(bits[0].isConstant(constant))) {
        throw new Error('parameter should be a number (bits.cdivl)');
      }
      if (op_id == null) {
        op_id = jiff.counters.gen_op_id('bits.cdivl', bits[0].holders);
      }

      if (constant.toString() === '0') {
        throw new Error('constant cannot be 0 in bits.cdiv');
      }

      // copy to avoid aliasing problems during execution
      bits = bits.slice();

      // special case, divide by 1
      if (constant.toString() === '1') {
        return {
          quotient: bits,
          remainder: [jiff.secret_share(jiff, true, null, 0, bits[0].holders, bits[0].threshold, bits[0].Zp)]
        }
      }

      // Initialize the result
      var quotient = many_secret_shares(jiff, bits.length, bits[0].holders, bits[0].threshold, bits[0].Zp);
      var quotientDeferreds = quotient.deferreds;
      quotient = quotient.shares;

      var constantLessBits = jiff.helpers.ceil(jiff.helpers.bLog(constant, 2));
      constantLessBits = parseInt(constantLessBits.toString(), 10);
      var remainder = many_secret_shares(jiff, Math.min(constantLessBits, bits.length), bits[0].holders, bits[0].threshold, bits[0].Zp);
      var remainderDeferreds = remainder.deferreds;
      remainder = remainder.shares;

      // Resolve result when ready
      var final_deferred = new jiff.helpers.Deferred();
      final_deferred.promise.then(resolve_many_secrets.bind(null, remainderDeferreds));

      var initial = []; // initial remainder
      bit_combinator(final_deferred, bits.length-1, -1, initial, function (i, _remainder) {
        var iterationCounter = (bits.length - i - 1);

        // add bit i to the head of remainder (least significant bit)
        _remainder.unshift(bits[i]);

        // Get the next bit of the quotient
        // and conditionally subtract b from the
        // intermediate remainder to continue
        var sub = jiff.protocols.bits.csubl(_remainder, constant, op_id + ':bits.csubl:' + iterationCounter);
        var noUnderflow = sub.pop().inot(); // get the overflow bit, sub is now the result of subtraction

        // Get next bit of quotient
        noUnderflow.wThen(quotientDeferreds[i].resolve);

        // Update remainder
        for (var j = 0; j < _remainder.length; j++) {
          // note, if noUnderflow, then |# bits in sub| <= |# bits in remainder|
          _remainder[j] = noUnderflow.iif_else(sub[j], _remainder[j], op_id + ':if_else:' + iterationCounter + ':' + j);
        }

        // Remainder cannot be greater than constant at this point
        while (_remainder.length > remainder.length) {
          _remainder.pop();
        }

        return _remainder;
      }, function (intermediate) {
        // promise-ify an array of intermediate results
        var promises = [];
        for (var i = 0; i < intermediate.length; i++) {
          promises.push(intermediate[i].promise);
        }
        return Promise.all(promises);
      }, function (result) {
        // identity
        return result;
      });

      return {quotient: quotient, remainder: remainder};
    };

    /**
     * Computes integer division of constant / [secret bits].
     * @method cdivr
     * @memberof jiff-instance.protocols.bits
     * @instance
     * @param {number} constant - the numerator number.
     * @param {SecretShare[]} bits - denominator: an array of secret shares of bits, starting from least to most significant bits.
     * @param {string} [op_id=<auto-generate-id>] - the base operation id to use when generating unique ids for multiplications.
     *                                              default value should suffice when the code of all parties executes all instructions
     *                                              in the same exact order, otherwise, a unique base name is needed here.
     * @returns {{quotient: SecretShare[], remainder: SecretShare[]}} the quotient and remainder bits arrays, note that
     *                                                                the quotient array has the same length as the number of bits in constant.
     *                                                                and the remainder array has the same length as bits or constant, whichever is smaller.
     *                                                                Note: if bits represent 0, the returned result is the maximum
     *                                                                number that fits in its bits (all 1), and the remainder
     *                                                                is equal to constant.
     */
    jiff.protocols.bits.cdivr = function (constant, bits, op_id) {
      if (!(bits[0].isConstant(constant))) {
        throw new Error('parameter should be a number (bits.cdivr)');
      }
      if (op_id == null) {
        op_id = jiff.counters.gen_op_id('bits.cdivr', bits[0].holders);
      }

      // copy to avoid aliasing problems during execution
      bits = bits.slice();

      // do not pad
      var constant_bits = jiff.helpers.number_to_bits(constant);

      // Initialize the result
      var quotient = many_secret_shares(jiff, constant_bits.length, bits[0].holders, bits[0].threshold, bits[0].Zp);
      var quotientDeferreds = quotient.deferreds;
      quotient = quotient.shares;

      var remainder = many_secret_shares(jiff, Math.min(constant_bits.length, bits.length), bits[0].holders, bits[0].threshold, bits[0].Zp);
      var remainderDeferreds = remainder.deferreds;
      remainder = remainder.shares;

      // Resolve result when ready
      var final_deferred = new jiff.helpers.Deferred();
      final_deferred.promise.then(resolve_many_secrets.bind(null, remainderDeferreds));

      var initial = []; // initial remainder
      bit_combinator(final_deferred, constant_bits.length-1, -1, initial, function (i, _remainder) {
        var iterationCounter = (constant_bits.length - i - 1);

        // add bit i to the head of remainder (least significant bit)
        // turn into a secret without communication, just for typing
        var cbit_share = jiff.secret_share(jiff, true, null, constant_bits[i], bits[0].holders, bits[0].threshold, bits[0].Zp);
        _remainder.unshift(cbit_share);

        // Get the next bit of the quotient
        // and conditionally subtract b from the
        // intermediate remainder to continue
        var sub = jiff.protocols.bits.ssub(_remainder, bits, op_id + ':bits.ssub:' + iterationCounter);
        var noUnderflow = sub.pop().inot(); // get the overflow bit, sub is now the result of subtraction

        // Get next bit of quotient
        noUnderflow.wThen(quotientDeferreds[i].resolve);

        // Update remainder
        for (var j = 0; j < _remainder.length; j++) {
          // note, if noUnderflow, then |# bits in sub| <= |# bits in remainder|
          _remainder[j] = noUnderflow.iif_else(sub[j], _remainder[j], op_id + ':if_else:' + iterationCounter + ':' + j);
        }

        // cannot be bigger than divisor at this point
        while (_remainder.length > remainder.length) {
          _remainder.pop();
        }

        return _remainder;
      }, function (intermediate) {
        // promise-ify an array of intermediate results
        var promises = [];
        for (var i = 0; i < intermediate.length; i++) {
          promises.push(intermediate[i].promise);
        }
        return Promise.all(promises);
      }, function (result) {
        // identity
        return result;
      });

      return {quotient: quotient, remainder: remainder};
    };

    /**
     * Flags whether to use the server as a fallback for objects that were not pre-processed properly
     * @member {boolean} barriers
     * @memberOf jiff-instance
     * @instance
     */
    jiff.crypto_provider = (options.crypto_provider === true);

    /**
     * Stores pre-computed values (beaver triples, random bits, etc) used to aid/speed up the main processes.
     * @member {Object} preprocessing_table
     * @memberof jiff-instance
     * @instance
     */
    jiff.preprocessing_table = {};

    // internal functions for use in preprocessing function map
    var bits_count = function (threshold, receivers_list, compute_list, Zp, op_id, params) {
      var bitLength = params.bitLength;
      if (bitLength == null) {
        bitLength = Zp.toString(2).length;
      }
      return bitLength;
    };
    var constant_bits_count = function () {
      return bits_count.apply(null, arguments) - 1;
    };
    var dynamic_bits_cmult = function (dependent_op, count, protocols, threshold, receivers_list, compute_list, Zp, id_list, params) {
      // constant bit length
      var constantBits = Zp.toString(2).length;
      if (params.constantBits != null) {
        constantBits = params.constantBits;
      }
      // secret bit length
      var bitLength = params.bitLength;
      if (bitLength == null) {
        bitLength = Zp.toString(2).length;
      }
      // for every bit from constant, pre-process for one bits.sadd of the right size
      var ops = [];
      for (var i = 0; i < constantBits; i++) {
        var accLength = i === 0 ? 1 : (bitLength + i);
        ops.push({ op: 'bits.sadd', op_id: ':bits.sadd:' + i, params: {bitLengthLeft: accLength, bitLengthRight: bitLength + i}});
      }
      return ops;
    };
    var dynamic_bits_smult = function (dependent_op, count, protocols, threshold, receivers_list, compute_list, Zp, id_list, params) {
      var bitLength = params.bitLength;
      if (bitLength == null) {
        bitLength = Zp.toString(2).length;
      }

      var left = params.bitLengthLeft;
      var right = params.bitLengthRight;
      left = left != null ? left : bitLength;
      right = right != null ? right : bitLength;
      var max = Math.max(left, right);
      var min = Math.max(left, right);

      var ops = [];
      for (var i = 0; i < min; i++) {
        for (var j = 0; j < max + i; j++) {
          ops.push({ op: 'if_else', op_id: ':if_else:' + i + ':' + j });
        }
        var accLength = i === 0 ? min : (max + i);
        ops.push({ op: 'bits.sadd', op_id: ':bits.sadd:'+i, params: {bitLengthLeft: accLength, bitLengthRight: max + i}});
      }
      return ops;
    };
    var choice_bits_count = function (choice, offset) {
      if (offset == null) {
        offset = 0;
      }
      return function (threshold, receivers_list, compute_list, Zp, op_id, params) {
        var bitLength = params.bitLength;
        if (bitLength == null) {
          bitLength = Zp.toString(2).length;
        }

        var left = params.bitLengthLeft;
        var right = params.bitLengthRight;
        left = left != null ? left : bitLength;
        right = right != null ? right : bitLength;

        return choice(left, right) + offset;
      };
    };
    var decomposition_ifelse_count = function (threshold, receivers_list, compute_list, Zp, op_id, params) {
      return Zp.toString(2).length;
    };
    var dynamic_bits_sdiv = function (dependent_op, count, protocols, threshold, receivers_list, compute_list, Zp, id_list, params) {
      var bitLength = params.bitLength;
      if (bitLength == null) {
        bitLength = Zp.toString(2).length;
      }

      var left = params.bitLengthLeft;
      var right = params.bitLengthRight;
      left = left != null ? left : bitLength;
      right = right != null ? right : bitLength;
      var min = Math.min(left, right);

      var ops = [];
      for (var i = 0; i < left; i++) {
        var accLength = Math.min(i+1, min+1);
        ops.push({ op: 'bits.ssub', op_id: ':bits.ssub:'+i, params: {bitLengthLeft: accLength, bitLengthRight: right}});
        for (var j = 0; j < accLength; j++) {
          ops.push({ op: 'if_else', op_id: ':if_else:' + i + ':' + j });
        }
      }
      return ops;
    };
    var dynamic_bits_cdiv = function (dir) {
      return function (dependent_op, count, protocols, threshold, receivers_list, compute_list, Zp, id_list, params) {
        var constantBits = Zp.toString(2).length;
        if (params.constantBits != null) {
          constantBits = params.constantBits;
        }
        var bitLength = params.bitLength;
        if (bitLength == null) {
          bitLength = Zp.toString(2).length;
        }
        var min = Math.min(bitLength, constantBits);

        var ops = [];
        var loopCounter = (dir === 'left') ? bitLength : constantBits;
        for (var i = 0; i < loopCounter; i++) {
          var accLength = Math.min(i+1, min+1);
          if (dir === 'left') {
            ops.push({ op: 'bits.csubl', op_id: ':bits.csubl:' + i, params: {bitLength: accLength, constantBits: constantBits} });
          } else {
            ops.push({ op: 'bits.ssub', op_id: ':bits.ssub:' + i, params: {bitLengthLeft: accLength, bitLengthRight: bitLength} });
          }

          for (var j = 0; j < accLength; j++) {
            ops.push({ op: 'if_else', op_id: ':if_else:' + i + ':' + j });
          }
        }
        return ops;
      }
    };

    /**
     * the default preprocessing protocols for each type of value
     * @member {Object} default_preprocessing_protocols
     * @memberof jiff-instance
     * @instance
     */
    jiff.default_preprocessing_protocols = {
      generate_beaver: jiff.protocols.generate_beaver_bgw,
      generate_random_number: jiff.protocols.generate_random_number,
      sampling: jiff.protocols.bits.rejection_sampling,
      generate_random_bits: jiff.protocols.generate_random_bits,
      generate_random_bit: jiff.protocols.generate_random_bit_bgw,
      generate_zero: jiff.protocols.generate_zero,
      generate_random_and_quotient: jiff.protocols.generate_random_and_quotient
    };

    /**
     * maps all primitive operations to the other operations they are dependent on, to be traversed during preprocessing
     * @member {Object} preprocessing_function_map
     * @memberof jiff-instance
     * @instance
     */
    jiff.preprocessing_function_map = {
      base: {
        // arithmetic sharing protocols
        'smult': [
          { op: 'generate_beaver', op_id: ':triplet' },
          { op: 'open', op_id: ':open1' },
          { op: 'open', op_id: ':open2' }
        ],
        'sxor_bit': [
          { op: 'smult', op_id: ':smult1' }
        ],
        'slt': [
          { op: 'lt_halfprime', op_id: ':halfprime:1' },
          { op: 'lt_halfprime', op_id: ':halfprime:2' },
          { op: 'lt_halfprime', op_id: ':halfprime:3' },
          { op: 'smult', op_id: ':smult1' },
          { op: 'smult', op_id: ':smult2' }
        ],
        'cgt': [
          { op: 'lt_halfprime', op_id: ':halfprime:1' },
          { op: 'lt_halfprime', op_id: ':halfprime:2' },
          { op: 'smult', op_id: ':smult1' }
        ],
        'clt': [
          { op: 'lt_halfprime', op_id: ':halfprime:1' },
          { op: 'lt_halfprime', op_id: ':halfprime:2' },
          { op: 'smult', op_id: ':smult1' }
        ],
        'lt_halfprime': [
          { op: 'sampling', op_id: ':sampling' },
          { op: 'smult', op_id: ':smult1' },
          { op: 'bits.cgt', op_id: ':bits.cgt' },
          { op: 'sxor_bit', op_id: ':sxor_bit' },
          { op: 'open', op_id: ':open' }
        ],
        'cdiv': [
          { op: 'cgt', op_id: ':wrap_cgt' },
          { op: 'cgteq', op_id: ':cor1' },
          { op: 'cgteq', op_id: ':cor2' },
          { op: 'smult', op_id: ':smult' },
          { op: 'clt', op_id: ':zero_check' },
          { op: 'smult', op_id: ':zero_it' },
          { op: 'open', op_id: ':open' },
          { op: 'generate_random_and_quotient', op_id: ':quotient' }
        ],
        'sdiv': [
          { op: 'bit_decomposition', op_id: ':decomposition1' },
          { op: 'bit_decomposition', op_id: ':decomposition2' },
          { op: 'bits.sdiv', op_id: ':bits.sdiv' }
        ],
        'if_else': [
          { op: 'smult', op_id: ':smult' }
        ],
        // bits protocols
        'bit_decomposition': [
          { op: 'sampling', op_id: ':sampling' },
          { op: 'bits.csubr', op_id: ':bits.csubr:1' },
          { op: 'bits.csubr', op_id: ':bits.csubr:2' },
          { op: 'if_else', op_id: ':if_else:', count: decomposition_ifelse_count },
          { op: 'open', op_id: ':open' }
        ],
        // comparisons
        'bits.cgteq': [
          { op: 'smult', op_id: ':smult:', count: constant_bits_count }
        ],
        'bits.cneq': [
          { op: 'sor_bit', op_id: ':sor_bit:', count: constant_bits_count }
        ],
        'bits.sneq': [
          { op: 'sxor_bit', op_id: ':sxor_bit:initial' },
          { op: 'sxor_bit', op_id: ':sxor_bit:', count: choice_bits_count(Math.min, -1) },
          { op: 'sor_bit', op_id: ':sor_bit:', count: choice_bits_count(Math.max, -1) }
        ],
        'bits.sgteq': [
          { op: 'smult', op_id: ':smult:initial' },
          { op: 'smult', op_id: ':smult1:', count: choice_bits_count(Math.max, -1) },
          { op: 'sxor_bit', op_id: ':sxor_bit1:', count: choice_bits_count(Math.min, -1) },
          { op: 'smult', op_id: ':smult2:', count: choice_bits_count(Math.min, -1) }
        ],
        'bits.sgt': [
          { op: 'bits.sgteq', op_id: ':bits.sgteq'},
          { op: 'bits.sneq', op_id: ':bits.sneq'},
          { op: 'smult', op_id: ':smult'}
        ],
        // constant arithmetic
        'bits.cadd': [
          { op: 'smult', op_id: ':smult:', count: constant_bits_count },
          { op: 'sxor_bit', op_id: ':sxor_bit:', count: constant_bits_count }
        ],
        'bits.cmult': dynamic_bits_cmult,
        'bits.cdivl': dynamic_bits_cdiv('left'),
        'bits.cdivr': dynamic_bits_cdiv('right'),
        // secret arithmetic
        'bits.sadd': [
          { op: 'sxor_bit', op_id: ':sxor_bit:initial' },
          { op: 'smult', op_id: ':smult:initial' },
          { op: 'smult', op_id: ':smult1:', count: choice_bits_count(Math.max, -1) },
          { op: 'sxor_bit', op_id: ':sxor_bit1:', count: choice_bits_count(Math.max, -1) },
          { op: 'smult', op_id: ':smult2:', count: choice_bits_count(Math.min, -1) },
          { op: 'sxor_bit', op_id: ':sxor_bit2:', count: choice_bits_count(Math.min, -1) }
        ],
        'bits.smult': dynamic_bits_smult,
        'bits.sdiv': dynamic_bits_sdiv,
        'bits.open': [
          { op: 'open', op_id: ':', count: bits_count }
        ],
        // refresh/open
        'refresh': [
          { op: 'generate_zero', op_id: '' }
        ],
        'open': [
          { op: 'refresh', op_id: ':refresh' }
        ],
        // generating a random number and its quotient / constant
        '__generate_random_and_quotient': [
          { op: 'bits.cgteq', op_id: ':bits_cgteq' },
          { op: 'if_else', op_id: ':ifelse1' },
          { op: 'if_else', op_id: ':ifelse2' },
          { op: 'sampling', op_id: ':rejection1' }
        ]
      }
    };

    // arithmetic protocols
    jiff.preprocessing_function_map['base']['sor_bit'] = jiff.preprocessing_function_map['base']['sxor_bit'];
    jiff.preprocessing_function_map['base']['smod'] = jiff.preprocessing_function_map['base']['sdiv'];
    jiff.preprocessing_function_map['base']['slteq'] = jiff.preprocessing_function_map['base']['slt'];
    jiff.preprocessing_function_map['base']['sgteq'] = jiff.preprocessing_function_map['base']['slt'];
    jiff.preprocessing_function_map['base']['sgt'] = jiff.preprocessing_function_map['base']['slt'];
    jiff.preprocessing_function_map['base']['clteq'] = jiff.preprocessing_function_map['base']['cgt'];
    jiff.preprocessing_function_map['base']['cgteq'] = jiff.preprocessing_function_map['base']['clt'];
    jiff.preprocessing_function_map['base']['seq'] = jiff.preprocessing_function_map['base']['clteq'];
    jiff.preprocessing_function_map['base']['sneq'] = jiff.preprocessing_function_map['base']['seq'];
    jiff.preprocessing_function_map['base']['ceq'] = jiff.preprocessing_function_map['base']['clteq'];
    jiff.preprocessing_function_map['base']['cneq'] = jiff.preprocessing_function_map['base']['ceq'];

    // bits protocols
    jiff.preprocessing_function_map['base']['bits.clt'] = jiff.preprocessing_function_map['base']['bits.cgteq'];
    jiff.preprocessing_function_map['base']['bits.clteq'] = jiff.preprocessing_function_map['base']['bits.cgteq'];
    jiff.preprocessing_function_map['base']['bits.cgt'] = jiff.preprocessing_function_map['base']['bits.cgteq'];
    jiff.preprocessing_function_map['base']['bits.ceq'] = jiff.preprocessing_function_map['base']['bits.cneq'];
    jiff.preprocessing_function_map['base']['bits.slt'] = jiff.preprocessing_function_map['base']['bits.sgteq'];
    jiff.preprocessing_function_map['base']['bits.slteq'] = jiff.preprocessing_function_map['base']['bits.sgt'];
    jiff.preprocessing_function_map['base']['bits.seq'] = jiff.preprocessing_function_map['base']['bits.sneq'];
    jiff.preprocessing_function_map['base']['bits.csubl'] = jiff.preprocessing_function_map['base']['bits.cadd'];
    jiff.preprocessing_function_map['base']['bits.csubr'] = jiff.preprocessing_function_map['base']['bits.cadd'];
    jiff.preprocessing_function_map['base']['bits.ssub'] = jiff.preprocessing_function_map['base']['bits.sadd'];

    /**
     * Checks if the given operation uses preprocessed values.
     * @method has_preprocessing
     * @memberof jiff-instance
     * @instance
     * @param {string} op - name of the operation to check.
     * @return {boolean} true if the op uses preprocessing, false otherwise.
     */
    jiff.has_preprocessing = function (op) {
      for (var i = 0; i < jiff.extensions.length; i++) {
        if (jiff.preprocessing_function_map[jiff.extensions[i]][op] != null) {
          return true;
        }
      }

      return false;
    };

    /**
     * Get a preprocessed share/value by associated op_id. If value does not exist
     * Fallback to some user specified way for creating it.
     * @method get_preprocessing
     * @memberof jiff-instance
     * @instance
     * @param {string} op_id - the op_id associated with the preprocessed value/share.
     * @return {object} the preprocessed share(s).
     */
    jiff.get_preprocessing = function (op_id) {
      var values = jiff.preprocessing_table[op_id];
      if (values != null) {
        return values;
      }
      if (jiff.crypto_provider === true) {
        return null;
      }
      throw new Error('No preprocessed value(s) that correspond to the op_id "' + op_id + '"');
    };

    /**
     * Store a pair of op_id and associated pre-processed value/share.
     * The value/share can be accessed later during the computation through jiff.get_preprocessing(op_id).
     * @method store_preprocessing
     * @memberof jiff-instance
     * @instance
     * @param {string} op_id - the op_id associated with the preprocessed value/share.
     * @param {SecretShare} share - the share/value to store.
     */
    jiff.store_preprocessing = function (op_id, share) {
      jiff.preprocessing_table[op_id] = share;
    };

    /**
     * Generate values used for jiff operations in advance of the general computation
     * @method __preprocessing
     * @memberof jiff-instance
     * @instance
     * @param {string} dependent_op - name of the operation that will later use the pre_processed values
     * @param {Number} count - number of times the protocol should be performed, number of values that will be generated
     * @param {Object} [protocols=defaults] - a mapping from base preprocessing elements (triplets, bit arrays) to functions that can pre-process them
     *                               the function must implement the same interface as the JIFF provided protocols (e.g. jiff.protocols.generate_beaver_bgw).
     *                               missing mappings indicate that JIFF must use the default protocols.
     * @param {Number} [threshold=receivers_list.length] - the threshold of the preprocessed shares.
     * @param {Array} [receivers_list=all_parties] - the parties that will receive the preprocsssed shares.
     * @param {Array} [compute_list=all_parties] - the parties that will compute the preprocsssed shares.
     * @param {Array} [Zp=jiff.Zp] - the Zp of the preprocessed shares.
     * @param {Array} [id_list=auto_gen()] - array of ids to be used sequentially to identify the pre_processed values. Optional.
     * @param {Object} params - any additional protocol-specific parameters.
     * @return {promise} a promise that is resolved when preprocessing is completed.
     */
    jiff.__preprocessing = function (dependent_op, count, protocols, threshold, receivers_list, compute_list, Zp, id_list, params) {
      var find_closest_namespace = function (op, starting_namespace) {
        var namespace_index = jiff.extensions.indexOf(starting_namespace);
        while (namespace_index >= 0) {
          var namespace = jiff.extensions[namespace_index];
          if (jiff.preprocessing_function_map[namespace] != null && jiff.preprocessing_function_map[namespace][op] != null) {
            return namespace;
          }
          namespace_index--;
        }

        return null;
      };

      // read only copy of params
      var _params = params;

      // Recursively follow jiff.preprocessing_function_map
      // to figure out the sub-components/nested primitives of the given operation
      // and pre-process those with the right op_ids.
      var promises = [];
      for (var i = 0; i < count; i++) {
        params = Object.assign({}, _params);
        if (params.op_id != null) {
          params.op_id = params.op_id + i;
        }

        var id = id_list[i];
        if (id == null) {
          // Two kinds of operations: one that relies on different sets of senders and receivers, and one that has a set of holders
          if (dependent_op === 'open' || dependent_op === 'bits.open') {
            var open_parties = params['open_parties'] != null ? params['open_parties'] : receivers_list;
            id = jiff.counters.gen_op_id2(dependent_op, open_parties, receivers_list);
          } else {
            id = jiff.counters.gen_op_id(dependent_op, receivers_list);
          }
        }

        var namespace = find_closest_namespace(dependent_op, params['namespace']);
        if (namespace == null) {
          var protocol = protocols[dependent_op];
          params.output_op_id = id;
          var result = protocol(threshold, receivers_list, compute_list, Zp, params, protocols);
          promises.push(result.promise);
          if (receivers_list.indexOf(jiff.id) > -1) {
            jiff.store_preprocessing(id, result.share);
          }
        } else {
          var preprocessing_dependencies = jiff.preprocessing_function_map[namespace][dependent_op];
          if (typeof(preprocessing_dependencies) === 'function') {
            preprocessing_dependencies = preprocessing_dependencies(dependent_op, count, protocols, threshold, receivers_list, compute_list, Zp, id_list, params);
          }
          for (var k = 0; k < preprocessing_dependencies.length; k++) {
            var dependency = preprocessing_dependencies[k];
            var next_op = dependency['op'];

            // copy both the originally given extra_params and the extra params of the dependency and merge them
            // together, dependency params overwrite duplicate keys.
            // If params are ever needed in non-leaf operations, this must be changed to accommodate
            var extra_params = Object.assign({}, params, dependency['params']);
            extra_params['namespace'] = dependency['namespace'] != null ? dependency['namespace'] : 'base';
            if (dependency.handler != null) {
              extra_params = dependency.handler(threshold, receivers_list, compute_list, Zp, id, extra_params);
            }
            if (extra_params.ignore === true) {
              continue;
            }

            // compose ids similar to how the actual operation is implemented
            var next_id_list = [];
            var next_count = dependency['count'];

            if (next_count == null) {
              next_count = 1;
              next_id_list[0] = id + dependency['op_id'];
            } else {
              next_count = next_count(threshold, receivers_list, compute_list, Zp, id, extra_params);
              for (var j = 0; j < next_count; j++) {
                next_id_list.push(id + dependency['op_id'] + j);
              }
            }

            if (extra_params['op_id'] != null) {
              extra_params['op_id'] = extra_params['op_id'] + dependency['op_id'];
            }

            promises.push(jiff.__preprocessing(next_op, next_count, protocols, threshold, receivers_list, compute_list, Zp, next_id_list, extra_params));
          }
        }
      }

      return Promise.all(promises);
    };

    /**
     * Stores all submitted and pending preprocessing tasks.
     * @member {Array} preprocessingTasks
     * @memberof jiff-instance
     * @instance
     */
    jiff.preprocessingTasks = [];

    /**
     * Callback to execute when preprocessing is done!
     * @member {function} preprocessingCallback
     * @memberof jiff-instance
     * @instance
     */
    jiff.preprocessingCallback = null;

    /**
     * Generate values used for jiff operations in advance of the general computation
     * @method preprocessing
     * @memberof jiff-instance
     * @instance
     * @param {string} dependent_op - name of the operation that will later use the pre_processed values
     * @param {Number} [count=1] - number of times the protocol should be performed, number of values that will be generated
     * @param {Number} [batch=count] - maximum number of parallel preprocessing tasks to execute in a single batch.
     * @param {Object} [protocols=defaults] - a mapping from base preprocessing elements ('beaver', 'bits', 'sampling') to functions that can pre-process them
     *                               the function must implement the same interface as the JIFF provided protocols (e.g. jiff.protocols.generate_beaver_bgw).
     *                               missing mappings indicate that JIFF must use the default protocols.
     * @param {Number} [threshold=receivers_list.length] - the threshold of the preprocessed shares.
     * @param {Array} [receivers_list=all_parties] - the parties that will receive the preprocsssed shares.
     * @param {Array} [compute_list=all_parties] - the parties that will compute the preprocsssed shares.
     * @param {Array} [Zp=jiff.Zp] - the Zp of the preprocessed shares.
     * @param {Array} [id_list=auto_gen()] - array of ids to be used sequentially to identify the pre_processed values. Optional.
     * @param {Object} [params={}] - any additional protocol-specific parameters.
     * @return {promise} a promise that is resolved when preprocessing is completed, null if this is called by a party that is neither a compute nor receiver party.
     */
    jiff.preprocessing = function (dependent_op, count, batch, protocols, threshold, receivers_list, compute_list, Zp, id_list, params) {
      var start = jiff.preprocessingTasks.length === 0;

      // defaults!
      if (receivers_list == null) {
        receivers_list = [];
        for (var p = 1; p <= jiff.party_count; p++) {
          receivers_list.push(p);
        }
      }
      if (compute_list == null) {
        compute_list = [];
        for (var c = 1; c <= jiff.party_count; c++) {
          compute_list.push(c);
        }
      }

      // not a receiver nor a sender
      if (receivers_list.indexOf(jiff.id) === -1 && compute_list.indexOf(jiff.id) === -1) {
        return null;
      }

      // more defaults
      if (params == null) {
        params = {};
      }
      if (Zp == null) {
        Zp = jiff.Zp;
      }
      if (threshold == null) {
        threshold = receivers_list.length;
      }
      if (id_list == null) {
        id_list = [];
      }
      protocols = Object.assign({}, jiff.default_preprocessing_protocols, protocols);

      // actual preprocessing
      if (count == null || count <= 0) {
        count = 1;
      }
      if (params == null) {
        params = {};
      }
      if (params['namespace'] == null) {
        params['namespace'] = jiff.extensions[jiff.extensions.length - 1];
      }
      batch = batch == null ? count : batch;

      // Create preprocessing tasks
      for (var i = 0; i < count; i += batch) {
        jiff.preprocessingTasks.push([dependent_op, Math.min(batch, count - i), protocols, threshold, receivers_list, compute_list, Zp, id_list, params]);
      }

      // Start daemon if not running!
      if (start) {
        jiff.preprocessingDaemon();
      }
    };

    /**
     * Preprocessing Daemon that executes all currently scheduled preprocessing tasks (entries in jiff.preprocessingTasks array) in order.
     * @method preprocessingDaemon
     * @memberof jiff-instance
     * @instance
     */
    jiff.preprocessingDaemon = function () {
      if (jiff.preprocessingTasks.length === 0) {
        if (jiff.preprocessingCallback != null) {
          jiff.counters.reset();

          var callback = jiff.preprocessingCallback;
          jiff.preprocessingCallback = null;
          callback(jiff);
        }
        return;
      }

      // execute a single preprocessing task!
      (function () {
        var args = arguments;
        console.log(jiff.id, 'Batch starting', args[0], args[1]);
        var promise = jiff.__preprocessing.apply(jiff, arguments);
        promise.then(function () {
          console.log(jiff.id, 'Batch done', args[0], args[1]);
          if (jiff.inspectDebug != null) {
            jiff.inspectDebug(Number.MAX_VALUE);
          }
          jiff.preprocessingTasks.shift();
          jiff.preprocessingDaemon();
        });
      }).apply(jiff, jiff.preprocessingTasks[0]);
    };

    /**
     * Calls the given callback when all preprocessing tasks have finished!
     * @method onFinishPreprocessing
     * @memberof jiff-instance
     * @instance
     */
    jiff.onFinishPreprocessing = function (callback) {
      if (jiff.preprocessingTasks.length === 0) {
        jiff.counters.reset();
        callback(jiff);
      } else {
        jiff.preprocessingCallback = callback;
      }
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
    };

    /**
     * Executes the callback only after all promises / secret shares in the barrier were resolved.
     * @param {number} [barrier_id=jiff.barriers.length - 1] - identifies the barrier, should be returned by start_barrier.
     *                                                         by default, barrier_id will refer to the last barrier.
     * @returns {promise} a promise that resolves after the secret shares are resolved.
     */
    jiff.end_barrier = function (barrier_id) {
      var barrier;
      if (barrier_id == null) {
        barrier = jiff.barriers.pop();
      } else {
        barrier = jiff.barriers[barrier_id];
        jiff.barriers.splice(barrier_id, 1);
      }

      return Promise.all(barrier);
    };


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
      } else {
        if (free) {
          jiff.free();
        }
        jiff.socket.disconnect();
      }
    };

    /**
     * Emits event to free up all the resources allocated for this party on the server.
     * Best not to call this function directly, as it can break things if resources still need to be used.
     * Instead, use jiff.disconnect(safe, free, callback) to free after safely disconnecting.
     * @param {io.socket} socket - the socket through which to free.
     */
    jiff.free = function () {
      var msg = jiff.execute_array_hooks('beforeOperation', [jiff, 'free', {}], 2);
      if (options.__internal_socket == null) {
        jiff.socket.safe_emit('free', JSON.stringify(msg));
      } else {
        jiff.execute_array_hooks('afterOperation', [jiff, 'free', msg], 2);
      }
    };

    // Store the id when server sends it back
    jiff.socket.on('initialization', function (msg) {
      jiff.__initialized = true;
      jiff.initialization_counter = 0;

      msg = JSON.parse(msg);
      msg = jiff.execute_array_hooks('afterOperation', [jiff, 'initialization', msg], 2);

      if (jiff.id == null) {
        jiff.id = msg.party_id;
      }

      if (jiff.party_count == null) {
        jiff.party_count = msg.party_count;
      }

      // Now: (1) this party is connect (2) server (and other parties) know this public key
      // Resend all pending messages
      jiff.socket.resend_mailbox();

      // store the received public keys and resolve wait callbacks
      jiff.store_public_keys(msg.public_keys);
    });

    // Public keys were updated on the server, and it sent us the updates
    jiff.socket.on('public_keys', function (msg, callback) {
      callback(true);

      msg = JSON.parse(msg);
      msg = jiff.execute_array_hooks('afterOperation', [jiff, 'public_keys', msg], 2);

      jiff.store_public_keys(msg.public_keys);
    });

    // Store sharing and shares counter which keeps track of the count of
    // sharing operations (share and open) and the total number of shares
    // respectively (used to get a unique id for each share operation and
    // share object).
    jiff.counters = {};

    jiff.counters.reset = function () {
      jiff.counters.triplet_op_count = {};
      jiff.counters.number_op_count = {};
      jiff.counters.op_count = {};

      if (jiff.counters.pending_opens == null) {
        jiff.counters.pending_opens = 0;
      }

      //stores a seed for generating unique op_ids.
      jiff.op_id_seed = '';
    };

    // initialize counters
    jiff.counters.reset();

    /**
     * Shorthand for generating unique operation ids.
     * All primitives called after this seed will use their usual default ids prefixed by the seed.
     * Helpful when we have nested callbacks/functions (e.g. share_arrays) that may be executed in arbitrary order,
     * using this function as a the first call inside such callbacks with an appropriate deterministic unique base_op_id
     * ensures that regardless of the order of execution, operations in the same callback are matched correctly across
     * all parties.
     * Check out demos/graph-pip/mpc.js for an example on using this.
     * @method seed_ids
     * @memberof jiff-instance
     * @instance
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
     * Generate a unique operation id for a new operation object.
     * The returned op_id will be unique with respect to other operations, and identifies the same
     * operation across all parties, as long as all parties are executing instructions in the same order.
     * @param {string} op - the type/name of operation performed.
     * @param {Array} holders - an array containing the ids of all the parties carrying out the operation.
     * @return {string} the op_id for the operation.
     */
    jiff.counters.gen_op_id = function (op, holders) {
      var label = jiff.op_id_seed + op + ':' + holders.join(',');
      if (jiff.counters.op_count[label] == null) {
        jiff.counters.op_count[label] = 0;
      }
      return label + ':' + (jiff.counters.op_count[label]++);
    };

    /**
     * Generate a unique operation id for a new operation object given two distinct executing parties lists.
     * For example, when sharing, this is given two potentially different lists of senders and receivers.
     * The returned op_id will be unique with respect to other operations, and identifies the same
     * operation across all parties, as long as all parties are executing instructions in the same order.
     * @param {string} op - the type/name of operation performed.
     * @param {Array} receivers - an array containing the ids of all the parties carrying out the receiving portion of the operation.
     * @param {Array} senders - an array containing the ids of all the parties carrying out the sending portion of the operation.
     * @return {string} the op_id for the operation.
     */
    jiff.counters.gen_op_id2 = function (op, receivers, senders) {
      var label = jiff.op_id_seed + op + ':' + senders.join(',') + ':' + receivers.join(',');
      if (jiff.counters.op_count[label] == null) {
        jiff.counters.op_count[label] = 0;
      }
      return label + ':' + (jiff.counters.op_count[label]++);
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

      if (jiff.keymap[sender_id] != null) {
        receive_share(jiff, json_msg);
      } else {
        if (jiff.messagesWaitingKeys[sender_id] == null) {
          jiff.messagesWaitingKeys[sender_id] = [];
        }
        jiff.messagesWaitingKeys[sender_id].push({label: 'share', msg: json_msg});
      }
    });

    jiff.socket.on('open', function (msg, callback) {
      callback(true); // send ack to server

      // parse message
      var json_msg = JSON.parse(msg);
      var sender_id = json_msg['party_id'];

      if (jiff.keymap[sender_id] != null) {
        receive_open(jiff, json_msg);
      } else {
        if (jiff.messagesWaitingKeys[sender_id] == null) {
          jiff.messagesWaitingKeys[sender_id] = [];
        }
        jiff.messagesWaitingKeys[sender_id].push({ label: 'open', msg: json_msg });
      }
    });

    // handle custom messages
    jiff.socket.on('custom', function (msg, callback) {
      callback(true); // send ack to server

      var json_msg = JSON.parse(msg);
      var sender_id = json_msg['party_id'];
      var encrypted = json_msg['encrypted'];

      if (jiff.keymap[sender_id] != null || encrypted !== true) {
        receive_custom(jiff, json_msg);
      } else {
        // key must not exist yet for sender_id, and encrypted must be true
        if (jiff.messagesWaitingKeys[sender_id] == null) {
          jiff.messagesWaitingKeys[sender_id] = [];
        }
        jiff.messagesWaitingKeys[sender_id].push({ label: 'custom', msg: json_msg });
      }
    });

    jiff.socket.on('crypto_provider', function (msg, callback) {
      callback(true); // send ack to server

      msg = JSON.parse(msg);
      receive_crypto_provider(jiff, msg);
    });

    jiff.socket.on('error', function (msg) {
      try {
        msg = JSON.parse(msg);
        jiff.error(msg['label'], msg['error']);
      } catch (error) {
        jiff.error('socket.io', msg);
      }
    });

    jiff.socket.on('disconnect', function (reason) {
      if (reason !== 'io client disconnect') {
        // check that the reason is an error and not a user initiated disconnect
        console.log('Disconnected!', jiff.id, reason);
      }

      jiff.execute_array_hooks('afterOperation', [jiff, 'disconnect', reason], -1);
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
    decrypt_and_sign: decrypt_and_sign,
    is_prime: is_prime
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