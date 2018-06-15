/**
 * The exposed API from jiff-client.js (The client side library of JIFF).
 * Wraps the jiff API. Internal members can be accessed with jiff.&lt;member-name&gt;.
 * @namespace jiff
 * @version 1.0
 */
(function(exports, node) {
  var crypto;
  if(node) {
    io = require('socket.io-client');
    $ = require('jquery-deferred');
    // Setup libsodium wrapper instance for this client
    sodium = require('libsodium-wrappers');
    sodium_promise = sodium.ready;
    crypto = require('crypto');
    crypto.__randomBytesWrapper = function(bytesNeeded) {
      return crypto.randomBytes(bytesNeeded);
    }
  } else { // sodium should be available in global scope from including sodium.js
    sodium_promise = sodium.ready;
    crypto = window.crypto || window.msCrypto;
    crypto.__randomBytesWrapper = function(bytesNeeded) {
      var randomBytes = new Uint8Array(bytesNeeded);
      crypto.getRandomValues(randomBytes);
      return randomBytes;
    }
  }

  /**
   * The default modulos to be used in a jiff instance if a custom modulos was not provided.
   */
  var gZp = 15485867;

  /** Return the maximum of two numbers */
  function max(x, y) {
    return x > y ? x : y;
  }

  /** Doubly linked list with add and delete functions and pointers to head and tail **/
  var linked_list = function() {
    // attributes: list.head and list.tail
    // functions: list.add(object) (returns pointer), list.delete(pointer)
    // list.head/list.tail/any element contains:
    //    next: pointer to next,
    //    previous: pointer to previous,
    //    object: stored object.
    var list = { "head": null, "tail": null };
    list.add = function(obj) {
      var node = { "object": obj, "next": null, "tail": null };
      if(list.head == null) {
        list.head = node;
        list.tail = node;
      }
      else {
        list.tail.next = node;
        node.previous = list.tail;
        list.tail = node;
      }
      return node;
    };
    list.delete = function(ptr) {
      var prev = ptr.previous;
      var next = ptr.next;
      if(prev == null) {
        list.head = next;
        if(list.head != null) list.head.prev = null;
        else list.tail = null;
      }
      else {
        prev.next = next;
        if(next != null) next.previous = prev;
      }
    };
    return list;
  };

  /**
   * Encrypts and signs the given message.
   * @memberof jiff.utils
   * @instance
   * @param {number/string} message - the message to encrypt.
   * @param {Uint8Array} encryption_public_key - ascii-armored public key to encrypt with.
   * @param {Uint8Array} signing_private_key - the private key of the encrypting party to sign with.
   * @param {string} operation_type - the operation for which this encryption is performed, one of the following: 'share', 'open', 'triplet', 'number'
   * @returns {object} the signed cipher, includes two properties: 'cipher' and 'nonce'.
   */
  function encrypt_and_sign(message, encryption_public_key, signing_private_key, operation_type) {
    if(operation_type == 'share' || operation_type == 'open') message = message.toString(10);

    var nonce = sodium.randombytes_buf(sodium.crypto_box_NONCEBYTES);
    var cipher = sodium.crypto_box_easy(message, nonce, encryption_public_key, signing_private_key);

    return { "nonce": '['+nonce.toString()+']', "cipher": '['+cipher.toString()+']'};
  }

  /**
   * Decrypts and checks the signature of the given ciphertext.
   * @memberof jiff.utils
   * @instance
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
      var decryption = sodium.crypto_box_open_easy(cipher_text, nonce, signing_public_key, decryption_secret_key, 'text');
      if(operation_type == 'share' || operation_type == 'open') return parseInt(decryption, 10);
      return decryption;
    } catch (_) {
      throw "Bad signature or Bad nonce";
    }
  }

  /**
   * Share given secret to the participating parties.
   * @param {jiff-instance} jiff - the jiff instance.
   * @param {number} secret - the secret to share.
   * @param {number} threshold - the minimimum number of parties needed to reconstruct the secret, defaults to all the recievers. [optional]
   * @param {array} receivers_list - array of party ids to share with, by default, this includes all parties. [optional]
   * @param {array} senders_list - array of party ids to receive from, by default, this includes all parties. [optional]
   * @param {number} Zp - the modulos (if null then the default Zp for the instance is used). [optional]
   * @param {string/number} share_id - the tag used to tag the messages sent by this share operation, this tag is used
   *                                   so that parties distinguish messages belonging to this share operation from other
   *                                   share operations between the same parties (when the order of execution is not
   *                                   deterministic). An automatic id is generated by increasing a local counter, default
   *                                   ids suffice when all parties execute all sharing operations with the same senders
   *                                   and receivers in the same order. [optional]
   * @returns {object} a map where the key is the sender party id
   *          and the value is the share object that wraps
   *          what was sent from that party (the internal value maybe deferred).
   *          if the party that calls this function is not a receiver then the map
   *          will be empty.
   */
  function jiff_share(jiff, secret, threshold, receivers_list, senders_list, Zp, share_id) {
    // defaults
    if(Zp == null) Zp = jiff.Zp;
    if(receivers_list == null) {
      receivers_list = [];
      for(var i = 1; i <= jiff.party_count; i++) receivers_list.push(i);
    }
    if(senders_list == null) {
      senders_list = [];
      for(var i = 1; i <= jiff.party_count; i++) senders_list.push(i);
    }
    if(threshold == null) threshold = receivers_list.length;
    if(threshold < 0) threshold = 2;
    if(threshold > receivers_list.length) threshold = receivers_list.length;

    // if party is uninvolved in the share, do nothing
    if(receivers_list.indexOf(jiff.id) == -1 &&  senders_list.indexOf(jiff.id) == -1)
      return {};

    // compute operation id
    receivers_list.sort(); // sort to get the same order
    senders_list.sort();
    if(share_id == null) share_id = jiff.counters.gen_share_id(receivers_list, senders_list);

    // stage sending of shares
    if(senders_list.indexOf(jiff.id) > -1) {
      // Call hook
      secret = jiff.execute_array_hooks('beforeShare', [jiff, secret, threshold, receivers_list, senders_list, Zp], 1);

      // compute shares
      var shares = jiff.hooks.computeShares(jiff, secret, receivers_list, threshold, Zp);

      // Call hook
      shares = jiff.execute_array_hooks('afterComputeShare', [jiff, shares, threshold, receivers_list, senders_list, Zp], 1);

      // send shares
      for(var i = 0; i < receivers_list.length; i++) {
        var p_id = receivers_list[i];
        if(p_id == jiff.id) continue;

        // send encrypted and signed shares_id[p_id] to party p_id
        var cipher_share = jiff.hooks.encryptSign(shares[p_id], jiff.keymap[p_id], jiff.secret_key, 'share');
        var msg = { party_id: p_id, share: cipher_share, op_id: share_id };
        jiff.socket.safe_emit('share', JSON.stringify(msg));
      }
    }

    // stage receiving of shares
    var result = {};
    if(receivers_list.indexOf(jiff.id) > -1) {
      // setup a map of deferred for every received share
      if(jiff.deferreds[share_id] == null) jiff.deferreds[share_id] = {};

      for(var i = 0; i < senders_list.length; i++) {
        var p_id = senders_list[i];
        if(p_id == jiff.id) {
          var my_share = jiff.execute_array_hooks('receiveShare', [jiff, p_id, shares[p_id]], 2);
          result[p_id] = jiff.secret_share(jiff, true, null, my_share, receivers_list, threshold, Zp);
          continue; // Keep party's own share
        }

        // check if a deferred is set up (maybe the message was previously received)
        if(jiff.deferreds[share_id][p_id] == null)
          // not ready, setup a deferred
          jiff.deferreds[share_id][p_id] = $.Deferred();

        var promise = jiff.deferreds[share_id][p_id].promise();

        // destroy deferred when done
        (function(promise, p_id) { // p_id is modified in a for loop, must do this to avoid scoping issues.
          promise.then(function() { jiff.deferreds[share_id][p_id] = null; });
        })(promise, p_id);

        // receive share_i[id] from party p_id
        result[p_id] = jiff.secret_share(jiff, false, promise, undefined, receivers_list, threshold, Zp, share_id+":"+p_id);
      }
    }

    return result;
  }

  /**
   * Default way of computing shares (can be overriden using hooks).
   * Compute the shares of the secret (as many shares as parties) using shamir secret sharing:
   * a polynomial of degree: ceil(parties/2) - 1 (honest majority).
   * @memberof jiff.sharing_schemes
   * @method shamir_share
   * @param {number} secret - the secret to share.
   * @param {array} parties_list - array of party ids to share with.
   * @param {number} threshold - the minimimum number of parties needed to reconstruct the secret, defaults to all the recievers. [optional]
   * @param {number} Zp - the modulos.
   * @param {function(number)} random - a function that provides a random number between 0 and the provided number-1 inclusive
   * @returns {object} a map between party number (from 1 to parties) and its
   *          share, this means that (party number, share) is a
   *          point from the polynomial.
   *
   */
  function jiff_compute_shares(jiff, secret, parties_list, threshold, Zp) {
    var shares = {}; // Keeps the shares

    // Each player's random polynomial f must have
    // degree threshold - 1, so that threshold many points are needed
    // to interpolate/reconstruct.
    var t = threshold - 1;
    var polynomial = Array(t+1); // stores the coefficients

    // Each players's random polynomial f must be constructed
    // such that f(0) = secret
    polynomial[0] = secret;

    // Compute the random polynomial f's coefficients
    for(var i = 1; i <= t; i++) polynomial[i] = jiff.helpers.random(Zp);

    // Compute each players share such that share[i] = f(i)
    for(var i = 0; i < parties_list.length; i++) {
      var p_id = parties_list[i];
      shares[p_id] = polynomial[0];
      var power = jiff.helpers.get_party_number(p_id);

      for(var j = 1; j < polynomial.length; j++) {
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
    if(jiff.deferreds[op_id] == null) jiff.deferreds[op_id] = {};
    if(jiff.deferreds[op_id][sender_id] == null)
      // Share is received before deferred was setup, store it.
      jiff.deferreds[op_id][sender_id] = $.Deferred();

    // Deferred is already setup, resolve it.
    jiff.deferreds[op_id][sender_id].resolve(share);
  }

  /**
   * Open up the given share to the participating parties.
   * @param {jiff-instance} jiff - the jiff instance.
   * @param {secret-share} share - the share of the secret to open that belongs to this party.
   * @param {array} parties - an array with party ids (1 to n) of receiving parties. [optional]
   * @param {string/number/object} op_ids - the operation id (or a map from receiving party to operation id) to be used to tag outgoing messages. [optional]
   * @returns {promise} a (JQuery) promise to the open value of the secret, null if the calling party is not a receiving party.
   * @throws error if share does not belong to the passed jiff instance.
   *
   */
  function jiff_open(jiff, share, parties, op_ids) {
    if(!(share.jiff === jiff)) throw "share does not belong to given instance";

    // Default values
    if(parties == null || parties == []) {
      parties = [];
      for(var i = 1; i <= jiff.party_count; i++)
        parties.push(i);
    }

    // If not a receiver nor holder, do nothing
    if(share.holders.indexOf(jiff.id) == -1 && parties.indexOf(jiff.id) == -1) return null;

    // Compute operation ids (one for each party that will receive a result
    if(op_ids == null) op_ids = {};

    if(typeof(op_ids) == "string" || typeof(op_ids) == "String" || typeof(op_ids) == "number") {
      var tmp = {};
      for(var i = 0; i < parties.length; i++) tmp[parties[i]] = op_ids;
      op_ids = tmp;
    }

    else {
      var holders_label = share.holders.join(",");
      for(var i = 0; i < parties.length; i++)
        if(op_ids[parties[i]] == null) op_ids[parties[i]] = jiff.counters.gen_open_id(parties[i], holders_label);
    }

    // Party is a holder
    if(share.holders.indexOf(jiff.id) > -1) {
      // Call hook
      share = jiff.execute_array_hooks('beforeOpen', [jiff, share, parties], 1);

      // refresh/reshare, so that the original share remains secret, instead
      // a new share is sent/open without changing the actual value.
      share = share.refresh("refresh:"+op_ids[parties[0]]);

      // The given share has been computed, share it to all parties
      if(share.ready) jiff_broadcast(jiff, share, parties, op_ids);

      // Share is not ready, setup sharing as a callback to its promise
      else share.promise.then(function() { jiff_broadcast(jiff, share, parties, op_ids); }, share.error);
    }

    // Party is a receiver
    if(parties.indexOf(jiff.id) > -1) {
      var shares = []; // this will store received shares
      var final_deferred = $.Deferred(); // will be resolved when the final value is reconstructed
      var final_promise = final_deferred.promise();
      for(var i = 0; i < share.holders.length; i++) {
        var p_id = share.holders[i];

        // Setup a deferred for receiving a share from party p_id
        if(jiff.deferreds[op_ids[jiff.id]] == null) jiff.deferreds[op_ids[jiff.id]] = {};
        if(jiff.deferreds[op_ids[jiff.id]][p_id] == null) jiff.deferreds[op_ids[jiff.id]][p_id] = $.Deferred();

        // Clean up deferred when fulfilled
        var promise = jiff.deferreds[op_ids[jiff.id]][p_id].promise();

        // destroy deferred when done
        (function(promise, p_id) { // p_id is modified in a for loop, must do this to avoid scoping issues.
          promise.then(function(received_share) {
            jiff.deferreds[op_ids[jiff.id]][p_id] = null;
            shares.push(received_share);

            // Too few shares, nothing to do.
            if(shares.length < share.threshold) return;

            // Enough shares to reconstruct.
            // If did not already reconstruct, do it.
            if(final_deferred != null) {
              var recons_secret = jiff.hooks.reconstructShare(jiff, shares);
              recons_secret = jiff.execute_array_hooks('afterReconstructShare', [jiff, recons_secret], 1);

              final_deferred.resolve(recons_secret);
              final_deferred = null;
            }

            // If all shares were received, clean up.
            if(shares.length == share.holders.length) {
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
   * Opens a bunch of secret shares.
   * @param {jiff-instance} jiff - the jiff instance.
   * @param {secret-share[]} shares - an array containing this party's shares of the secrets to reconstruct.
   * @param {array} parties - an array with party ids (1 to n) of receiving parties. [optional]
   *                          This must be one of 3 cases:
   *                          1. null:                       open all shares to all parties.
   *                          2. array of numbers:           open all shares to all the parties specified in the array.
   *                          3. array of array of numbers:  open share with index i to the parties specified
   *                                                         in the nested array at parties[i]. if parties[i] was null,
   *                                                         then shares[i] will be opened to all parties.
   * @returns {promise} a (JQuery) promise to ALL the open values of the secret, the promise will yield
   *                    an array of values, each corresponding to the given share in the shares parameter
   *                    at the same index.
   * @throws error if some shares does not belong to the passed jiff instance.
   */
  function jiff_open_all(jiff, shares, parties) {
    var parties_nested_arrays = (parties != null && (parties[0] == null || (typeof(parties[0]) != "number" && typeof(parties[0]) != "string")));

    var promises = [];
    for(var i = 0; i < shares.length; i++) {
      var party = parties_nested_arrays ? parties[i] : parties;

      promises.push(jiff.open(shares[i], party));
    }

    return Promise.all(promises);
  }

  /**
   * Share the given share to all the parties in the jiff instance.
   * @param {jiff-instance} jiff - the jiff instance.
   * @param {number} share - the share.
   * @param {array} parties - the parties to broadcast the share to.
   * @param {map} op_ids - a map from party id to operation id, this allows different messages
   *                       to have different operation id, in case operation id contains
   *                       the id of the receiver as well.
   *
   */
  function jiff_broadcast(jiff, share, parties, op_ids) {
    for(var index = 0; index < parties.length; index++) {
      var i = parties[index]; // Party id
      if(i == jiff.id) { receive_open(jiff, i, share.value, op_ids[i], share.Zp); continue; }

      // encrypt, sign and send
      var cipher_share = jiff.hooks.encryptSign(share.value, jiff.keymap[i], jiff.secret_key, 'open');
      var msg = { party_id: i, share: cipher_share, op_id: op_ids[i], Zp: share.Zp };
      jiff.socket.safe_emit('open', JSON.stringify(msg));
    }
  }

  /**
   * Resolves the deferred corresponding to operation_id and sender_id.
   * @param {jiff_instance} jiff - the jiff instance.
   * @param {number} sender_id - the id of the sender.
   * @param {string} share - the encrypted share, unless sender
   *                         is the same as receiver, then it is
   *                         an unencrypted number..
   * @param {number} op_id - the id of the share operation.
   * @param {number} Zp - the modulos.
   */
  function receive_open(jiff, sender_id, share, op_id, Zp) {
    // Decrypt share
    if(sender_id != jiff.id)
      share = jiff.hooks.decryptSign(share, jiff.secret_key, jiff.keymap[sender_id], 'open');

    // call hook
    share = jiff.execute_array_hooks('receiveOpen', [jiff, sender_id, share, Zp], 2);

    // Resolve the deferred.
    if(jiff.deferreds[op_id] == null) jiff.deferreds[op_id] = {};
    if(jiff.deferreds[op_id][sender_id] == null) jiff.deferreds[op_id][sender_id] = $.Deferred();

    jiff.deferreds[op_id][sender_id].resolve( { "value": share, "sender_id": sender_id, "Zp": Zp } );
  }

  /**
   * Uses Lagrange polynomials to interpolate the polynomial
   * described by the given shares (points).
   * @memberof jiff.sharing_schemes
   * @method shamir_reconstruct
   * @param {jiff-instance} jiff - the jiff instance.
   * @param {array} shares - an array of objects representing shares to reconstruct, every object has 3 attributes: value, sender_id, Zp.
   * @returns {number} the value of the polynomial at x=0 (the secret value).
   *
   */
  function jiff_lagrange(jiff, shares) {
    var party_count = jiff.party_count;
    var lagrange_coeff = []; // will contain shares.length many elements.

    // Compute the Langrange coefficients at 0.
    for(var i = 0; i < shares.length; i++) {
      var pi = jiff.helpers.get_party_number(shares[i].sender_id);
      lagrange_coeff[pi] = 1;

      for(var j = 0; j < shares.length; j++) {
        var pj = jiff.helpers.get_party_number(shares[j].sender_id);
        if(pj != pi) {
          var inv = jiff.helpers.extended_gcd(pi - pj, shares[i].Zp)[0];
          lagrange_coeff[pi] = jiff.helpers.mod(lagrange_coeff[pi] * (0 - pj), shares[i].Zp) * inv;
          lagrange_coeff[pi] = jiff.helpers.mod(lagrange_coeff[pi], shares[i].Zp);
        }
      }
    }

    // Reconstruct the secret via Lagrange interpolation
    var recons_secret = 0;
    for(var i = 0; i < shares.length; i++) {
      var pi = jiff.helpers.get_party_number(shares[i].sender_id);
      var tmp = jiff.helpers.mod((shares[i].value * lagrange_coeff[pi]), shares[i].Zp);
      recons_secret = jiff.helpers.mod((recons_secret + tmp), shares[i].Zp);
    }

    return recons_secret;
  }

  /**
   * Creates 3 shares, a share for every one of three numbers from a beaver triplet.
   * The server generates and sends the triplets on demand.
   * @param {jiff-instance} jiff - the jiff instance.
   * @param {array} receivers_list - array of party ids that want to receive the triplet shares, by default, this includes all parties. [optional]
   * @param {number} threshold - the minimimum number of parties needed to reconstruct the triplet.
   * @param {number} Zp - the modulos (if null then the default Zp for the instance is used). [optional]
   * @param {string} triplet_id - the triplet id which is used to identify the triplet requested, so that every party
   *                              gets a share from the same triplet for every matching instruction. An automatic triplet id
   *                              is generated by increasing a local counter, default ids suffice when all parties execute the
   *                              instructions in the same order. [optional]
   * @returns {secret-share[]} an array of 3 secret-shares [share_a, share_b, share_c] such that a * b = c.
   */
  function jiff_triplet(jiff, receivers_list, threshold, Zp, triplet_id) {
    if(Zp == null) Zp = jiff.Zp;
    if(receivers_list == null) {
      receivers_list = [];
      for(var i = 1; i <= jiff.party_count; i++) receivers_list.push(i);
    }

    // Get the id of the triplet needed.
    if(triplet_id == null) triplet_id = jiff.counters.gen_triplet_id(receivers_list);

    // Send a request to the server.
    var msg = JSON.stringify({triplet_id: triplet_id, receivers: receivers_list, threshold: threshold, Zp: Zp});

    // Setup deferreds to handle receiving the triplets later.
    var a_deferred = $.Deferred();
    var b_deferred = $.Deferred();
    var c_deferred = $.Deferred();
    jiff.deferreds[triplet_id] = { a: a_deferred, b: b_deferred, c: c_deferred };

    // send a request to the server.
    if(jiff.id == "s1")
      jiff.triplets_socket.safe_emit('triplet', msg);
    else
      jiff.triplets_socket.safe_emit('triplet', jiff.hooks.encryptSign(msg, jiff.keymap["s1"], jiff.secret_key, 'triplet'));

    var a_share = jiff.secret_share(jiff, false, a_deferred.promise(), undefined, receivers_list, threshold, Zp, triplet_id+":a");
    var b_share = jiff.secret_share(jiff, false, b_deferred.promise(), undefined, receivers_list, threshold, Zp, triplet_id+":b");
    var c_share = jiff.secret_share(jiff, false, c_deferred.promise(), undefined, receivers_list, threshold, Zp, triplet_id+":c");
    return [ a_share, b_share, c_share ];
  }

  /**
   * Store the received beaver triplet and resolves the corresponding deferred.
   * @param {jiff-instance} jiff - the jiff instance.
   * @param {number} triplet_id - the id of the triplet.
   * @param {object} triplet - the triplet (on the form: { a: share_a, b: share_b, c: share_c }).
   *
   */
  function receive_triplet(jiff, triplet_id, triplet) {
    triplet = jiff.execute_array_hooks('receiveTriplet', [jiff, triplet], 1);

    // Deferred is already setup, resolve it.
    jiff.deferreds[triplet_id]["a"].resolve(triplet["a"]);
    jiff.deferreds[triplet_id]["b"].resolve(triplet["b"]);
    jiff.deferreds[triplet_id]["c"].resolve(triplet["c"]);
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
   * @param {number} threshold - the minimimum number of parties needed to reconstruct the secret, defaults to all the recievers. [optional]
   * @param {array} receivers_list - array of party ids to share with, by default, this includes all parties. [optional]
   * @param {array} senders_list - array of party ids to receive from, by default, this includes all parties. [optional]
   * @param {number} Zp - the modulos (if null then the default Zp for the instance is used). [optional]
   * @return {secret-share} this party's share of the the number, null if this party is not a receiver.
   */
  function jiff_share_all_number(jiff, n, threshold, receivers_list, senders_list, Zp) {
    if(Zp == null) Zp = jiff.Zp;
    if(receivers_list == null) {
      receivers_list = [];
      for(var i = 1; i <= jiff.party_count; i++) receivers_list.push(i);
    }
    if(senders_list == null) {
      senders_list = [];
      for(var i = 1; i <= jiff.party_count; i++) senders_list.push(i);
    }

    var shares = jiff_share(jiff, n, threshold, receivers_list, senders_list, Zp);
    var share = shares[senders_list[0]];
    if(share != null) // only do this if you are a receiving party.
      for(var i = 1; i < senders_list.length; i++)
        share = share.sadd(shares[senders_list[i]]);

    return share;
  }

  /**
   * Use the server to generate shares for a random bit, zero, random non-zero number, or a random number.
   * The parties will not know the value of the number (unless the request is for shares of zero) nor other parties' shares.
   * @param {jiff-instance} jiff - the jiff instance.
   * @param {object} options - an object with these properties:
   *                           { "number": number, "bit": boolean, "nonzero": boolean, "max": number}
   * @param {array} receivers_list - array of party ids that want to receive the triplet shares, by default, this includes all parties. [optional]
   * @param {number} threshold - the minimimum number of parties needed to reconstruct the number.
   * @param {number} Zp - the modulos (if null then the default Zp for the instance is used). [optional]
   * @param {string} number_id - the number id which is used to identify this request, so that every party
   *                             gets a share from the same number for every matching instruction. An automatic number id
   *                             is generated by increasing a local counter, default ids suffice when all parties execute the
   *                             instructions in the same order. [optional]
   * @return {secret-share} - this party's share of the generated number.
   */
  function jiff_server_share_number(jiff, options, receivers_list, threshold, Zp, number_id) {
    if(Zp == null) Zp = jiff.Zp;
    if(receivers_list == null) {
      receivers_list = [];
      for(var i = 1; i <= jiff.party_count; i++) receivers_list.push(i);
    }
    if(threshold == null) threshold = receivers_list.length;

    // Get the id of the number.
    if(number_id == null) number_id = jiff.counters.gen_number_id(receivers_list);

    var msg = { number_id: number_id, receivers: receivers_list, threshold: threshold, Zp: Zp };
    msg = Object.assign(msg, options);
    msg = JSON.stringify(msg);

    // Setup deferreds to handle receiving the triplets later.
    var deferred = $.Deferred();
    jiff.deferreds[number_id] = deferred;

    // Send a request to the server.
    if(jiff.id == "s1")
      jiff.numbers_socket.safe_emit('number', msg);
    else
      jiff.numbers_socket.safe_emit('number', jiff.hooks.encryptSign(msg, jiff.keymap["s1"], jiff.secret_key, 'number'));

    var share = jiff.secret_share(jiff, false, deferred.promise(), undefined, receivers_list, threshold, Zp, number_id+":n");
    return share;
  }

  /**
   * Store the received share of a previously requested number from the server.
   * @param {jiff-instance} jiff - the jiff instance.
   * @param {number} number_id - the id of the number.
   * @param {number} share - the value of the share.
   */
  function receive_server_share_number(jiff, number_id, share) {
    share = jiff.execute_array_hooks('receiveNumber', [jiff, share], 1);

    // Deferred is already setup, resolve it.
    jiff.deferreds[number_id].resolve(share);
    jiff.deferreds[number_id] = null;
  }

  /**
   * Share an array of values. Each sender may have an array of different length. This is handled by the lengths parameter.
   * This function will reveal the lengths of the shared array.
   * If parties would like to keep the lengths of their arrays secret, they should agree on some "max" length apriori (either under MPC
   * or as part of the logistics of the computation), all their arrays should be padded to that length by using approriate default/identity
   * values.
   * @param {array} array - the array to be shared.
   * @param {null|number|object} lengths - the lengths of the arrays to be shared, has the following options:
   *                                       1. null: lengths are unknown, each sender will publicly reveal the lengths of its own array.
   *                                       2. number: all arrays are of this length
   *                                       3. object: { 'sender_party_id': length }: must specify the length of the array for each sender.
   * @param {number} threshold - the minimimum number of parties needed to reconstruct the secret, defaults to all the recievers. [optional]
   * @param {array} receivers_list - array of party ids to share with, by default, this includes all parties. [optional]
   * @param {array} senders_list - array of party ids to receive from, by default, this includes all parties. [optional]
   * @param {number} Zp - the modulos (if null then the default Zp for the instance is used). [optional]
   * @param {string|number} base_share_id - the base tag used to tag the messages sent by this share operation, every element of the array
   *                                   will get a unique id based on the concatenation of base_share_id and the index of the element.
   *                                   This tag is used so that parties distinguish messages belonging to this share operation from
   *                                   other share operations between the same parties (when the order of execution is not
   *                                   deterministic). An automatic id is generated by increasing a local counter, default
   *                                   ids suffice when all parties execute all sharing operations with the same senders
   *                                   and receivers in the same order. [optional]
   * @returns {promise} if the calling party is a receiver then a promise to the shared arrays is returned, the promise will provide an object
   *                    formated as follows: { <party_id>: [ <1st_share>, <2nd_share>, ..., <(lengths[party_id])th_share> ] }
   *                    where the party_ids are those of the senders.
   *                    if the calling party is not a receiver, then null is returned.
   */
  function jiff_share_array(jiff, array, lengths, threshold, receivers_list, senders_list, Zp, share_id) {
    // Check format of lengths
    if(lengths != null && typeof(lengths) != "number" && typeof(lengths) != "object")
      throw "share_array: unrecognized lengths"

    // Default values
    if(receivers_list == null) {
      receivers_list = [];
      for(var i = 1; i <= jiff.party_count; i++) receivers_list.push(i);
    }
    if(senders_list == null) {
      senders_list = [];
      for(var i = 1; i <= jiff.party_count; i++) senders_list.push(i);
    }

    var isReceiving = receivers_list.indexOf(jiff.id) > -1;
    if(senders_list.indexOf(jiff.id) == -1 && !isReceiving)
      return null; // This party is neither a sender nor a receiver, do nothing!

    // compute operation id
    receivers_list.sort(); // sort to get the same order
    senders_list.sort();
    if(share_id == null) share_id = jiff.counters.gen_share_id(receivers_list, senders_list) + ":array:";

    // wrap around result of share_array
    var share_array_deferred = $.Deferred();
    var share_array_promise = share_array_deferred.promise();

    // figure out lengths by having each party emit their length publicly
    if(lengths == null) {
      lengths = {};
      var total = 0;
      if(senders_list.indexOf(jiff.id) > -1) {
        total = 1; // we have our own length since we are a sender
        lengths[jiff.id] = array.length;

        // send the length of this party's array to all receivers
        jiff.emit(share_id + "length", receivers_list, array.length);
      }

      jiff.listen(share_id + "length", function(sender, message) {
        lengths[sender] = message;
        total++;
        if(total == senders_list.length) {
          delete jiff.listeners[share_id + "length"];
          share_array_deferred.resolve(lengths);
        }
      });
    }

    // All arrays are of the same length
    else if(typeof(lengths) == "number") {
      var l = lengths;
      lengths = {};
      for(var i = 0; i < senders_list.length; i++)
        lengths[senders_list[i]] = l;

      share_array_deferred.resolve(lengths);
    }

    // Lengths of the different arrays are all provided
    else {
      for(var i = 0; i < senders_list.length; i++)
        if(lengths[senders_list[i]] == null) throw "share_array: missing length"

      share_array_deferred.resolve(lengths);
    }

    // lengths are now set, start sharing
    share_array_promise = share_array_promise.then(function(lengths) {
      // compute the number of sharing rounds
      var max = 0;
      for(var i = 0; i < senders_list.length; i++) {
        var l = lengths[senders_list[i]];
        max = l > max ? l : max;
      }

      // Store results here
      var results = {};
      if(isReceiving) {
        for(var i = 0; i < senders_list.length; i++)
          results[senders_list[i]] = [];
      }

      // share every round
      for(var r = 0; r < max; r++) {
        var round_senders = [];
        for(var i = 0; i < senders_list.length; i++)
          if(lengths[senders_list[i]] > r) round_senders.push(senders_list[i]);

        var value = r < array.length ? array[r] : null;
        var round_results = jiff.share(value, threshold, receivers_list, round_senders, Zp, share_id + "round:" + r);

        for(var sender_id in round_results)
          if(round_results.hasOwnProperty(sender_id))
            results[sender_id].push(round_results[sender_id]);
      }

      return results;
    });

    return isReceiving ? share_array_promise : null;
  }

  /**
   * Create a new share.
   * A share is a value wrapper with a share object, it has a unique id
   * (per computation instance), and a pointer to the instance it belongs to.
   * A share also has methods for performing operations.
   * @param {jiff-instance} jiff - the jiff instance.
   * @param {boolean} ready - whether the value of the share is ready or deferred.
   * @param {promise} promise - a promise to the value of the share.
   * @param {number} value - the value of the share (null if not ready).
   * @param {array} holders - the parties that hold all the corresponding shares (must be sorted).
   * @param {number} threshold - the minimimum number of parties needed to reconstruct the secret.
   * @param {number} Zp - the modulos under which this share was created.
   * @param {string} id - this share's id (should be unique). [optional]
   * @returns {secret-share} the secret share object containing the give value.
   *
   */
  function secret_share(jiff, ready, promise, value, holders, threshold, Zp, id) {
    /**
     * Internal helpers for operations inside/on a share. This is not exposed to the external code,
     * except through the createSecretShare hook. Modify existing helpers or add more in your extensions
     * to avoid having to re-write and duplicate the code for primitives.
     */
     var share_helpers = {
       '+': function(v1, v2) { return v1 + v2; },
       '-': function(v1, v2) { return v1 - v2; },
       '*': function(v1, v2) { return v1 * v2; },
       '/': function(v1, v2) { return v1 / v2; },
       '<': function(v1, v2) { return v1 < v2; },
       'floor': function(v) { return Math.floor(v); },
       'floor/': function(v1, v2) { return Math.floor(v1 / v2); },
       'pow': function(v1, v2) { return Math.pow(v1, v2); }
     };
  
    /**
     * Secret share objects: provides API to perform operations on shares securly, wrap promises
     * and communication primitives to ensure operations are executed when shares are available (asynchrounously)
     * without requiring the user to perform promise management/synchronization.
     * @namespace secret-share
     */
    var self = {};

    /**
     * @member {jiff-instance} jiff
     * @memberof secret-share
     */
    self.jiff = jiff;

    /**
     * @member {boolean} ready
     * @memberof secret-share
     */
    self.ready = ready;

    /**
     * @member {promise} promise
     * @memberof secret-share
     */
    self.promise = promise;
    /**
     * @member {number} value
     * @memberof secret-share
     */
    self.value = value;
    /**
     * @member {array} holders
     * @memberof secret-share
     */
    self.holders = holders;
    /**
     * @member {array} threshold
     * @memberof secret-share
     */
    self.threshold = threshold;
    /**
     * @member {number} Zp
     * @memberof secret-share
     */
    self.Zp = Zp;

    if(id == null) id = jiff.counters.gen_share_obj_id();

    /**
     * @member {string} id
     * @memberof secret-share
     */
    self.id = id;

    /**
     * Gets the value of this share.
     * @method valueOf
     * @returns {number} the value (undefined if not ready yet).
     * @memberof secret-share
     */
    self.valueOf = function() {
      if(ready) return self.value;
      else return undefined;
    };

    /**
     * Gets a string representation of this share.
     * @method toString
     * @returns {string} the id and value of the share as a string.
     * @memberof secret-share
     */
    self.toString = function() {
      if(ready) return self.id + ": " + self.value;
      else return self.id + ": <deferred>";
    };

    /**
     * Logs an error.
     * @method error
     * @memberof secret-share
     */
    self.error = function() { console.log("Error receiving " + self.toString()); };

    /**
     * Receives the value of this share when ready.
     * @method receive_share
     * @param {number} value - the value of the share.
     * @memberof secret-share
     */
    self.receive_share = function(value) { self.value = value; self.ready = true; self.promise = null; };

    /**
     * Joins the pending promises of this share and the given share.
     * @method pick_promise
     * @param {secret-share} o - the other share object.
     * @returns {promise} the joined promise for both shares (or whichever is pending).
     * @memberof secret-share
     */
    self.pick_promise = function(o) {
      if(self.ready && o.ready) return null;

      if(self.ready) return o.promise;
      else if(o.ready) return self.promise;
      else return Promise.all([self.promise, o.promise]);
    };

    /**
     * Checks if the given parameter is a constant, used to determine whether constant or secret
     * operations should be executed.
     * @param {number/object} o - the parameter to determine.
     * @return true if o is a valid constant, false otherwise.
     */
    self.isConstant = function(o) {
      return typeof(o) == "number";
    }

    /**
     * Reshares/refreshes the sharing of this number, used before opening to keep the share secret.
     * @method refresh
     * @param {string} op_id - the operation id with which to tag the messages sent by this refresh, by default
     *                         an automatic operation id is generated by increasing a local counter, default operation ids
     *                         suffice when all parties execute the instructions in the same order. [optional]
     * @returns {secret-share} a new share of the same number.
     * @memberof secret-share
     */
    self.refresh = function(op_id) {
      return self.isadd(self.jiff.server_generate_and_share({"number": 0}, self.holders, self.threshold, self.Zp, op_id));
    };

    /**
     * Reveals/Opens the value of this share.
     * @method open
     * @param {function(number)} success - the function to handle successful open.
     * @param {function(string)} error - the function to handle errors and error messages. [optional]
     * @returns {promise} a (JQuery) promise to the open value of the secret.
     * @throws error if share does not belong to the passed jiff instance.
     * @memberof secret-share
     */
    self.open = function(success, failure) {
      if(failure == null) failure = self.error;
      var promise = self.jiff.open(self);
      if(promise != null && success != null) promise = promise.then(success, failure);
      return promise;
    };

    /**
     * Reveals/Opens the value of this share to a specific array of parties.
     * @method open_to
     * @param {array} parties - the ids of parties to reveal secret to.
     * @param {function(number)} success - the function to handle successful open.
     * @param {function(string)} error - the function to handle errors and error messages. [optional]
     * @memberof secret-share
     */
    self.open_to = function(parties, success, failure) {
      if(failure == null) failure = self.error;
      var promise = self.jiff.open(self, parties);
      if(promise != null && success != null) promise = promise.then(success, failure);
      return promise;
    };

    /**
     * Generic Addition.
     * Uses either the constant or secret version of this operator depending on type of paramter.
     * @method add
     * @param {number/secret-share} o - the other operand (can be either number or share).
     * @return {secret-share} this party's share of the result.
     * @memberof secret-share
     */
    self.add = function(o) {
      if(self.isConstant(o)) return self.cadd(o);
      return self.sadd(o);
    }

    /**
     * Generic Subtraction.
     * Uses either the constant or secret version of this operator depending on type of paramter.
     * @method sub
     * @param {number/secret-share} o - the other operand (can be either number or share).
     * @return {secret-share} this party's share of the result.
     * @memberof secret-share
     */
    self.sub = function(o) {
      if(self.isConstant(o)) return self.csub(o);
      return self.ssub(o);
    }

    /**
     * Generic Multiplication.
     * Uses either the constant or secret version of this operator depending on type of paramter.
     * @method mult
     * @param {number/secret-share} o - the other operand (can be either number or share).
     * @param {string} op_id - the operation id which is used to identify this multiplication (and internally, the corresponding beaver triplet).
     *                         This id must be unique, and must be passed by all parties to the same instruction.
     *                         this ensures that every party gets a share from the same triplet for every matching instruction. An automatic id
     *                         is generated by increasing a local counter, default ids suffice when all parties execute the
     *                         instructions in the same order. Only used if secret multiplication is used. [optional]
     * @return {secret-share} this party's share of the result.
     * @memberof secret-share
     */
    self.mult = function(o, op_id) {
      if(self.isConstant(o)) return self.cmult(o);
      return self.smult(o, op_id);
    }

    /**
     * Generic XOR for bits (both this and o have to be bits to work correctly).
     * Uses either the constant or secret version of this operator depending on type of paramter.
     * @method xor_bit
     * @param {number/secret-share} o - the other operand (can be either number or share).
     * @param {string} op_id - the operation id which is used to identify this operation.
     *                         This id must be unique, and must be passed by all parties to the same instruction, to
     *                         ensure that corresponding instructions accross different parties are matched correctly.
     *                         Only used if secret xor is used. [optional].
     * @return {secret-share} this party's share of the result, the final result is 1 if this < o, and 0 otherwise.
     * @return {secret-share} this party's share of the result.
     * @memberof secret-share
     */
    self.xor_bit = function(o, op_id) {
      if(self.isConstant(o)) return self.cor_bit(o);
      return self.sor_bit(o, op_id);
    }

    /**
     * Generic OR for bits (both this and o have to be bits to work correctly).
     * Uses either the constant or secret version of this operator depending on type of paramter.
     * @method or_bit
     * @param {number/secret-share} o - the other operand (can be either number or share).
     * @param {string} op_id - the operation id which is used to identify this operation.
     *                         This id must be unique, and must be passed by all parties to the same instruction, to
     *                         ensure that corresponding instructions accross different parties are matched correctly.
     *                         Only used if secret or is used. [optional].
     * @return {secret-share} this party's share of the result.
     * @memberof secret-share
     */
    self.or_bit = function(o, op_id) {
      if(self.isConstant(o)) return self.cxor_bit(o);
      return self.sxor_bit(o, op_id);
    }

    /**
     * Generic Greater or equal.
     * Uses either the constant or secret version of this operator depending on type of paramter.
     * @method gteq
     * @param {number/secret-share} o - the other operand (can be either number or share).
     * @param {string} op_id - the operation id which is used to identify this operation.
     *                         This id must be unique, and must be passed by all parties to the same instruction, to
     *                         ensure that corresponding instructions accross different parties are matched correctly [optional].
     * @return {secret-share} this party's share of the result.
     * @memberof secret-share
     */
    self.gteq = function(o, op_id) {
      if(self.isConstant(o)) return self.cgteq(o, op_id);
      return self.sgteq(o);
    }

    /**
     * Generic Greater than.
     * Uses either the constant or secret version of this operator depending on type of paramter.
     * @method gt
     * @param {number/secret-share} o - the other operand (can be either number or share).
     * @param {string} op_id - the operation id which is used to identify this operation.
     *                         This id must be unique, and must be passed by all parties to the same instruction, to
     *                         ensure that corresponding instructions accross different parties are matched correctly [optional].
     * @return {secret-share} this party's share of the result.
     * @memberof secret-share
     */
    self.gt = function(o, op_id) {
      if(self.isConstant(o)) return self.cgt(o, op_id);
      return self.sgt(o, op_id);
    }

    /**
     * Generic Less or equal.
     * Uses either the constant or secret version of this operator depending on type of paramter.
     * @method lteq
     * @param {number/secret-share} o - the other operand (can be either number or share).
     * @param {string} op_id - the operation id which is used to identify this operation.
     *                         This id must be unique, and must be passed by all parties to the same instruction, to
     *                         ensure that corresponding instructions accross different parties are matched correctly [optional].
     * @return {secret-share} this party's share of the result.
     * @memberof secret-share
     */
    self.lteq = function(o, op_id) {
      if(self.isConstant(o)) return self.clteq(o, op_id);
      return self.slteq(o, op_id);
    }

    /**
     * Generic Less than.
     * Uses either the constant or secret version of this operator depending on type of paramter.
     * @method lt
     * @param {number/secret-share} o - the other operand (can be either number or share).
     * @param {string} op_id - the operation id which is used to identify this operation.
     *                         This id must be unique, and must be passed by all parties to the same instruction, to
     *                         ensure that corresponding instructions accross different parties are matched correctly [optional].
     * @return {secret-share} this party's share of the result.
     * @memberof secret-share
     */
    self.lt = function(o, op_id) {
      if(self.isConstant(o)) return self.clt(o, op_id);
      return self.slt(o, op_id);
    }

    /**
     * Generic Equals.
     * Uses either the constant or secret version of this operator depending on type of paramter.
     * @method eq
     * @param {number/secret-share} o - the other operand (can be either number or share).
     * @param {string} op_id - the operation id which is used to identify this operation.
     *                         This id must be unique, and must be passed by all parties to the same instruction, to
     *                         ensure that corresponding instructions accross different parties are matched correctly [optional].
     * @return {secret-share} this party's share of the result.
     * @memberof secret-share
     */
    self.eq = function(o, op_id) {
      if(self.isConstant(o)) return self.ceq(o, op_id);
      return self.seq(o, op_id);
    }

    /**
     * Generic Not Equals.
     * Uses either the constant or secret version of this operator depending on type of paramter.
     * @method neq
     * @param {number/secret-share} o - the other operand (can be either number or share).
     * @param {string} op_id - the operation id which is used to identify this operation.
     *                         This id must be unique, and must be passed by all parties to the same instruction, to
     *                         ensure that corresponding instructions accross different parties are matched correctly [optional].
     * @return {secret-share} this party's share of the result.
     * @memberof secret-share
     */
    self.neq = function(o, op_id) {
      if(self.isConstant(o)) return self.cneq(o, op_id);
      return self.sneq(o, op_id);
    }

    /**
     * Generic Integer Divison.
     * Uses either the constant or secret version of this operator depending on type of paramter.
     * @method div
     * @param {number/secret-share} o - the other operand (can be either number or share).
     * @param {number} l - the maximum bit length of the two shares. [optional]
     * @param {string} op_id - the operation id which is used to identify this operation.
     *                         This id must be unique, and must be passed by all parties to the same instruction, to
     *                         ensure that corresponding instructions accross different parties are matched correctly [optional].
     * @return {secret-share} this party's share of the result.
     * @memberof secret-share
     */
    self.div = function(o, l, op_id) {
      if(self.isConstant(o)) return self.cdiv(o, l, op_id);
      return self.sdiv(o, l, op_id);
    }

    /**
     * Addition with a constant.
     * @method cadd
     * @param {number} cst - the constant to add.
     * @return {secret-share} this party's share of the result.
     * @memberof secret-share
     */
    self.cadd = function(cst) {
      if (!(self.isConstant(cst))) throw "parameter should be a number (+)";

      if(self.ready) // if share is ready
        return self.jiff.secret_share(self.jiff, true, null, self.jiff.helpers.mod(share_helpers['+'](self.value, cst), self.Zp), self.holders, self.threshold, self.Zp);

      var promise = self.promise.then(function() { return self.jiff.helpers.mod(share_helpers['+'](self.value, cst), self.Zp); }, self.error);
      return self.jiff.secret_share(self.jiff, false, promise, undefined, self.holders, self.threshold, self.Zp);
    };

    /**
     * Subtraction with a constant.
     * @method csub
     * @param {number} cst - the constant to subtract from this share.
     * @return {secret-share} this party's share of the result.
     * @memberof secret-share
     */
    self.csub = function(cst) {
      if (!(self.isConstant(cst))) throw "parameter should be a number (-)";

      if(self.ready) // if share is ready
        return self.jiff.secret_share(self.jiff, true, null, self.jiff.helpers.mod(share_helpers['-'](self.value, cst), self.Zp), self.holders, self.threshold, self.Zp);

      var promise = self.promise.then(function() { return self.jiff.helpers.mod(share_helpers['-'](self.value, cst), self.Zp); }, self.error);
      return self.jiff.secret_share(self.jiff, false, promise, undefined, self.holders, self.threshold, self.Zp);
    }

    /**
     * Multiplication by a constant.
     * @method cmult
     * @param {number} cst - the constant to multiply to this share.
     * @return {secret-share} this party's share of the result.
     * @memberof secret-share
     */
    self.cmult = function(cst) {
      if (!(self.isConstant(cst))) throw "parameter should be a number (*)";

      if(self.ready) // if share is ready
        return self.jiff.secret_share(self.jiff, true, null, self.jiff.helpers.mod(share_helpers['*'](self.value, cst), self.Zp), self.holders, self.threshold, self.Zp);

      var promise = self.promise.then(function() { return self.jiff.helpers.mod(share_helpers['*'](self.value, cst), self.Zp); }, self.error);
      return self.jiff.secret_share(self.jiff, false, promise, undefined, self.holders, self.threshold, self.Zp);
    };

    /**
     * Division by a constant factor of the number represented by the share.
     * @method cdivfac
     * @param {number} cst - the constant by which to divide the share.
     * @return {secret-share} this party's share of the result.
     * @memberof secret-share
     */
    self.cdivfac = function(cst) {
      if (!(self.isConstant(cst))) throw "Parameter should be a number (cdivfac)";

      var inv = jiff.helpers.extended_gcd(cst, self.Zp)[0];

      if(self.ready) // If share is ready.
        return self.jiff.secret_share(self.jiff, true, null, self.jiff.helpers.mod(share_helpers['*'](self.value, inv), self.Zp), self.holders, self.threshold, self.Zp);

      var promise = self.promise.then(function() { return self.jiff.helpers.mod(share_helpers['*'](self.value, inv), self.Zp); }, self.error);
      return self.jiff.secret_share(self.jiff, false, promise, undefined, self.holders, self.threshold, self.Zp);
    };

    /**
     * Addition of two secret shares.
     * @method sadd
     * @param {secret-share} o - the share to add to this share.
     * @return {secret-share} this party's share of the result.
     * @memberof secret-share
     */
    self.sadd = function(o) {
      if (!(o.jiff === self.jiff)) throw "shares do not belong to the same instance (+)";
      if (!self.jiff.helpers.Zp_equals(self, o)) throw "shares must belong to the same field (+)";
      if (!self.jiff.helpers.array_equals(self.holders, o.holders)) throw "shares must be held by the same parties (+)";

      // add the two shares when ready locally
      var ready_add = function() {
        return self.jiff.helpers.mod(share_helpers['+'](self.value, o.value), self.Zp);
      }

      if(self.ready && o.ready) // both shares are ready
        return self.jiff.secret_share(self.jiff, true, null, ready_add(), self.holders, max(self.threshold, o.threshold), self.Zp);

      // promise to execute ready_add when both are ready
      var promise = self.pick_promise(o).then(ready_add, self.error);
      return self.jiff.secret_share(self.jiff, false, promise, undefined, self.holders, max(self.threshold, o.threshold), self.Zp);
    };

    /**
     * Subtraction of two secret shares.
     * @method ssub
     * @param {secret-share} o - the share to subtract from this share.
     * @return {secret-share} this party's share of the result.
     * @memberof secret-share
     */
    self.ssub = function(o) {
      if (!(o.jiff === self.jiff)) throw "shares do not belong to the same instance (-)";
      if (!self.jiff.helpers.Zp_equals(self, o)) throw "shares must belong to the same field (-)";
      if (!self.jiff.helpers.array_equals(self.holders, o.holders)) throw "shares must be held by the same parties (-)";

      // add the two shares when ready locally
      var ready_sub = function() {
        return self.jiff.helpers.mod(share_helpers['-'](self.value, o.value), self.Zp);
      }

      if(self.ready && o.ready) // both shares are ready
        return self.jiff.secret_share(self.jiff, true, null, ready_sub(), self.holders, max(self.threshold, o.threshold), self.Zp);

      // promise to execute ready_add when both are ready
      var promise = self.pick_promise(o).then(ready_sub, self.error);
      return self.jiff.secret_share(self.jiff, false, promise, undefined, self.holders, max(self.threshold, o.threshold), self.Zp);
    };

    /**
     * Multiplication of two secret shares through Beaver Triplets.
     * @method smult
     * @param {secret-share} o - the share to multiply with.
     * @param {string} op_id - the operation id which is used to identify this multiplication (and internally, the corresponding beaver triplet).
     *                         This id must be unique, and must be passed by all parties to the same instruction.
     *                         this ensures that every party gets a share from the same triplet for every matching instruction. An automatic id
     *                         is generated by increasing a local counter, default ids suffice when all parties execute the
     *                         instructions in the same order. [optional]
     * @return {secret-share} this party's share of the result.
     * @memberof secret-share
     */
    self.smult = function(o, op_id) {
      if (!(o.jiff === self.jiff)) throw "shares do not belong to the same instance (*)";
      if (!self.jiff.helpers.Zp_equals(self, o)) throw "shares must belong to the same field (*)";
      if (!self.jiff.helpers.array_equals(self.holders, o.holders)) throw "shares must be held by the same parties (*)";

      if(op_id == null)
        op_id = self.jiff.counters.gen_op_id("*", self.holders);

      var final_deferred = $.Deferred();
      var final_promise = final_deferred.promise();
      var result = self.jiff.secret_share(self.jiff, false, final_promise, undefined, self.holders, max(self.threshold, o.threshold), self.Zp, "share:"+op_id);

      // Get shares of triplets.
      var triplet = jiff.triplet(self.holders, max(self.threshold, o.threshold), self.Zp, op_id+":triplet");

      var a = triplet[0];
      var b = triplet[1];
      var c = triplet[2];

      // d = s - a. e = o - b.
      var d = self.isadd(a.icmult(-1));
      var e = o.isadd(b.icmult(-1));

      // Open d and e.
      // The only communication cost.
      var e_promise = self.jiff.internal_open(e, e.holders, op_id+":open1");
      var d_promise = self.jiff.internal_open(d, d.holders, op_id+":open2");
      Promise.all([e_promise, d_promise]).then(function(arr) {
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

        if(final_result.ready)
          final_deferred.resolve(final_result.value);
        else // Resolve the deferred when ready.
          final_result.promise.then(function () { final_deferred.resolve(final_result.value); });
      });

      return result;
    };

    /**
     * Multiplication of two secret shares through BGW protocol.
     * @method smult_bgw
     * @param {jiff_instance} jiff - the jiff instance.
     * @param {share-object} x - one share to multiply with.
     * @param {share-object} y - y share to multiply with.
     * @param {string} op_id - the operation id which is used to identify this multiplication (and internally, the corresponding beaver triplet).
     *                         This id must be unique, and must be passed by all parties to the same instruction.
     *                         this ensures that every party gets a share from the same triplet for every matching instruction. An automatic id
     *                         is generated by increasing a local counter, default ids suffice when all parties execute the
     *                         instructions in the same order. [optional]
     * @return {share-object} this party's share of the result.
     */

    self.smult_bgw = function(o, op_id) {
      if (!(o.jiff === self.jiff)) throw "shares do not belong to the same instance (*)";
      if (!self.jiff.helpers.Zp_equals(self, o)) throw "shares must belong to the same field (*)";
      if (!self.jiff.helpers.array_equals(self.holders, o.holders)) throw "shares must be held by the same parties (*)";
      if ((self.threshold - 1) + (o.threshold - 1) > self.holders.length - 1) throw "threshold too high for BGW (*)";

      if(op_id == null)
        op_id = self.jiff.counters.gen_op_id("bgw*", self.holders);

      var final_deferred = $.Deferred();
      var final_promise = final_deferred.promise();
      var result = self.jiff.secret_share(self.jiff, false, final_promise, undefined, self.holders, max(self.threshold, o.threshold), self.Zp, "share:"+op_id);

      Promise.all([self.promise, o.promise]).then(
        function () {
          // Get Shares  of z
          var zi =  self.jiff.helpers.mod(share_helpers['*'](self.value, o.value), self.Zp);
          //var zi = self.value*o.value;
          var zi_shares = self.jiff.internal_share(zi, max(self.threshold, o.threshold), self.holders, self.holders, self.Zp, op_id);

          var promises = [];
          for (var i = 1; i <= self.jiff.party_count; i++)
            promises.push(zi_shares[i].promise);

          // Reduce the degree of the polynomial back to n/2
          Promise.all(promises).then(
            function () {
              var reconstruct_parts = [];
              for (var i = 0; i < self.holders.length; i++) {
                var party_id = self.holders[i];
                //shamir reonstruct takes an array of objects
                //has attributes: {value: x, sender_id: y, Zp: jiff_instance.Zp}
                reconstruct_parts[i] = { value: zi_shares[party_id].value, sender_id: party_id, Zp: self.Zp };
              }
              // zi prime is my share of the product x*y, it is just like zi, but the polynomial is now of degree n/2
              var zi_prime = exports.sharing_schemes.shamir_reconstruct(o.jiff, reconstruct_parts);
              final_deferred.resolve(zi_prime);
            });
        });

      return result;
    };

    /**
     * bitwise-XOR with a constant (BOTH BITS).
     * @method cxor_bit
     * @param {number} cst - the constant bit to XOR with (0 or 1).
     * @return {secret-share} this party's share of the result.
     * @memberof secret-share
     */
    self.cxor_bit = function(cst) {
      if (!(self.isConstant(cst))) throw "parameter should be a number (^)";
      return self.icadd(cst).issub(self.icmult(cst).icmult(2));
    };

    /**
     * bitwise-OR with a constant (BOTH BITS).
     * @method cor_bit
     * @param {number} cst - the constant bit to OR with (0 or 1).
     * @return {secret-share} this party's share of the result.
     * @memberof secret-share
     */    
    self.cor_bit = function(o) {
      return self.icadd(o).issub(self.icmult(o));
    }

    /**
     * bitwise-XOR of two secret shares OF BITS.
     * @method sxor_bit
     * @param {secret-share} o - the share to XOR with.
     * @param {string} op_id - the operation id which is used to identify this operation.
     *                         This id must be unique, and must be passed by all parties to the same instruction, to
     *                         ensure that corresponding instructions accross different parties are matched correctly [optional].
     * @return {secret-share} this party's share of the result, the final result is 1 if this < o, and 0 otherwise.
     * @return {secret-share} this party's share of the result.
     * @memberof secret-share
     */
    self.sxor_bit = function(o, op_id) {
      if (!(o.jiff === self.jiff)) throw "shares do not belong to the same instance (^)";
      if (!self.jiff.helpers.Zp_equals(self, o)) throw "shares must belong to the same field (^)";
      if (!self.jiff.helpers.array_equals(self.holders, o.holders)) throw "shares must be held by the same parties (^)";

      return self.isadd(o).issub(self.ismult(o, op_id).icmult(2));
    };

    /**
     * OR of two secret shares OF BITS.
     * @method sor_bit
     * @param {secret-share} o - the share to OR with.
     * @param {string} op_id - the operation id which is used to identify this operation.
     *                         This id must be unique, and must be passed by all parties to the same instruction, to
     *                         ensure that corresponding instructions accross different parties are matched correctly [optional].
     * @return {secret-share} this party's share of the result, the final result is 1 if this < o, and 0 otherwise.
     * @return {secret-share} this party's share of the result.
     * @memberof secret-share
     */    
    self.sor_bit = function(o, op_id) {
      return self.isadd(o).issub(self.ismult(o, op_id));
    }

    /**
     * Greater than or equal with another share.
     * @method sgteq
     * @param {secret-share} o - the other share.
     * @param {string} op_id - the operation id which is used to identify this operation.
     *                         This id must be unique, and must be passed by all parties to the same instruction, to
     *                         ensure that corresponding instructions accross different parties are matched correctly [optional].
     * @return {secret-share} this party's share of the result, the final result is 1 if this >= o, and 0 otherwise.
     * @memberof secret-share
     */
    self.sgteq = function(o, op_id) {
      if (!(o.jiff === self.jiff)) throw "shares do not belong to the same instance (>=)";
      if (!self.jiff.helpers.Zp_equals(self, o)) throw "shares must belong to the same field (>=)";
      if (!self.jiff.helpers.array_equals(self.holders, o.holders)) throw "shares must be held by the same parties (>=)";

      if(op_id == null)
        op_id = self.jiff.counters.gen_op_id("c>=", self.holders);

      return self.slt(o, op_id).not();
    };

    /**
     * Greater than with another share.
     * @method sgt
     * @param {secret-share} o - the other share.
     * @param {string} op_id - the operation id which is used to identify this operation.
     *                         This id must be unique, and must be passed by all parties to the same instruction, to
     *                         ensure that corresponding instructions accross different parties are matched correctly [optional].
     * @return {secret-share} this party's share of the result, the final result is 1 if this > o, and 0 otherwise.
     * @memberof secret-share
     */
    self.sgt = function(o, op_id) {
      if (!(o.jiff === self.jiff)) throw "shares do not belong to the same instance (>)";
      if (!self.jiff.helpers.Zp_equals(self, o)) throw "shares must belong to the same field (>)";
      if (!self.jiff.helpers.array_equals(self.holders, o.holders)) throw "shares must be held by the same parties (>)";

      if(op_id == null)
        op_id = self.jiff.counters.gen_op_id("c>", self.holders);

      return o.slt(self, op_id);
    };

    /**
     * Less than or equal with another share.
     * @method slteq
     * @param {secret-share} o - the other share.
     * @param {string} op_id - the operation id which is used to identify this operation.
     *                         This id must be unique, and must be passed by all parties to the same instruction, to
     *                         ensure that corresponding instructions accross different parties are matched correctly [optional].
     * @return {secret-share} this party's share of the result, the final result is 1 if this <= o, and 0 otherwise.
     * @memberof secret-share
     */
    self.slteq = function(o, op_id) {
      if (!(o.jiff === self.jiff)) throw "shares do not belong to the same instance (<=)";
      if (!self.jiff.helpers.Zp_equals(self, o)) throw "shares must belong to the same field (<=)";
      if (!self.jiff.helpers.array_equals(self.holders, o.holders)) throw "shares must be held by the same parties (<=)";

      if(op_id == null)
        op_id = self.jiff.counters.gen_op_id("c<=", self.holders);

      return o.slt(self, op_id).not();
    };

    /**
     * Less than with another share.
     * @method slt
     * @param {secret-share} o - the other share.
     * @param {string} op_id - the operation id which is used to identify this operation.
     *                         This id must be unique, and must be passed by all parties to the same instruction, to
     *                         ensure that corresponding instructions accross different parties are matched correctly [optional].
     * @return {secret-share} this party's share of the result, the final result is 1 if this < o, and 0 otherwise.
     * @memberof secret-share
     */
    self.slt = function(o, op_id) {
      if (!(o.jiff === self.jiff)) throw "shares do not belong to the same instance (<)";
      if (!self.jiff.helpers.Zp_equals(self, o)) throw "shares must belong to the same field (<)";
      if (!self.jiff.helpers.array_equals(self.holders, o.holders)) throw "shares must be held by the same parties (<)";

      if(op_id == null)
        op_id = self.jiff.counters.gen_op_id("<", self.holders);
      
      var w = self.lt_halfprime(op_id+":halfprime:1");
      var x = o.lt_halfprime(op_id+":halfprime:2");
      var y = self.issub(o).lt_halfprime(op_id+":halfprime:3");

      var xy = x.ismult(y, op_id+":smult1");
      return x.icmult(-1).icadd(1).issub(y).isadd(xy).isadd(w.ismult(x.isadd(y).issub(xy.icmult(2)), op_id+":smult2"));
    };

    /**
     * Greater than or equal with a constant.
     * @method cgteqn
     * @param {number} cst - the constant to compare with.
     * @param {string} op_id - the operation id which is used to identify this operation.
     *                         This id must be unique, and must be passed by all parties to the same instruction, to
     *                         ensure that corresponding instructions accross different parties are matched correctly [optional].
     * @return {secret-share} this party's share of the result, the final result is 1 if this >= cst, and 0 otherwise.
     * @memberof secret-share
     */
    self.cgteq = function(cst, op_id) {
      if (!(self.isConstant(cst))) throw "parameter should be a number (>=)";

      if(op_id == null)
        op_id = self.jiff.counters.gen_op_id("c>=", self.holders);

      return self.clt(cst, op_id).not();
    }

    /**
     * Greater than with a constant.
     * @method cgt
     * @param {number} cst - the constant to compare with.
     * @param {string} op_id - the operation id which is used to identify this operation.
     *                         This id must be unique, and must be passed by all parties to the same instruction, to
     *                         ensure that corresponding instructions accross different parties are matched correctly [optional].default ids suffice when all parties execute the
     *                         instructions in the same order. [optional]
     * @return {secret-share} this party's share of the result, the final result is 1 if this > cst, and 0 otherwise.
     * @memberof secret-share
     */
    self.cgt = function(cst, op_id) {
      if (!(self.isConstant(cst))) throw "parameter should be a number (>)";

      if(op_id == null)
        op_id = self.jiff.counters.gen_op_id("c<", self.holders);
      
      var w = share_helpers['<'](cst, share_helpers['/'](self.Zp, 2)) ? 1 : 0;
      var x = self.lt_halfprime(op_id+":halfprime:1");
      var y = self.icmult(-1).icadd(cst).lt_halfprime(op_id+":halfprime:2");

      var xy = y.ismult(x, op_id+":smult1");
      return x.icmult(-1).icadd(1).issub(y).isadd(xy).isadd(x.isadd(y).issub(xy.icmult(2)).icmult(w));
    };

    /**
     * Less than or equal with a constant.
     * @method clteq
     * @param {number} cst - the constant to compare with.
     * @param {string} op_id - the operation id which is used to identify this operation.
     *                         This id must be unique, and must be passed by all parties to the same instruction, to
     *                         ensure that corresponding instructions accross different parties are matched correctly [optional].
     * @return {secret-share} this party's share of the result, the final result is 1 if this <= cst, and 0 otherwise.
     * @memberof secret-share
     */
    self.clteq = function(cst, op_id) {
      if (!(self.isConstant(cst))) throw "parameter should be a number (<=)";

      if(op_id == null)
        op_id = self.jiff.counters.gen_op_id("c<=", self.holders);

      return self.cgt(cst, op_id).not();
    };

    /**
     * Less than with a constant.
     * @method clt
     * @param {number} cst - the constant to compare with.
     * @param {string} op_id - the operation id which is used to identify this operation.
     *                         This id must be unique, and must be passed by all parties to the same instruction, to
     *                         ensure that corresponding instructions accross different parties are matched correctly [optional].
     * @return {secret-share} this party's share of the result, the final result is 1 if this < cst, and 0 otherwise.
     * @memberof secret-share
     */
    self.clt = function(cst, op_id) {
      if (!(self.isConstant(cst))) throw "parameter should be a number (<)";

      if(op_id == null)
        op_id = self.jiff.counters.gen_op_id("c<", self.holders);
      
      var w = self.lt_halfprime(op_id+":halfprime:1");
      var x = share_helpers['<'](cst, share_helpers['/'](self.Zp, 2)) ? 1 : 0;
      var y = self.icsub(cst).lt_halfprime(op_id+":halfprime:2");

      var xy = y.icmult(x);
      return y.icmult(-1).icadd(1-x).isadd(xy).isadd(w.ismult(y.icadd(x).issub(xy.icmult(2)), op_id+":smult1"));
    };

    /**
     * Equality test with two shares.
     * @method seq
     * @param {secret-share} o - the share to compare with.
     * @param {string} op_id - the operation id which is used to identify this operation.
     *                         This id must be unique, and must be passed by all parties to the same instruction, to
     *                         ensure that corresponding instructions accross different parties are matched correctly [optional].
     * @return {secret-share} this party's share of the result, the final result is 1 if this = o, and 0 otherwise.
     * @memberof secret-share
     */
    self.seq = function(o, op_id) {
      if (!(o.jiff === self.jiff)) throw "shares do not belong to the same instance (==)";
      if (!self.jiff.helpers.Zp_equals(self, o)) throw "shares must belong to the same field (==)";
      if (!self.jiff.helpers.array_equals(self.holders, o.holders)) throw "shares must be held by the same parties (==)";

      if(op_id == null)
        op_id = self.jiff.counters.gen_op_id("=", self.holders);

      var one_direction = self.islt(o, op_id+":<=");
      var other_direction = self.isgt(o, op_id+":>=");
      return one_direction.isadd(other_direction).not();
    };

    /**
     * Unequality test with two shares.
     * @method sneq
     * @param {secret-share} o - the share to compare with.
     * @param {string} op_id - the operation id which is used to identify this operation.
     *                         This id must be unique, and must be passed by all parties to the same instruction, to
     *                         ensure that corresponding instructions accross different parties are matched correctly [optional].
     * @return {secret-share} this party's share of the result, the final result is 0 if this = o, and 1 otherwise.
     * @memberof secret-share
     */
    self.sneq = function(o, op_id) {
      if (!(o.jiff === self.jiff)) throw "shares do not belong to the same instance (!=)";
      if (!self.jiff.helpers.Zp_equals(self, o)) throw "shares must belong to the same field (!=)";
      if (!self.jiff.helpers.array_equals(self.holders, o.holders)) throw "shares must be held by the same parties (!=)";
      return self.seq(o, op_id).not();
    };

    /**
     * Equality test with a constant.
     * @method ceq
     * @param {number} cst - the constant to compare with.
     * @param {string} op_id - the operation id which is used to identify this operation.
     *                         This id must be unique, and must be passed by all parties to the same instruction, to
     *                         ensure that corresponding instructions accross different parties are matched correctly [optional].
     * @return {secret-share} this party's share of the result, the final result is 0 if this = o, and 1 otherwise.
     * @memberof secret-share
     */
    self.ceq = function(cst, op_id) {
      if (!(self.isConstant(cst))) throw "parameter should be a number (==)";

      if(op_id == null)
        op_id = self.jiff.counters.gen_op_id("c=", self.holders);

      var one_direction = self.iclt(cst, op_id+":<=");
      var other_direction = self.icgt(cst, op_id+":>=");
      return one_direction.isadd(other_direction).not();
    };

    /**
     * Unequality test with a constant.
     * @method cneq
     * @param {number} cst - the constant to compare with.
     * @param {string} op_id - the operation id which is used to identify this operation.
     *                         This id must be unique, and must be passed by all parties to the same instruction, to
     *                         ensure that corresponding instructions accross different parties are matched correctly [optional].
     * @return {secret-share} this party's share of the result, the final result is 0 if this = o, and 1 otherwise.
     * @memberof secret-share
     */
    self.cneq = function(cst, op_id) {
      if (!(self.isConstant(cst))) throw "parameter should be a number (!=)";
      return self.ceq(cst, op_id).not();
    };

    /**
     * Negation of a bit.
     * This has to be a share of a BIT in order for this to work properly.
     * @method not
     * @return {secret-share} this party's share of the result (negated bit).
     * @memberof secret-share
     */
    self.not = function() {
      return self.icmult(-1).icadd(1);
    }

    /**
     * Integer divison with two shares (self / o)
     * @method sdiv
     * @param {secret-share} o - the share to divide by.
     * @param {number} l - the maximum bit length of the answer. [optional]
     * @param {string} op_id - the operation id which is used to identify this operation.
     *                         This id must be unique, and must be passed by all parties to the same instruction, to
     *                         ensure that corresponding instructions accross different parties are matched correctly [optional].
     * @return {secret-share} this party's share of the result.
     * @memberof secret-share
     */
    self.sdiv = function(o, l, op_id) {
      if (!(o.jiff === self.jiff)) throw "shares do not belong to the same instance (!=)";
      if (!self.jiff.helpers.Zp_equals(self, o)) throw "shares must belong to the same field (!=)";
      if (!self.jiff.helpers.array_equals(self.holders, o.holders)) throw "shares must be held by the same parties (!=)";

      if(op_id == null)
        op_id = self.jiff.counters.gen_op_id("/", self.holders);

      if(l == null) l = share_helpers['floor'](self.jiff.helpers.bLog(self.Zp, 2));

      // Store the result
      var final_deferred = $.Deferred();
      var final_promise = final_deferred.promise();
      var result = self.jiff.secret_share(self.jiff, false, final_promise, undefined, self.holders, max(self.threshold, o.threshold), self.Zp, "share:"+op_id);

      var q = self.jiff.server_generate_and_share({"number": 0}, self.holders, max(self.threshold, o.threshold), self.Zp, op_id+":number");
      var a = self; // dividend

      (function one_bit(i) {
        if(i >= l) { 
          // we did this for all bits, q has the answer
          if(q.ready) final_deferred.resolve(q.value);
          else q.promise.then(function() { final_deferred.resolve(q.value); });
          return;
        }
        
        var power = share_helpers['pow'](2, (l-1)-i);
        var ZpOVERpower = share_helpers['floor/'](o.Zp, power);
        // (2^i + 2^k + ...) * o <= self
        // 2^l * o <= self => q = 2^l, self = self - o * 2^l
        var tmp = o.icmult(power); // this may wrap around, in which case we must ignored it, since the answer MUST fit in the field.
        var tmpFits = o.iclteq(ZpOVERpower, op_id+":c<="+i);
        var tmpCmp = tmp.islteq(a, op_id+":<="+i);

        var and = tmpFits.ismult(tmpCmp, op_id+":smult1:"+i);
        q = q.isadd(and.icmult(power));
        a = a.issub(and.ismult(tmp, op_id+":smult2:"+i)); // a - tmp > 0 if tmp > 0

        Promise.all([q.promise, a.promise]).then(function() { one_bit(i+1); });
      })(0);
      return result;
    };

    /**
     * Integer divison with a share and a constant (self / cst).
     * @method cdiv
     * @param {secret-share} cst - the constant to divide by.
     * @param {string} op_id - the operation id which is used to identify this operation.
     *                         This id must be unique, and must be passed by all parties to the same instruction, to
     *                         ensure that corresponding instructions accross different parties are matched correctly [optional].
     * @return {secret-share} this party's share of the result.
     * @memberof secret-share
     */
    self.cdiv = function(cst, op_id) {
      if (!(self.isConstant(cst))) throw "parameter should be a number (/)";

      if(op_id == null)
        op_id = self.jiff.counters.gen_op_id("c/", self.holders);

      // Allocate share for result to which the answer will be resolved once available
      var final_deferred = $.Deferred();
      var final_promise = final_deferred.promise();
      var result = self.jiff.secret_share(self.jiff, false, final_promise, undefined, self.holders, self.threshold, self.Zp, "share:"+op_id);

      var ZpOVERc = share_helpers['floor/'](self.Zp, cst);

      // add uniform noise to self so we can open
      var nOVERc = self.jiff.server_generate_and_share({ "max":  ZpOVERc }, self.holders, self.threshold, self.Zp, op_id+":nOVERc");
      var nMODc = self.jiff.server_generate_and_share({ "max": cst }, self.holders, self.threshold, self.Zp, op_id+":nMODc");
      var noise = nOVERc.icmult(cst).isadd(nMODc);

      var noisyX = self.isadd(noise);
      self.jiff.internal_open(noisyX, noisyX.holders, op_id+":open").then(function(noisyX) {
        var wrapped = self.icgt(noisyX, op_id+":wrap_cgt"); // 1 => x + noise wrapped around Zp, 0 otherwise

        // if we did not wrap
        var noWrapDiv = share_helpers['floor/'](noisyX, cst);
        var unCorrectedQuotient = nOVERc.icmult(-1).icadd(noWrapDiv).icsub(1);
        var verify = self.issub(unCorrectedQuotient.icmult(cst));
        var isNotCorrect = verify.icgteq(cst, op_id+":cor1");
        var noWrapAnswer = unCorrectedQuotient.isadd(isNotCorrect); // if incorrect => isNotCorrect = 1 => quotient = unCorrectedQuotient - 1

        // if we wrapped
        var wrapDiv = share_helpers['floor/'](share_helpers['+'](noisyX, self.Zp), cst);
        unCorrectedQuotient = nOVERc.icmult(-1).icadd(wrapDiv).icsub(1);
        verify = self.issub(unCorrectedQuotient.icmult(cst));
        isNotCorrect = verify.icgteq(cst, op_id+":cor2");
        var wrapAnswer = unCorrectedQuotient.isadd(isNotCorrect); // if incorrect => isNotCorrect = 1 => quotient = unCorrectedQuotient - 1

        var answer = noWrapAnswer.isadd(wrapped.ismult(wrapAnswer.issub(noWrapAnswer), op_id+":smult"));

        if(answer.ready) final_deferred.resolve(answer.value);
        else answer.promise.then(function() { final_deferred.resolve(answer.value); });
      });

      // special case, if result is zero, sometimes we will get to -1 due to how correction happens aboe (.csub(1) and then compare)
      var zeroIt = self.clt(cst, op_id+":zero_check").not();
      return result.ismult(zeroIt, op_id+":zero_it");
    };

    /**
     * Checks whether the share is less than half the field size.
     * @method lt_halfprime
     * @param {string} op_id - the operation id which is used to identify this operation.
     *                         This id must be unique, and must be passed by all parties to the same instruction, to
     *                         ensure that corresponding instructions accross different parties are matched correctly [optional].
     * @return {secret-share} this party's share of the result.
     * @memberof secret-share
     */
    self.lt_halfprime = function(op_id) {
      if(op_id == null)
        op_id = self.jiff.counters.gen_op_id("lt_hp", self.holders);

      var final_deferred = $.Deferred();
      var final_promise = final_deferred.promise();
      var result = self.jiff.secret_share(self.jiff, false, final_promise, undefined, self.holders, self.threshold, self.Zp, "share:"+op_id);

      // if 2*self is even, then self is less than half prime, otherwise self is greater or equal to half prime
      var share = self.icmult(2);

      // To check if share is even, we will use pre-shared bits as some form of a bit mask
      var bitLength = share_helpers['floor'](self.jiff.helpers.bLog(share.Zp, 2)); // TODO: this leaks one bit, fix it for mod 2^n
      var bits = []; // this will store the bit representation of random noise, bits[0] = least significant bit
      for(var i = 0; i < bitLength; i++)
          bits[i] = self.jiff.server_generate_and_share({ "bit": true }, share.holders, share.threshold, share.Zp, op_id+":number:"+i);
      bits[bitLength] = self.jiff.server_generate_and_share({ "number": 0 }, share.holders, share.threshold, share.Zp, op_id+":number:"+bitLength); // remove this line when fixing TODO

      // bit composition: r = (rl ... r1 r0)_10
      var r = self.jiff.protocols.bit_composition(bits);
      // open share + noise, and utilize opened value with shared bit representation of noise to check the least significant digit of share.
      share.jiff.internal_open(r.isadd(share), share.holders).then(function(result) {
        var wrapped = self.jiff.protocols.clt_bits(result, bits, op_id);
        var isOdd = self.jiff.helpers.mod(result, 2);
        isOdd = bits[0].icxor_bit(isOdd);
        isOdd = isOdd.isxor_bit(wrapped, op_id+":sxor_bit");

        var answer = isOdd.not();
        if(answer.ready) final_deferred.resolve(answer.value);
        else answer.promise.then(function() { final_deferred.resolve(answer.value); });
      });

      return result;
    };

    // when the promise is resolved, acquire the value of the share and set ready to true
    if(!ready) self.promise.then(self.receive_share, self.error);

    // internal variant of primitives, to use internally by other primitives
    var internals = [ "cadd", "csub", "cmult", "sadd", "ssub", "smult",
                      "cxor_bit", "sxor_bit", "cor_bit", "sor_bit",
                      "slt", "slteq", "sgt", "sgteq", "seq", "sneq",
                      "clt", "clteq", "cgt", "cgteq", "ceq", "cneq",
                      "sdiv", "cdiv", "lt_halfprime" ];
    for(var i = 0; i < internals.length; i++) {
      var key = internals[i];
      self['i'+key] = self[key];
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
   * @instance
   * @param {string} hostname - server hostname/ip and port.
   * @param {string} computation_id - the id of the computation of this instance.
   * @param {object} options - javascript object with additonal options. [optional],
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
    "Zp": (default modulos: number/BigNumber),
    "autoConnect": true/false,
    "hooks": { 'check out <a href="hooks.html">hooks documentation</a>' },
    "listeners" : A map from custom tags to listeners (of type function(sender_id, message_string)) that handle custom messages with that tag.
    "onConnect": function(jiff_instance)
  }
  </pre>
   *
   * @returns {jiff-instance} the jiff instance for the described computation.
   *                          The Jiff instance contains the socket, number of parties, functions
   *                          to share and perform operations, as well as synchronization flags.
   *
   */
  function make_jiff(hostname, computation_id, options) {
    if(options == null) options = {};

    var jiff = {};

    /**
     * An array containing the names (jiff-client-[name].js) of extensions
     * applied to this instance.
     * @member {string[]} modules
     * @memberof jiff-instance
     * @instance
     */
    jiff.modules = [];

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
    jiff.isReady = function() { return jiff.__ready; }

    // Setup default Zp for this instance
    jiff.Zp = (options.Zp == null ? gZp : options.Zp);

    // Setup sockets.
    var guard_socket = function(socket) {
      // Outgoing messages mailbox (linked list)
      socket.mailbox = linked_list();

      // Store message in the mailbox until acknowledgment is received
      socket.safe_emit = function(label, msg) {
        // add message to mailbox
        var mailbox_pointer = socket.mailbox.add({ "label": label, "msg": msg });
        if(socket.connected)
          // emit the message, if an acknowledgment is received, remove it from mailbox
          socket.emit(label, msg, function(status) {
            if(status) socket.mailbox.delete(mailbox_pointer);
          });
      };

      // Resend all pending messages
      socket.resend_mailbox = function() {
        // Create a new mailbox, since the current mailbox will be resent and
        // will contain new backups.
        var old_mailbox = socket.mailbox;
        socket.mailbox = linked_list();

        // loop over all stored messages and emit them
        var current_node = old_mailbox.head;
        while(current_node != null) {
          var label = current_node.object.label;
          var msg = current_node.object.msg;
          // this emit could potentially fail, use safe emit instead.
          socket.safe_emit(label, msg);

          current_node = current_node.next;
        }
      };

      return socket;
    };

    // setup main socket
    jiff.socket = (options.__internal_socket == null ? io(hostname, { autoConnect: false }) : options.__internal_socket);
    if(options.__internal_socket == null) guard_socket(jiff.socket);
    else {
      jiff.socket.safe_emit = jiff.socket.emit;
      jiff.socket.resend_mailbox = function() { };
    }

    // setup aux sockets
    if(options.triplets_server == null || options.triplets_server == hostname)
      jiff.triplets_socket = jiff.socket;
    else {
      jiff.triplets_socket = guard_socket(io(options.triplets_server));
      jiff.triplets_socket.on('connect', jiff.triplets_socket.resend_mailbox);
    }

    if(options.numbers_server == null || options.numbers_server == hostname)
      jiff.numbers_socket = jiff.socket;
    else {
      jiff.numbers_socket = guard_socket(io(options.numbers_server));
      jiff.numbers_socket.on('connect', jiff.numbers_socket.resend_mailbox);
    }

    // Parse options
    if(options.onError == null) options.onError = console.log;

    if(options.public_keys != null) {
      /**
       * A map from party id to public key. Where key is the party id (number), and
       * value is the public key (Uint8Array).
       * @member {object} keymap
       * @memberof jiff-instance
       * @instance
       */
      jiff.keymap = options.public_keys;
    }

    else if(options.secret_key != null && options.public_key != null) {
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

    if(options.party_count != null)
      /**
       * Total party count in the computation, parties will take ids between 1 to party_count (inclusive).
       * @member {number} party_count
       * @memberof jiff-instance
       * @instance
       */
      jiff.party_count = options.party_count;

    if(options.listeners == null)
      options.listeners = {};

    /**
     * A map from tags to listeners (functions that take a sender_id and a string message).
     * Stores listeners that are attached to this JIFF instance, listeners listen to custom messages sent by other parties
     * with a corresponding tag to the tag provided with the listener.
     * @member {object} listeners
     * @memberof jiff-instance
     * @instance
     */
    jiff.listeners = options.listeners

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
     * The hooks for this instance.
     * Checkout the <a href="hooks.html">hooks documentation</a>
     * @member {object} hooks
     * @memberof jiff-instance
     * @instance
     */
    jiff.hooks = options.hooks;

    // Default hooks:
    if(jiff.hooks == null) jiff.hooks = {};
    if(jiff.hooks.computeShares == null) jiff.hooks.computeShares = jiff_compute_shares;
    if(jiff.hooks.reconstructShare == null) jiff.hooks.reconstructShare = jiff_lagrange;
    if(jiff.hooks.encryptSign == null) jiff.hooks.encryptSign = encrypt_and_sign;
    if(jiff.hooks.decryptSign == null) jiff.hooks.decryptSign = decrypt_and_sign;

    // Array hooks should have empty array by default
    if(jiff.hooks.beforeShare == null) jiff.hooks.beforeShare = [];
    if(jiff.hooks.afterComputeShare == null) jiff.hooks.afterComputeShare = [];
    if(jiff.hooks.receiveShare == null) jiff.hooks.receiveShare = [];
    if(jiff.hooks.beforeOpen == null) jiff.hooks.beforeOpen = [];
    if(jiff.hooks.receiveOpen == null) jiff.hooks.receiveOpen = [];
    if(jiff.hooks.afterReconstructShare == null) jiff.hooks.afterReconstructShare = [];
    if(jiff.hooks.receiveTriplet == null) jiff.hooks.receiveTriplet = [];
    if(jiff.hooks.receiveNumber == null) jiff.hooks.receiveNumber = [];
    if(jiff.hooks.createSecretShare == null) jiff.hooks.createSecretShare = [];

    /**
     * Execute all hooks attached to the given name in order.
     * Hooks are executed sequentially such that the first hook's return value is passed into the second and so on.
     * @method execute_array_hooks
     * @memberof jiff-instance
     * @instance
     * @param {string} hook_name - the name of the hook
     * @param {array} params - parameters to pass to the hooks
     * @param {number} acc_index - the index in params in which the result of the hooks must be saved, if no hooks
     *                             exist for the name, then params[acc_index] is returned.
     * @return returns the result of the [last] hook.
     */
    jiff.execute_array_hooks = function(hook_name, params, acc_index) {
      var arr = jiff.hooks[hook_name];
      arr = (arr == null ? [] : arr);

      for(var i = 0; i < arr.length; i++)
        params[acc_index] = arr[i].apply(jiff, params);
      return params[acc_index];
    };

    /**
     * Stores the parties and callbacks for every .wait_for() registered.
     * @member {array} wait_callbacks
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
     * @param {array} parties - an array of party ids to wait for.
     * @param {function(jiff-instance)} callback - the function to execute when these parties are known.
     */
    jiff.wait_for = function(parties, callback) {
      // server is always needed
      if(parties.indexOf("s1") == -1) parties.push("s1");

      jiff.wait_callbacks.push({ parties: parties, callback: callback });
      jiff.execute_wait_callbacks(); // See if the callback can be executed immediadtly
    }

    /**
     * Executes all callbacks for which the wait condition has been satisified.
     * Remove all executed callbacks so that they would not be executed in the future.
     * @memberof jiff-instance
     * @instance
     */
    jiff.execute_wait_callbacks = function() {
      if(jiff.secret_key == null || jiff.public_key == null) return;

      var new_waits = [];
      for(var i = 0; i < jiff.wait_callbacks.length; i++) {
        var wait = jiff.wait_callbacks[i];
        var parties = wait.parties;
        var callback = wait.callback;

        // Check if the parties to wait for are now known
        var parties_satisified = true;
        for(var j = 0; j < parties.length; j++) {
          var party_id = parties[j];
          if(jiff.keymap == null || jiff.keymap[party_id] == null) {
            parties_satisified = false;
            break;
          }
        }

        if(parties_satisified) callback(jiff);
        else new_waits.push(wait);
      };

      jiff.wait_callbacks = new_waits;
    }

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
     */
    jiff.connect = function() {
      // Send the computation id to the server to receive proper
      // identification
      if(options.__internal_socket == null) {
        jiff.socket.on('connect', function() {
          jiff.socket.emit("computation_id", JSON.stringify({ "computation_id": computation_id, "party_id": jiff.id, "party_count": jiff.party_count }));
        });
        jiff.socket.connect();
      }
      else
        jiff.socket.emit("computation_id", JSON.stringify({ "computation_id": computation_id, "party_id": jiff.id, "party_count": jiff.party_count }));
    }
    if(!(options.autoConnect === false)) jiff.connect();

    /**
     * Send a custom message to a subset of parties.
     * Please Note that the message is sent unencrypted and the server can read/forge it.
     * Use jiff.hooks.encryptSign / jiff.hooks.decryptSign to encrypt/sign.
     * If the sending party id was provided as a receiver, it is ignored.
     * @memberof jiff-instance
     * @function emit
     * @instance
     * @param {string} tag - the tag to attach to the message.
     * @param {array} receivers - contains the party ids to receive the message, all non-server parties if null.
     * @param {string} message - the message to send.
     */
    jiff.emit = function(tag, receivers, message) {
      if(receivers == null) {
        receivers = [];
        for(var i = 1; i <= jiff.party_count; i++) receivers.push(i);
      } else {
        receivers = receivers.slice();
      }

      // Remove own index from receivers
      var index = receivers.indexOf(jiff.id);
      if(index > -1) receivers.splice(index, 1);

      if(receivers.length > 0)
        jiff.socket.safe_emit("custom", JSON.stringify( {'tag': tag, 'receivers': receivers, 'message': message } ));
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
    jiff.listen = function(tag, handler) {
      jiff.listeners[tag] = handler;

      var stored_messages = jiff.custom_messages_mailbox[tag];
      if(stored_messages == null) return;

      for(var i = 0; i < stored_messages.length; i++) {
        var sender_id = stored_messages[i].sender_id;
        var message = stored_messages[i].message;
        handler(sender_id, message);
      }

      delete jiff.custom_messages_mailbox[tag];
    }

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
     * @param {number} y - the modulos.
     * @return {number} x mod y.
     */
    jiff.helpers.mod = function(x, y) {
      if (x < 0) return (x % y) + y;
      return x % y;
    };

    /**
     * Fast Exponentiation Mod.
     * @memberof jiff-instance.helpers
     * @function pow_mod
     * @instance
     * @param {number} base - the base number.
     * @param {number} pow - the power.
     * @param {number} m - the modulos.
     * @return {number} (base^pow) mod m.
     */
    jiff.helpers.pow_mod = function(a, b, n) {
      a = jiff.helpers.mod(a, n);
      var result = 1;
      var x = a;
      while(b > 0) {
        var leastSignificantBit = jiff.helpers.mod(b, 2);
        b = Math.floor(b / 2);
        if (leastSignificantBit == 1) {
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
     * @param {number} b - the modulos.
     * @return {number} inverse of a mod b.
     */
    jiff.helpers.extended_gcd = function(a, b) {
      if (b == 0)
        return [1, 0, a];

      temp = jiff.helpers.extended_gcd(b, jiff.helpers.mod(a, b));
      x = temp[0]; y = temp[1]; d = temp[2];
      return [y, x - y * Math.floor(a / b), d];
    };

    /**
     * Compute Log to a given base.
     * @method bLog
     * @memberof jiff-instance.helpers
     * @instance
     * @param {number} value - the number to find log for.
     * @param {number} base - the base (2 by default). [optional]
     * @return {number} log(value) with the given base.
     */
    jiff.helpers.bLog = function(value, base) {
      if(base == null) base = 2;
      return Math.log(value) / Math.log(base);
    };

    /**
     * Check that two sorted arrays are equal.
     * @method array_equals
     * @memberof jiff-instance.helpers
     * @instance
     * @param {array} arr1 - the first array.
     * @param {array} arr2 - the second array.
     * @return {boolean} true if arr1 is equal to arr2, false otherwise.
     */
    jiff.helpers.array_equals = function(arr1, arr2) {
      if(arr1.length != arr2.length) return false;

      for(var i = 0; i < arr1.length; i++)
        if(arr1[i] !== arr2[i]) return false;

      return true;
    };

    /**
     * Check that two Zps are equal. Used to determine if shares can be computed on or not.
     * @method Zp_equals
     * @memberof jiff-instance.helpers
     * @instance
     * @param {secret-share} s1 - the first share.
     * @param {secret-share} s2 - the second share.
     * @return {boolean} true both shares have the same Zp, false otherwise.
     */
    jiff.helpers.Zp_equals = function(s1, s2) {
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
    jiff.helpers.random = function(max) {
      // Use rejection sampling to get random value with normal distribution
      // Generate random Uint8 values of 1 byte larger than the max parameter
      // Reject if random is larger than quotient * max (remainder would cause biased distribution), then try again
      if(max == null) max = jiff.Zp;
      // Values up to 2^53 should be supported, but log2(2^49) === log2(2^49+1), so we lack the precision to easily
      // determine how many bytes are required
      if(max > 562949953421312) throw new RangeError('Max value should be smaller than or equal to 2^49');

      // Polyfill from https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/log2
      // TODO should we use Babel for this?
      Math.log2 = Math.log2 || function(x) {
        return Math.log(x) * Math.LOG2E;
      };
      var bitsNeeded = Math.ceil(Math.log2(max));
      var bytesNeeded = Math.ceil(bitsNeeded / 8);
      var maxValue = Math.pow(256, bytesNeeded);

      // Keep trying until we find a random value within a normal distribution
      while (true) {
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
    jiff.helpers.get_party_number = function(party_id) {
      if (typeof(party_id) == "number") return party_id;
      if (party_id.startsWith("s")) return jiff.party_count + parseInt(party_id.substring(1), 10);
      return parseInt(party_id, 10);
    };

    /**
     * The function used by JIFF to create a new share. This can be used by modules to create custom shares.
     * Modifying this will modify how shares are generated in the BASE JIFF implementation.
     * A share is a value wrapper with a share object, it has a unique id
     * (per computation instance), and a pointer to the instance it belongs to.
     * A share also has methods for performing operations.
     * @memberof jiff-instance
     * @method secret_share
     * @param {jiff-instance} jiff - the jiff instance.
     * @param {boolean} ready - whether the value of the share is ready or deferred.
     * @param {promise} promise - a promise to the value of the share.
     * @param {number} value - the value of the share (null if not ready).
     * @param {array} holders - the parties that hold all the corresponding shares (must be sorted).
     * @param {number} threshold - the minimimum number of parties needed to reconstruct the secret.
     * @param {number} Zp - the modulos under which this share was created.
     * @returns {secret-share} the secret share object containing the give value.
     *
     */
    jiff.secret_share = secret_share;

    /**
     * Share a secret input.
     * @method share
     * @memberof jiff-instance
     * @instance
     * @param {number} secret - the number to share (this party's input).
     * @param {number} threshold - the minimimum number of parties needed to reconstruct the secret, defaults to all the recievers. [optional]
     * @param {array} receivers_list - array of party ids to share with, by default, this includes all parties. [optional]
     * @param {array} senders_list - array of party ids to receive from, by default, this includes all parties. [optional]
     * @param {number} Zp - the modulos (if null then the default Zp for the instance is used). [optional]
     * @param {string/number} share_id - the tag used to tag the messages sent by this share operation, this tag is used
     *                                   so that parties distinguish messages belonging to this share operation from other
     *                                   share operations between the same parties (when the order of execution is not
     *                                   deterministic). An automatic id is generated by increasing a local counter, default
     *                                   ids suffice when all parties execute all sharing operations with the same senders
     *                                   and receivers in the same order. [optional]
     * @returns {object} a map (of size equal to the number of parties)
     *          where the key is the party id (from 1 to n)
     *          and the value is the share object that wraps
     *          the value sent from that party (the internal value maybe deferred).
     */
    jiff.share = function(secret, threshold, receivers_list, senders_list, Zp, share_id) { return jiff.internal_share(secret, threshold, receivers_list, senders_list, Zp, share_id); };
    
    /**
     * Same as jiff-instance.share, but used by internal JIFF primitives/protocols (bgw).
     */
    jiff.internal_share = function(secret, threshold, receivers_list, senders_list, Zp, share_id) { return jiff_share(jiff, secret, threshold, receivers_list, senders_list, Zp, share_id); };

    /**
     * Share an array of values. Each sender may have an array of different length. This is handled by the lengths parameter.
     * This function will reveal the lengths of the shared array.
     * If parties would like to keep the lengths of their arrays secret, they should agree on some "max" length apriori (either under MPC
     * or as part of the logistics of the computation), all their arrays should be padded to that length by using approriate default/identity
     * values. 
     * @method share_array
     * @memberof jiff-instance
     * @instance
     * @param {array} array - the array to be shared.
     * @param {null|number|object} lengths - the lengths of the arrays to be shared, has the following options:
     *                                       1. null: lengths are unknown, each sender will publicly reveal the lengths of its own array.
     *                                       2. number: all arrays are of this length
     *                                       3. object: { 'sender_party_id': length }: must specify the length of the array for each sender.
     * @param {number} threshold - the minimimum number of parties needed to reconstruct the secret, defaults to all the recievers. [optional]
     * @param {array} receivers_list - array of party ids to share with, by default, this includes all parties. [optional]
     * @param {array} senders_list - array of party ids to receive from, by default, this includes all parties. [optional]
     * @param {number} Zp - the modulos (if null then the default Zp for the instance is used). [optional]
     * @param {string|number} base_share_id - the base tag used to tag the messages sent by this share operation, every element of the array
     *                                   will get a unique id based on the concatenation of base_share_id and the index of the element.
     *                                   This tag is used so that parties distinguish messages belonging to this share operation from
     *                                   other share operations between the same parties (when the order of execution is not
     *                                   deterministic). An automatic id is generated by increasing a local counter, default
     *                                   ids suffice when all parties execute all sharing operations with the same senders
     *                                   and receivers in the same order. [optional]
     * @returns {promise} if the calling party is a receiver then a promise to the shared arrays is returned, the promise will provide an object 
     *                    formated as follows: { <party_id>: [ <1st_share>, <2nd_share>, ..., <(lengths[party_id])th_share> ] }
     *                    where the party_ids are those of the senders.
     *                    if the calling party is not a receiver, then null is returned.
     */
    jiff.share_array = function(array, lengths, threshold, receivers_list, senders_list, Zp, share_id) {
      return jiff_share_array(jiff, array, lengths, threshold, receivers_list, senders_list, Zp, share_id);
    }

    /**
     * Open a secret share to reconstruct secret.
     * @method open
     * @memberof jiff-instance
     * @instance
     * @param {secret-share} share - this party's share of the secret to reconstruct.
     * @param {array} parties - an array with party ids (1 to n) of receiving parties. [optional]
     * @param {string/number/object} op_ids - an optional mapping that specifies the ID/Tag associated with each
     *                                        open message sent.
     *                                        If this is an object, then it should map an id of a receiving parties
     *                                        to the op_id that should be used to tag the message sent to that party.
     *                                        Parties left unmapped by this object will get an automatically generated id.
     *                                        If this is a number/string, then it will be used as the id tagging all messages
     *                                        sent by this open to all parties.
     *                                        You can saftly ignore this unless you have multiple opens each containing other opens.
     *                                        In that case, the order by which these opens are executed is not fully deterministic
     *                                        and depends on the order of arriving messages. In this case, use this parameter
     *                                        with every nested_open, to ensure ids are unique and define a total ordering on
     *                                        the execution of the opens (check implementation of sgteq for an example).
     *                                        TODO: automate this for the described scenario.
     * @returns {promise} a (JQuery) promise to the open value of the secret.
     * @throws error if share does not belong to the passed jiff instance.
     */
    jiff.open = function(share, parties, op_ids) { return jiff.internal_open(share, parties, op_ids); };

    /**
     * Same as jiff-instance.open, but used by internal JIFF primitives/protocols (comparisons and secret multiplication).
     */
    jiff.internal_open = function(share, parties, op_ids) { return jiff_open(jiff, share, parties, op_ids); };

    /**
     * Opens a bunch of secret shares.
     * @method open_all
     * @memberof jiff-instance
     * @instance
     * @param {secret-share[]} shares - an array containing this party's shares of the secrets to reconstruct.
     * @param {array} parties - an array with party ids (1 to n) of receiving parties. [optional]
     *                          This must be one of 3 cases:
     *                          1. null:                       open all shares to all parties.
     *                          2. array of numbers:           open all shares to all the parties specified in the array.
     *                          3. array of array of numbers:  open share with index i to the parties specified
     *                                                         in the nested array at parties[i]. if parties[i] was null,
     *                                                         then shares[i] will be opened to all parties.
     * @returns {promise} a (JQuery) promise to ALL the open values of the secret, the promise will yield
     *                    an array of values, each corresponding to the given share in the shares parameter
     *                    at the same index.
     * @throws error if some shares does not belong to the passed jiff instance.
     */
    jiff.open_all = function(shares, parties) { return jiff_open_all(jiff, shares, parties); };

    /**
     * Receive shares from the specified parties and reconstruct their secret.
     * Use this function in a party that will receive some answer/value but does not have a share of it.
     * @method receive_open
     * @memberof jiff-instance
     * @instance
     * @param {array} parties - an array with party ids (1 to n) specifying the parties sending the shares.
     * @param {number} threshold - the minimimum number of parties needed to reconstruct the secret, defaults to all the senders. [optional]
     * @param {number} Zp - the modulos (if null then the default Zp for the instance is used). [optional]
     * @param {string/number/object} op_ids - same as jiff-instance.open(..)
     * @returns {promise} a (JQuery) promise to the open value of the secret.
     */
    jiff.receive_open = function(parties, threshold, Zp, op_ids) {
      if(Zp == null) Zp = jiff.Zp;
      return jiff_open(jiff, jiff.secret_share(jiff, true, null, null, parties, (threshold == null ? parties.length : threshold), Zp), [ jiff.id ], op_ids);
    };

    /**
     * Creates 3 shares, a share for every one of three numbers from a beaver triplet.
     * The server generates and sends the triplets on demand.
     * @method triplet
     * @memberof jiff-instance
     * @instance
     * @param {array} receivers_list - array of party ids that want to receive the triplet shares, by default, this includes all parties. [optional]
     * @param {number} threshold - the minimimum number of parties needed to reconstruct the triplet.
     * @param {number} Zp - the modulos (if null then the default Zp for the instance is used). [optional]
     * @param {string} triplet_id - the triplet id which is used to identify the triplet requested, so that every party
     *                              gets a share from the same triplet for every matching instruction. An automatic triplet id
     *                              is generated by increasing a local counter, default ids suffice when all parties execute the
     *                              instructions in the same order. [optional]
     * @returns an array of 3 secret-shares [share_a, share_b, share_c] such that a * b = c.
     */
    jiff.triplet = function(receivers_list, threshold, Zp, triplet_id) { return jiff_triplet(jiff, receivers_list, threshold, Zp, triplet_id); };

    /**
     * Use the server to generate shares for a random bit, zero, random non-zero number, or a random number.
     * The parties will not know the value of the number (unless the request is for shares of zero) nor other parties' shares.
     * @method server_generate_and_share
     * @memberof jiff-instance
     * @instance
     * @param {object} options - an object with these properties:
     *                           { "number": number, "bit": boolean, "nonzero": boolean, "max": number}
     * @param {array} receivers_list - array of party ids that want to receive the triplet shares, by default, this includes all parties. [optional]
     * @param {number} threshold - the minimimum number of parties needed to reconstruct the triplet.
     * @param {number} Zp - the modulos (if null then the default Zp for the instance is used). [optional]
     * @param {string} number_id - the number id which is used to identify this request, so that every party
     *                             gets a share from the same number for every matching instruction. An automatic number id
     *                             is generated by increasing a local counter, default ids suffice when all parties execute the
     *                             instructions in the same order. [optional]
     * @returns {secret-share} a secret share of zero/random bit/random number/random non-zero number.
     */
    jiff.server_generate_and_share = function(options, receivers_list, threshold, Zp, number_id) { return jiff_server_share_number(jiff, options, receivers_list, threshold, Zp, number_id) };

    /**
     * A collection of useful protocols to be used during computation or preprocessing: extensions are encouraged to add useful
     * common protocols here, under a sub namespace corresponding to the extension name.
     * @type object
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
     * @param {number} [threshold=receivers_list.length] - the minimimum number of parties needed to reconstruct the secret, defaults to all the recievers.
     * @param {Array} [receivers_list=[1, ..., n]] - array of party ids to share with, by default, this includes all parties.
     * @param {Array} [senders_list=[1, ..., n]] - array of party ids to receive from, by default, this includes all parties.
     * @param {number} [Zp=jiff-instance.Zp] - the modulos (if null then the default Zp for the instance is used).
     * @returns {secret-share} a secret share of the random number, null if this party is not a receiver.
     */
    jiff.protocols.generate_and_share_random = function(threshold, receivers_list, senders_list, Zp) {
      return jiff_share_all_number(jiff, jiff.helpers.random(Zp), threshold, receivers_list, senders_list, Zp);
    };

    /**
     * Creates shares of 0, such that no party knows the other parties' shares.
     * Every party secret shares 0, then every party sums all the shares they received, resulting
     * in a new share of 0 for every party.
     * @method generate_and_share_zero
     * @memberof jiff-instance.protocols
     * @instance
     * @param {number} [threshold=receivers_list.length] - the minimimum number of parties needed to reconstruct the secret, defaults to all the recievers.
     * @param {Array} [receivers_list=[1, ..., n]] - array of party ids to share with, by default, this includes all parties.
     * @param {Array} [senders_list=[1, ..., n]] - array of party ids to receive from, by default, this includes all parties.
     * @param {number} [Zp=jiff-instance.Zp] - the modulos (if null then the default Zp for the instance is used).
     * @returns {secret-share} a secret share of zero, null if this party is not a receiver.
     */
    jiff.protocols.generate_and_share_zero = function(threshold, receivers_list, senders_list, Zp) {
      return jiff_share_all_number(jiff, 0, threshold, receivers_list, senders_list, Zp);
    };

    /**
     * Creates a secret share of the number represented by the given array of secret shared bits.
     * Requires no communication, only local operations.
     * @method bit_composition
     * @memberof jiff-instance.protocols
     * @instance
     * @param {secret-share[]} bits - an array of the secret shares of bits, starting from least to most significant bits.
     * @returns {secret-share} a secret share of the number represented by bits.
     */
    jiff.protocols.bit_composition = function(bits) {
      var result = bits[0];
      var pow = 1;
      for(var i = 1; i < bits.length; i++) {
        pow = pow * 2;
        result = result.isadd(bits[i].icmult(pow));
      }
      return result;
    };

    /**
     * Checks whether given constant is less than given secret-shared bits.
     * Requires l-1 rounds of communication (a total of l-1 multiplications in sequence) where l is the length of secret_bits.
     * @method clt_bits
     * @memberof jiff-instance.protocols
     * @instance
     * @param {number} constant - the constant number to check if less than bits.
     * @param {secret-share[]} bits - an array of the secret shares of bits, starting from least to most significant bits.
     * @param {string} [op_id=<auto-generate-id>] - the base operation id to use when generating unique ids for multiplications.
     *                                              default value should suffice when the code of all parties executes all instructions
     *                                              in the same exact order, otherwise, a unique base name is needed here.
     * @returns {secret-share} a secret share of 1 if constant < (bits)_2, otherwise a secret share of 0.
     */
    jiff.protocols.clt_bits = function(constant, bits, op_id) {
      if(op_id == null) // Generate base operation id if needed.
        op_id = jiff.counters.gen_op_id("c<bits", bits[0].holders);

      // Decompose result into bits
      constant = constant.toString(2);

      var constant_bits = [];
      for(var i = 0; i < constant.length; i++)
        constant_bits[i] = parseInt(constant.charAt(constant.length - 1 - i));
      while(constant_bits.length < bits.length) constant_bits.push(0);

      // XOR
      var c = [];
      for(var i = 0; i < constant_bits.length; i++)
        c[i] = bits[i].icxor_bit(constant_bits[i]);

      // PrefixOR
      var d = [];
      d[c.length-1] = c[c.length-1];
      for(var i = c.length-2; i >= 0; i--)
        d[i] = d[i+1].isor_bit(c[i], op_id+":sOR:"+i);

      var e = [];
      e[d.length-1] = d[d.length-1];
      for(var i = d.length-2; i >= 0; i--)
        e[i] = d[i].issub(d[i+1]);

      var isNotEqual = e[0];
      var isGreaterThan = e[0].icmult(constant_bits[0]);
      for(var i = 1; i < e.length; i++) {
        isGreaterThan = isGreaterThan.isadd(e[i].icmult(constant_bits[i]));
        isNotEqual = isNotEqual.isadd(e[i]);
      }

      return isNotEqual.not().isadd(isGreaterThan).not();
    };


    /**
     * Disconnects from the computation.
     * Allows the client program to exit.
     * @method disconnect
     * @memberof jiff-instance
     * @instance
     */
    jiff.disconnect = function() { jiff.socket.disconnect(); jiff.triplets_socket.disconnect(); jiff.numbers_socket.disconnect(); };

    // Store the id when server sends it back
    jiff.socket.on('init', function(msg) {
      sodium_promise.then(function() {
        msg = JSON.parse(msg);
        if(jiff.id == null)
          jiff.id = msg.party_id;

        if(jiff.party_count == null)
          jiff.party_count = msg.party_count;

        if(jiff.secret_key == null || jiff.public_key == null) {
          // this party's public and secret key
          var genkey = sodium.crypto_box_keypair();
          jiff.secret_key = genkey.privateKey;
          jiff.public_key = genkey.publicKey;
        }

        jiff.socket.emit("public_key", '['+jiff.public_key.toString()+']');
        // Now: (1) this party is connect (2) server (and other parties) know this public key
        // Resend all pending messages
        jiff.socket.resend_mailbox();

        jiff.execute_wait_callbacks();
      });
    });

    jiff.socket.on('public_key', function(msg) {
      sodium_promise.then(function() {
        jiff.keymap = JSON.parse(msg);

        for(var i in jiff.keymap)
          if(jiff.keymap.hasOwnProperty(i))
            jiff.keymap[i] = new Uint8Array(JSON.parse(jiff.keymap[i]));

        // Resolve any pending waits that have satisfied conditions
        jiff.execute_wait_callbacks();

        // Check if all keys have been received
        if(jiff.keymap["s1"] == null) return;
        for(var i = 1; i <= jiff.party_count; i++)
          if(jiff.keymap[i] == null) return;

        // check if all parties are connected
        if(jiff.__ready !== true) {
          jiff.__ready = true;
          if(options.onConnect != null)
            options.onConnect(jiff);
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

    /**
     * Generate an op_id for an open operation between the holders of a share and a receiver.
     * The returned op_id will be unique with respect to other operations, and identifies the same
     * operation/instruction for all parties, as long as all parties are executing instructions in the same order.
     * Notice: the order of elements in both receviers and senders should be the same accross all parties, preferrably
     *    these two arrays should be sorted before passing them to this function.
     * @param {array} receivers - an array containing the ids of all the receivers in this share operation).
     * @param {array} senders - an array containing the ids of all the senders in this share operation).
     * @return {string} - the share_id for the share.
     */
    jiff.counters.gen_share_id = function(receivers, senders) {
      var label = receivers.join(",") + ":" + senders.join(",");
      if(jiff.counters.share_op_count[label] == null) jiff.counters.share_op_count[label] = 0;
      return "share:" + label + ":" + (jiff.counters.share_op_count[label]++);
    };

    /**
     * Generate an op_id for an open operation between the holders of a share and a receiver.
     * The returned op_id will be unique with respect to other operations, and identifies the same
     * operation/instruction for all parties, as long as all parties are executing instructions in the same order.
     * @param {string/number} receiver - party id of receiver.
     * @param {string} holders_string - a string representation of holders (e.g. comma-separted and sorted list of holders ids).
     * @return {string} - the op_id for the open.
     */
    jiff.counters.gen_open_id = function(receiver, holders_string) {
      var label = receiver + ":" + holders_string;
      if(jiff.counters.open_op_count[label] == null) jiff.counters.open_op_count[label] = 0;
      return "open:" + label + ":" + (jiff.counters.open_op_count[label]++);
    }

    /**
     * Generate a new unique triplet id for a triplet to be shared between holders.
     * The returned triplet_id will be unique with respect to other operations, and identifies the same
     * triplet for all parties, as long as all parties are executing instructions in the same order.
     * @param {array} holders - an array containing the ids of all the holders of the triplet.
     * @return {string} - the op_id for the open.
     */
    jiff.counters.gen_triplet_id = function(holders) {
      var label = holders.join(",");
      if(jiff.counters.triplet_op_count[label] == null) jiff.counters.triplet_op_count[label] = 0;
      return "triplet:" + label + ":" + (jiff.counters.triplet_op_count[label]++);
    }

    /**
     * Generate a new unique number id for a number to be shared between holders.
     * The returned number_id will be unique with respect to other operations, and identifies the same
     * triplet for all parties, as long as all parties are executing instructions in the same order.
     * @param {array} holders - an array containing the ids of all the holders of the triplet.
     * @return {string} - the op_id for the open.
     */
    jiff.counters.gen_number_id = function(holders) {
      var label = holders.join(",");
      if(jiff.counters.number_op_count[label] == null) jiff.counters.number_op_count[label] = 0;
      return "number:" + label + ":" + (jiff.counters.number_op_count[label]++);
    }

    /**
     * Generate a unique id for a new share object, these ids are used for debugging and logging
     * and have no requirements beyond being unique (per party). Parties may assign different ideas
     * to matching shares due to having a different order of exeuction of instructions, or receiving
     * messages at different times.
     * @return {string} - a unique (per party) id for a new secret share object.
     */
    jiff.counters.gen_share_obj_id = function() {
      return "share"+(jiff.counters.share_obj_count++);
    }

    /**
     * Generate a unique operation id for a new operation object.
     * The returned op_id will be unique with respect to other operations, and identifies the same
     * operaetion accross all parties, as long as all parties are executing instructions in the same order.
     * @param {string} op - the type/name of operation performed.
     * @param {array} holders - an array containing the ids of all the parties carrying out the operation.
     * @return {string} - the op_id for the open.
     */
    jiff.counters.gen_op_id = function(op, holders) {
      var label = holders.join(",");
      if(jiff.counters.op_count[label] == null) jiff.counters.op_count[label] = 0;
      return op + ":" + label + ":" + (jiff.counters.op_count[label]++);
    }

    // For logging / debugging
    jiff.logs = [];

    // Store a map from a sharing id (which share operation) to the
    // corresponding deferred and shares array.
    jiff.shares = {}; // Stores receive shares for open purposes.
    jiff.deferreds = {}; // Stores deferred that are resolved when required messages arrive.

    // Setup receiving matching shares
    jiff.socket.on('share', function(msg, callback) {
      callback(true); // send ack to server

      // parse message
      var json_msg = JSON.parse(msg);
      var sender_id = json_msg["party_id"];
      var op_id = json_msg["op_id"];
      var share = json_msg["share"];

      receive_share(jiff, sender_id, share, op_id);
    });

    jiff.socket.on('open', function(msg, callback) {
      callback(true); // send ack to server

      // parse message
      var json_msg = JSON.parse(msg);

      var sender_id = json_msg["party_id"];
      var op_id = json_msg["op_id"];
      var share = json_msg["share"];
      var Zp = json_msg["Zp"];

      receive_open(jiff, sender_id, share, op_id, Zp);
    });

    // handle custom messages
    jiff.socket.on('custom', function(msg, callback) {
      callback(true); // send ack to server

      var json_msg = JSON.parse(msg);

      var sender_id = json_msg["party_id"];
      var tag = json_msg["tag"];
      var message = json_msg["message"];

      if(jiff.listeners[tag] != null) jiff.listeners[tag](sender_id, message);
      else { // Store message until listener is provided
        var stored_messages = jiff.custom_messages_mailbox[tag];
        if(stored_messages == null) {
          stored_messages = [];
          jiff.custom_messages_mailbox[tag] = stored_messages;
        }

        stored_messages.push( { "sender_id": sender_id, "message": message } );
      }
    });

    jiff.triplets_socket.on('triplet', function(msg, callback) {
      callback(true); // send ack to server

      if(jiff.id != "s1" || (options.triplets_server != null && options.triplets_server != hostname))
        // decrypt and verify message signature
        msg = jiff.hooks.decryptSign(msg, jiff.secret_key, jiff.keymap["s1"], 'triplet');

      // parse message
      var json_msg = JSON.parse(msg);
      var triplet = json_msg["triplet"];
      var triplet_id = json_msg["triplet_id"];

      receive_triplet(jiff, triplet_id, triplet);
    });

    jiff.numbers_socket.on('number', function(msg, callback) {
      callback(true); // send ack to server

      if(jiff.id != "s1" || (options.numbers_server != null && options.numbers_server != hostname))
        // decrypt and verify message signature
        msg = jiff.hooks.decryptSign(msg, jiff.secret_key, jiff.keymap["s1"], 'number');

      // parse message
      var json_msg = JSON.parse(msg);
      var number = json_msg["number"];
      var number_id = json_msg["number_id"];

      receive_server_share_number(jiff, number_id, number);
    });

    jiff.socket.on('error', function(msg) {
      console.log("RECEIVED ERROR FROM SERVER");
      jiff.socket = null;
      jiff.__ready = false;

      if(options.onError != null)
        options.onError(msg);

      throw msg;
    });

    jiff.socket.on('disconnect', function(reason) {
      // console.log("Disconnected! " + reason);
    });

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
    'encrypt_and_sign': encrypt_and_sign,
    'decrypt_and_sign': decrypt_and_sign
  };

  /**
   * Contains builtin sharing schemes provided by jiff.
   * @memberof jiff
   * @type {object}
   * @namespace jiff.sharing_schemes
   */
  exports.sharing_schemes = {
    'shamir_share': jiff_compute_shares,
    'shamir_reconstruct': jiff_lagrange
  };
}((typeof exports == 'undefined' ? this.jiff = {} : exports), typeof exports != 'undefined'));
