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

  /** Doubly linked list with add and delete functions and pointers to head and tail**/
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
   * Encrypts and signs the given message, the function will execute message.toString(10)
   * internally to ensure type of message is a string before encrypting.
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
   * Decrypts and checks the signature of the given ciphertext, the function will execute
   * parseInt internally to ensure returned value is a number.
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

  /*
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

  /*
   * Open up the given share to the participating parties.
   * @param {jiff-instance} jiff - the jiff instance.
   * @param {share-object} share - the share of the secret to open that belongs to this party.
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
   * @param {array<share-object>} shares - an array containing this party's shares of the secrets to reconstruct.
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

  /*
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

  /*
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

  /*
   * Uses Lagrange polynomials to interpolate the polynomial
   * described by the given shares (points).
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

  /*
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
   * @returns {array<share-object>} an array of 3 share-objects [share_a, share_b, share_c] such that a * b = c.
   */
  function jiff_triplet(jiff, receivers_list, threshold, Zp, triplet_id) {
    if(Zp == null) Zp = jiff.Zp;
    if(receivers_list == null)
      for(var i = 1; i <= jiff.party_count; i++) receivers_list.push(i);

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

  /*
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
   * @return {share-object} this party's share of the the number, null if this party is not a receiver.
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
   * @return {share-object} - this party's share of the generated number.
   */
  function jiff_server_share_number(jiff, options, receivers_list, threshold, Zp, number_id) {
    if(Zp == null) Zp = jiff.Zp;
    if(receivers_list == null)
      for(var i = 1; i <= jiff.party_count; i++) receivers_list.push(i);
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

  /*
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
   * Coerce a number into a share. THIS DOES NOT SHARE THE GIVEN NUMBER.
   * It is a local type-coersion by invoking the constructor on the given parameter,
   *  this is useful for for operating on constants, not sharing secret data.
   * If all parties use this function with the same input number, then
   *  you can think of their shares as being a share of that constant with threshold 1.
   *  In other words, a trivial sharing scheme where the share is the number itself.
   *  However, if some parties used different input numbers, then the actual value
   *  yielded by reconstruction/opening of all these shares is arbitrary and depends
   *  on all the input numbers of all parties.
   *  @param {jiff-instance} jiff - the jiff instance.
   *  @param {number} number - the number to coerce.
   *  @param {array} holders - array of party ids that will hold the shares, by default, this includes all parties. [optional]
   *  @param {number} Zp - the modulos (if null then the default Zp for the instance is used). [optional]
   *  @param {string} id - this share's id (should be unique). [optional]
   *  @returns {share-object} a share object containing the given number.
   *
   */
  function jiff_coerce_to_share(jiff, number, holders, Zp, share_id) {
    if(Zp == null) Zp = jiff.Zp;
    if(holders == null)
      for(var i = 1; i <= jiff.party_count; i++) holders.push(i);
    return jiff.secret_share(jiff, true, null, number, holders, 1, Zp, share_id);
  }

  /**
   * 
   * @memberof jiff
   * @method jiff_share_array
   * @param {jiff-instance} jiff - the jiff instance
   * @param {array} array - the array to be shared.
   * @param {function} callback - a callback function having the array of shares.
   * @param {number} padding - a number to be padded as extra values. [optional]
   */
  function jiff_share_array(jiff, array, callback, padding) { //, threshold, receivers_list, senders_list, Zp) { //share_id
    var Zp = jiff.Zp;
    var threshold = jiff.threshold;

    var maximumLengthShare = jiff.share(array.length);
    var max = maximumLengthShare[1];
    for(var i = 2; i < jiff.party_count; i++) {
      if(!max[i])
        continue;
      var comparison = max.gt(max[i]);
      max = max[i].add((max.sub(max[i])).mult(comparison));
    }
    
    max.open(function(max_opened) {
      var arrayOfShares = [];
      var difference = max_opened - array.length;
      for(var i = 0; i < array.length; i++) {
        arrayOfShares.push(jiff.share(array[i]));
      }
      if(difference > 0) {
        // populate all other parties but this party
        var parties = [];
        for(var i = 1; i <= jiff.party_count; i++)
          //if(i !== jiff.id)
            parties.push(i);

        if(padding != null)
          for(var i = 0; i < difference; i++) {
            arrayOfShares.push(jiff.share(padding));
          }
        else
          for(var i = 0; i < difference; i++) {
            // * @param {array} receivers_list - array of party ids to share with, by default, this includes all parties. [optional]
            // * @param {array} senders_list - array of party ids to receive from, by default, this includes all parties. [optional]
            arrayOfShares.push(jiff.share(null, null, parties));
          }
        
        // we could shuffle the shares
      }

      callback(arrayOfShares);
    });
  }

  /**
   * Create a new share.
   * A share is a value wrapper with a share object, it has a unique id
   * (per computation instance), and a pointer to the instance it belongs to.
   * A share also has methods for performing operations.
   * @memberof jiff
   * @method secret_share
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
     * Secret share objects: provides API to perform operations on shares securly, wrap promises
     * and communication primitives to ensure operations are executed when shares are available (asynchrounously)
     * without requiring the user to perform promise management/synchronization.
     * @memberof jiff
     * @namespace secret-share
     */
    var self = {};

    /**
     * @member {jiff-instance} jiff
     * @memberof jiff.secret-share
     */
    self.jiff = jiff;

    /**
     * @member {boolean} ready
     * @memberof jiff.secret-share
     */
    self.ready = ready;

    /**
     * @member {promise} promise
     * @memberof jiff.secret-share
     */
    self.promise = promise;
    /**
     * @member {number} value
     * @memberof jiff.secret-share
     */
    self.value = value;
    /**
     * @member {array} holders
     * @memberof jiff.secret-share
     */
    self.holders = holders;
    /**
     * @member {array} threshold
     * @memberof jiff.secret-share
     */
    self.threshold = threshold;
    /**
     * @member {number} Zp
     * @memberof jiff.secret-share
     */
    self.Zp = Zp;

    if(id == null) id = jiff.counters.gen_share_obj_id();

    /**
     * @member {string} id
     * @memberof jiff.secret-share
     */
    self.id = id;

    /**
     * Gets the value of this share.
     * @method valueOf
     * @returns {number} the value (undefined if not ready yet).
     * @memberof jiff.secret-share
     */
    self.valueOf = function() {
      if(ready) return self.value;
      else return undefined;
    };

    /**
     * Gets a string representation of this share.
     * @method toString
     * @returns {string} the id and value of the share as a string.
     * @memberof jiff.secret-share
     */
    self.toString = function() {
      if(ready) return self.id + ": " + self.value;
      else return self.id + ": <deferred>";
    };

    /**
     * Logs an error.
     * @method error
     * @memberof jiff.secret-share
     */
    self.error = function() { console.log("Error receiving " + self.toString()); };

    /**
     * Receives the value of this share when ready.
     * @method receive_share
     * @param {number} value - the value of the share.
     * @memberof jiff.secret-share
     */
    self.receive_share = function(value) { self.value = value; self.ready = true; self.promise = null; };

    /**
     * Joins the pending promises of this share and the given share.
     * @method pick_promise
     * @param {share-object} o - the other share object.
     * @returns {promise} the joined promise for both shares (or whichever is pending).
     * @memberof jiff.secret-share
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
     * @memberof jiff.secret-share
     */
    self.refresh = function(op_id) {
      return self.sadd(self.jiff.server_generate_and_share({"number": 0}, self.holders, self.threshold, self.Zp, op_id));
    };

    /**
     * Reveals/Opens the value of this share.
     * @method open
     * @param {function(number)} success - the function to handle successful open.
     * @param {function(string)} error - the function to handle errors and error messages. [optional]
     * @returns {promise} a (JQuery) promise to the open value of the secret.
     * @throws error if share does not belong to the passed jiff instance.
     * @memberof jiff.secret-share
     */
    self.open = function(success, failure) {
      if(failure == null) failure = self.error;
      var promise = self.jiff.open(self);
      if(promise != null) promise.then(success, failure);
      return promise;
    };

    /**
     * Reveals/Opens the value of this share to a specific array of parties.
     * @method open_to
     * @param {array} parties - the ids of parties to reveal secret to.
     * @param {function(number)} success - the function to handle successful open.
     * @param {function(string)} error - the function to handle errors and error messages. [optional]
     * @memberof jiff.secret-share
     */
    self.open_to = function(parties, success, failure) {
      if(failure == null) failure = self.error;
      var promise = self.jiff.open(self, parties);
      if(promise != null) promise.then(success, failure);
    };

    /**
     * Generic Addition.
     * Uses either the constant or secret version of this operator depending on type of paramter.
     * @method add
     * @param {number/share-object} o - the other operand (can be either number or share).
     * @return {share-object} this party's share of the result.
     * @memberof jiff.secret-share
     */
    self.add = function(o) {
      if(self.isConstant(o)) return self.cadd(o);
      return self.sadd(o);
    }

    /**
     * Generic Subtraction.
     * Uses either the constant or secret version of this operator depending on type of paramter.
     * @method sub
     * @param {number/share-object} o - the other operand (can be either number or share).
     * @return {share-object} this party's share of the result.
     * @memberof jiff.secret-share
     */
    self.sub = function(o) {
      if(self.isConstant(o)) return self.csub(o);
      return self.ssub(o);
    }

    /**
     * Generic Multiplication.
     * Uses either the constant or secret version of this operator depending on type of paramter.
     * @method mult
     * @param {number/share-object} o - the other operand (can be either number or share).
     * @return {share-object} this party's share of the result.
     * @memberof jiff.secret-share
     */
    self.mult = function(o) {
      if(self.isConstant(o)) return self.cmult(o);
      return self.smult(o);
    }

    /**
     * Generic XOR for bits (both this and o have to be bits to work correctly).
     * Uses either the constant or secret version of this operator depending on type of paramter.
     * @method xor_bit
     * @param {number/share-object} o - the other operand (can be either number or share).
     * @return {share-object} this party's share of the result.
     * @memberof jiff.secret-share
     */
    self.xor_bit = function(o) {
      if(self.isConstant(o)) return self.cxor_bit(o);
      return self.sxor_bit(o);
    }

    /**
     * Generic Greater or equal.
     * Uses either the constant or secret version of this operator depending on type of paramter.
     * @method gteq
     * @param {number/share-object} o - the other operand (can be either number or share).
     * @param {number} l - the maximum bit length of the two shares. [optional]
     * @return {share-object} this party's share of the result.
     * @memberof jiff.secret-share
     */
    self.gteq = function(o, l) {
      if(self.isConstant(o)) return self.cgteq(o, l);
      return self.sgteq(o, l);
    }

    /**
     * Generic Greater than.
     * Uses either the constant or secret version of this operator depending on type of paramter.
     * @method gt
     * @param {number/share-object} o - the other operand (can be either number or share).
     * @param {number} l - the maximum bit length of the two shares. [optional]
     * @return {share-object} this party's share of the result.
     * @memberof jiff.secret-share
     */
    self.gt = function(o, l) {
      if(self.isConstant(o)) return self.cgt(o, l);
      return self.sgt(o, l);
    }

    /**
     * Generic Less or equal.
     * Uses either the constant or secret version of this operator depending on type of paramter.
     * @method lteq
     * @param {number/share-object} o - the other operand (can be either number or share).
     * @param {number} l - the maximum bit length of the two shares. [optional]
     * @return {share-object} this party's share of the result.
     * @memberof jiff.secret-share
     */
    self.lteq = function(o, l) {
      if(self.isConstant(o)) return self.clteq(o, l);
      return self.slteq(o, l);
    }

    /**
     * Generic Less than.
     * Uses either the constant or secret version of this operator depending on type of paramter.
     * @method lt
     * @param {number/share-object} o - the other operand (can be either number or share).
     * @param {number} l - the maximum bit length of the two shares. [optional]
     * @return {share-object} this party's share of the result.
     * @memberof jiff.secret-share
     */
    self.lt = function(o, l) {
      if(self.isConstant(o)) return self.clt(o, l);
      return self.slt(o, l);
    }

    /**
     * Generic Equals.
     * Uses either the constant or secret version of this operator depending on type of paramter.
     * @method eq
     * @param {number/share-object} o - the other operand (can be either number or share).
     * @param {number} l - the maximum bit length of the two shares. [optional]
     * @return {share-object} this party's share of the result.
     * @memberof jiff.secret-share
     */
    self.eq = function(o, l) {
      if(self.isConstant(o)) return self.ceq(o, l);
      return self.seq(o, l);
    }

    /**
     * Generic Not Equals.
     * Uses either the constant or secret version of this operator depending on type of paramter.
     * @method neq
     * @param {number/share-object} o - the other operand (can be either number or share).
     * @param {number} l - the maximum bit length of the two shares. [optional]
     * @return {share-object} this party's share of the result.
     * @memberof jiff.secret-share
     */
    self.neq = function(o, l) {
      if(self.isConstant(o)) return self.cneq(o, l);
      return self.sneq(o, l);
    }

    /**
     * Generic Integer Divison.
     * Uses either the constant or secret version of this operator depending on type of paramter.
     * @method div
     * @param {number/share-object} o - the other operand (can be either number or share).
     * @param {number} l - the maximum bit length of the two shares. [optional]
     * @return {share-object} this party's share of the result.
     * @memberof jiff.secret-share
     */
    self.div = function(o, l) {
      if(self.isConstant(o)) return self.cdiv(o, l);
      return self.sdiv(o, l);
    }

    /**
     * Addition with a constant.
     * @method cadd
     * @param {number} cst - the constant to add.
     * @return {share-object} this party's share of the result.
     * @memberof jiff.secret-share
     */
    self.cadd = function(cst) {
      if (!(self.isConstant(cst))) throw "parameter should be a number (+)";

      if(self.ready) // if share is ready
        return self.jiff.secret_share(self.jiff, true, null, self.jiff.helpers.mod((self.value + cst), self.Zp), self.holders, self.threshold, self.Zp);

      var promise = self.promise.then(function() { return self.jiff.helpers.mod((self.value + cst), self.Zp); }, self.error);
      return self.jiff.secret_share(self.jiff, false, promise, undefined, self.holders, self.threshold, self.Zp);
    };

    /**
     * Subtraction with a constant.
     * @method csub
     * @param {number} cst - the constant to subtract from this share.
     * @return {share-object} this party's share of the result.
     * @memberof jiff.secret-share
     */
    self.csub = function(cst) {
      if (!(self.isConstant(cst))) throw "parameter should be a number (-)";

      if(self.ready) // if share is ready
        return self.jiff.secret_share(self.jiff, true, null, self.jiff.helpers.mod((self.value - cst), self.Zp), self.holders, self.threshold, self.Zp);

      var promise = self.promise.then(function() { return self.jiff.helpers.mod((self.value - cst), self.Zp); }, self.error);
      return self.jiff.secret_share(self.jiff, false, promise, undefined, self.holders, self.threshold, self.Zp);
    }

    /**
     * Multiplication by a constant.
     * @method cmult
     * @param {number} cst - the constant to multiply to this share.
     * @return {share-object} this party's share of the result.
     * @memberof jiff.secret-share
     */
    self.cmult = function(cst) {
      if (!(self.isConstant(cst))) throw "parameter should be a number (*)";

      if(self.ready) // if share is ready
        return self.jiff.secret_share(self.jiff, true, null, self.jiff.helpers.mod((self.value * cst), self.Zp), self.holders, self.threshold, self.Zp);

      var promise = self.promise.then(function() { return self.jiff.helpers.mod((self.value * cst), self.Zp); }, self.error);
      return self.jiff.secret_share(self.jiff, false, promise, undefined, self.holders, self.threshold, self.Zp);
    };

    /**
     * Division by a constant factor of the number represented by the share.
     * @method cdivfac
     * @param {number} cst - the constant by which to divide the share.
     * @return {share-object} this party's share of the result.
     * @memberof jiff.secret-share
     */
    self.cdivfac = function(cst) {
      if (!(self.isConstant(cst))) throw "Parameter should be a number (cdivfac)";

      var inv = jiff.helpers.extended_gcd(cst, self.Zp)[0];

      if(self.ready) // If share is ready.
        return self.jiff.secret_share(self.jiff, true, null, self.jiff.helpers.mod((self.value * inv), self.Zp), self.holders, self.threshold, self.Zp);

      var promise = self.promise.then(function() { return self.jiff.helpers.mod((self.value * inv), self.Zp); }, self.error);
      return self.jiff.secret_share(self.jiff, false, promise, undefined, self.holders, self.threshold, self.Zp);
    };

    /**
     * Addition of two secret shares.
     * @method sadd
     * @param {share-object} o - the share to add to this share.
     * @return {share-object} this party's share of the result.
     * @memberof jiff.secret-share
     */
    self.sadd = function(o) {
      if (!(o.jiff === self.jiff)) throw "shares do not belong to the same instance (+)";
      if (!(o.Zp === self.Zp)) throw "shares must belong to the same field (+)";
      if (!self.jiff.helpers.array_equals(self.holders, o.holders)) throw "shares must be held by the same parties (+)";

      // add the two shares when ready locally
      var ready_add = function() {
        return self.jiff.helpers.mod(self.value + o.value, self.Zp);
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
     * @param {share-object} o - the share to subtract from this share.
     * @return {share-object} this party's share of the result.
     * @memberof jiff.secret-share
     */
    self.ssub = function(o) {
      if (!(o.jiff === self.jiff)) throw "shares do not belong to the same instance (-)";
      if (!(o.Zp === self.Zp)) throw "shares must belong to the same field (-)";
      if (!self.jiff.helpers.array_equals(self.holders, o.holders)) throw "shares must be held by the same parties (-)";

      // add the two shares when ready locally
      var ready_sub = function() {
        return self.jiff.helpers.mod(self.value - o.value, self.Zp);
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
     * @param {share-object} o - the share to multiply with.
     * @param {string} op_id - the operation id which is used to identify this multiplication (and internally, the corresponding beaver triplet).
     *                         This id must be unique, and must be passed by all parties to the same instruction.
     *                         this ensures that every party gets a share from the same triplet for every matching instruction. An automatic id
     *                         is generated by increasing a local counter, default ids suffice when all parties execute the
     *                         instructions in the same order. [optional]
     * @return {share-object} this party's share of the result.
     * @memberof jiff.secret-share
     */
    self.smult = function(o, op_id) {
      if (!(o.jiff === self.jiff)) throw "shares do not belong to the same instance (*)";
      if (!(o.Zp === self.Zp)) throw "shares must belong to the same field (*)";
      if (!self.jiff.helpers.array_equals(self.holders, o.holders)) throw "shares must be held by the same parties (*)";

      var final_deferred = $.Deferred();
      var final_promise = final_deferred.promise();
      var result = self.jiff.secret_share(self.jiff, false, final_promise, undefined, self.holders, max(self.threshold, o.threshold), self.Zp, op_id);

      // Get shares of triplets.
      var triplet_id = op_id == null ? null : op_id + ":triplet";
      var triplet = jiff.triplet(self.holders, max(self.threshold, o.threshold), self.Zp, triplet_id);

      var a = triplet[0];
      var b = triplet[1];
      var c = triplet[2];

      // d = s - a. e = o - b.
      var d = self.sadd(a.cmult(-1));
      var e = o.sadd(b.cmult(-1));

      // Open d and e.
      // The only communication cost.
      var e_promise = self.jiff.open(e, e.holders, b.id + ":open");
      var d_promise = self.jiff.open(d, d.holders, a.id + ":open");
      Promise.all([e_promise, d_promise]).then(function(arr) {
        var e_open = arr[0];
        var d_open = arr[1];

        // result_share = d_open * e_open + d_open * b_share + e_open * a_share + c.
        var t1 = d_open * e_open;
        var t2 = b.cmult(d_open);
        var t3 = a.cmult(e_open);

        // All this happens locally.
        var final_result = t2.cadd(t1);
        final_result = final_result.sadd(t3);
        final_result = final_result.sadd(c);

        if(final_result.ready)
          final_deferred.resolve(final_result.value);
        else // Resolve the deferred when ready.
          final_result.promise.then(function () { final_deferred.resolve(final_result.value); });
      });

      return result;
    };

    /**
     * bitwise-XOR with a constant (BOTH BITS).
     * @method cxor_bit
     * @param {number} cst - the constant bit to XOR with (0 or 1).
     * @return {share-object} this party's share of the result.
     * @memberof jiff.secret-share
     */
    self.cxor_bit = function(cst) {
      if (!(self.isConstant(cst))) throw "parameter should be a number (^)";
      return self.cadd(cst).ssub(self.cmult(cst).cmult(2));
    };

    /**
     * bitwise-XOR of two secret shares OF BITS.
     * @method sxor_bit
     * @param {share-object} o - the share to XOR with.
     * @return {share-object} this party's share of the result.
     * @memberof jiff.secret-share
     */
    self.sxor_bit = function(o) {
      if (!(o.jiff === self.jiff)) throw "shares do not belong to the same instance (^)";
      if (!(o.Zp === self.Zp)) throw "shares must belong to the same field (^)";
      if (!self.jiff.helpers.array_equals(self.holders, o.holders)) throw "shares must be held by the same parties (^)";

      return self.sadd(o).ssub(self.smult(o).cmult(2));
    };

    /**
     * Greater than or equal with another share.
     * @method sgteq
     * @param {share-object} o - the other share.
     * @param {number} l - the maximum bit length of the two shares. [optional]
     * @param {string} op_id - the operation id which is used to identify this comparison, this id must be unique, and must
     *                         be passed by all parties to the same instruction.
     *                         This id is used internally as a base for constructing other ids to allow parties to
     *                         identify and match all messages sent as part of this protocol. An automatic id
     *                         is generated by increasing a local counter, default ids suffice when all parties execute the
     *                         instructions in the same order. [optional]
     * @return {share-object} this party's share of the result, the final result is 1 if this >= o, and 0 otherwise.
     * @memberof jiff.secret-share
     */
    self.sgteq = function(o, l, op_id) {
      if (!(o.jiff === self.jiff)) throw "shares do not belong to the same instance (>=)";
      if (!(o.Zp === self.Zp)) throw "shares must belong to the same field (>=)";
      if (!self.jiff.helpers.array_equals(self.holders, o.holders)) throw "shares must be held by the same parties (>=)";

      var final_deferred = $.Deferred();
      var final_promise = final_deferred.promise();
      var result = self.jiff.secret_share(self.jiff, false, final_promise, undefined, self.holders, max(self.threshold, o.threshold), self.Zp, op_id);

      var k = Math.max(self.threshold, o.threshold);
      if(l == null) l = Math.floor(self.jiff.helpers.bLog(self.Zp, 2) - k - 1);

      if(l <= 0) throw "field too small compared to threshold";
      var assert = Math.pow(2, (l+2)) + Math.pow(2, (l+k));
      if(!(self.Zp >= assert)) throw "field too small compared to security and bit length (" + assert + ")";

      function preprocess() {
        var r_bits = [];
        for(var i = 0; i < l + k; i++)
          r_bits[i] = self.jiff.server_generate_and_share({ "bit": true }, self.holders, max(self.threshold, o.threshold), self.Zp, op_id == null ? null : op_id + ":bit"+i);

        var r_modl = r_bits[0];
        for(var i = 1; i < l; i++)
          r_modl = r_modl.sadd(r_bits[i].cmult(Math.pow(2, i)));

        var r_full = r_modl;
        for(var i = l; i < l + k; i++)
          r_full = r_full.sadd(r_bits[i].cmult(Math.pow(2, i)));

        r_bits = r_bits.slice(0, l);

        var s_bit = self.jiff.server_generate_and_share({ "bit": true }, self.holders, max(self.threshold, o.threshold), self.Zp, op_id == null ? null : op_id + ":sbit");
        var s_sign = s_bit.cmult(-2).cadd(1);

        var mask = self.jiff.server_generate_and_share({ "nonzero": true }, self.holders, max(self.threshold, o.threshold), self.Zp, op_id == null ? null : op_id + ":mask");

        return { "s_bit": s_bit, "s_sign": s_sign, "mask": mask, "r_full": r_full, "r_modl": r_modl, "r_bits": r_bits };
      }

      function finish_compare(c, s_bit, s_sign, mask, r_modl, r_bits, z, nested_op_ids, nested_smult_id) {
        var c_bits = [];
        for(var i = 0; i < l; i++)
          c_bits[i] = (c >> i) & 1;

        var sumXORs = [];
        for(var i = 0; i < l; i++)
          sumXORs[i] = 0;

        sumXORs[l-2] = r_bits[l-1].cxor_bit(c_bits[l-1]).cadd(sumXORs[l-1]);
        for(var i = l-3; i > -1; i--)
          sumXORs[i] = r_bits[i+1].cxor_bit(c_bits[i+1]).sadd(sumXORs[i+1]);

        var E_tilde = [];
        for(var i = 0; i < r_bits.length; i++) {
          var e_i = r_bits[i].cadd(-1 * c_bits[i]).sadd(s_sign);
          if(typeof(sumXORs[i]) != "number")
            e_i = e_i.sadd(sumXORs[i].cmult(3));
          else
            e_i = e_i.cadd(3 * sumXORs[i]);

          E_tilde.push(e_i);
        }

        var product = mask;
        for(var i = 0; i < E_tilde.length; i++)
          product = product.smult(E_tilde[i], nested_smult_id+":nested"+i);

        self.jiff.open(product, self.holders, nested_op_ids).then(function(product) {
          var non_zero = (product != 0) ? 1 : 0;
          var UF = s_bit.cxor_bit(non_zero);
          var c_mod2l = self.jiff.helpers.mod(c, Math.pow(2, l));
          var res = UF.cmult(Math.pow(2, l)).ssub(r_modl.cadd(-1 * c_mod2l));

          var inverse = self.jiff.helpers.extended_gcd(Math.pow(2, l), self.Zp)[0];
          var final_result = z.ssub(res).cmult(inverse);
          if(final_result.ready)
            final_deferred.resolve(final_result.value);
          else
            final_result.promise.then(function () { final_deferred.resolve(final_result.value); });
        }, self.error);
      }

      function compare_online(preprocess) {
        var a = self.cmult(2).cadd(1);
        var b = o.cmult(2);

        var z = a.ssub(b).cadd(Math.pow(2, l));
        var c = preprocess.r_full.sadd(z);

        // Unique and in order operation id for the nested open that is executed inside finish_compare.
        var nested_op_ids = {};
        var holders_label = self.holders.join(",");
        for(var i = 0; i < self.holders.length; i++)
          if(op_id == null) nested_op_ids[self.holders[i]] = self.jiff.counters.gen_open_id(self.holders[i], holders_label);
          else nested_op_ids[self.holders[i]] = op_id + ":" + receiver + ":" + holders_string;

        // Unique and in order single triplet id for the nest secret multiplication that is executed inside finish_compare.
        var nested_smult_id = op_id == null ? self.jiff.counters.gen_triplet_id(self.holders) : op_id + ":smult";

        // Open and pass the nested ids to the open handler to use in the remaining part of the protocol.
        self.jiff.open(c, self.holders).then(function(c) { finish_compare(c, preprocess.s_bit, preprocess.s_sign, preprocess.mask, preprocess.r_modl, preprocess.r_bits, z, nested_op_ids, nested_smult_id); }, self.error);
      }

      var pre = preprocess();
      compare_online(pre);

      return result;
    };

    /**
     * Greater than with another share.
     * @method sgt
     * @param {share-object} o - the other share.
     * @param {number} l - the maximum bit length of the two shares. [optional]
     * @param {string} op_id - the operation id which is used to identify this comparison, this id must be unique, and must
     *                         be passed by all parties to the same instruction.
     *                         This id is used internally as a base for constructing other ids to allow parties to
     *                         identify and match all messages sent as part of this protocol. An automatic id
     *                         is generated by increasing a local counter, default ids suffice when all parties execute the
     *                         instructions in the same order. [optional]
     * @return {share-object} this party's share of the result, the final result is 1 if this > o, and 0 otherwise.
     * @memberof jiff.secret-share
     */
    self.sgt = function(o, l, op_id) {
      if (!(o.jiff === self.jiff)) throw "shares do not belong to the same instance (>)";
      if (!(o.Zp === self.Zp)) throw "shares must belong to the same field (>)";
      if (!self.jiff.helpers.array_equals(self.holders, o.holders)) throw "shares must be held by the same parties (>)";

      return o.sgteq(self, l, op_id).cmult(-1).cadd(1);
    };

    /**
     * Less than or equal with another share.
     * @method slteq
     * @param {share-object} o - the other share.
     * @param {number} l - the maximum bit length of the two shares. [optional]
     * @param {string} op_id - the operation id which is used to identify this comparison, this id must be unique, and must
     *                         be passed by all parties to the same instruction.
     *                         This id is used internally as a base for constructing other ids to allow parties to
     *                         identify and match all messages sent as part of this protocol. An automatic id
     *                         is generated by increasing a local counter, default ids suffice when all parties execute the
     *                         instructions in the same order. [optional]
     * @return {share-object} this party's share of the result, the final result is 1 if this <= o, and 0 otherwise.
     * @memberof jiff.secret-share
     */
    self.slteq = function(o, l, op_id) {
      if (!(o.jiff === self.jiff)) throw "shares do not belong to the same instance (<=)";
      if (!(o.Zp === self.Zp)) throw "shares must belong to the same field (<=)";
      if (!self.jiff.helpers.array_equals(self.holders, o.holders)) throw "shares must be held by the same parties (<=)";

      return o.sgteq(self, l, op_id);
    };

    /**
     * Less than with another share.
     * @method slt
     * @param {share-object} o - the other share.
     * @param {number} l - the maximum bit length of the two shares. [optional]
     * @param {string} op_id - the operation id which is used to identify this comparison, this id must be unique, and must
     *                         be passed by all parties to the same instruction.
     *                         This id is used internally as a base for constructing other ids to allow parties to
     *                         identify and match all messages sent as part of this protocol. An automatic id
     *                         is generated by increasing a local counter, default ids suffice when all parties execute the
     *                         instructions in the same order. [optional]
     * @return {share-object} this party's share of the result, the final result is 1 if this < o, and 0 otherwise.
     * @memberof jiff.secret-share
     */
    self.slt = function(o, l, op_id) {
      if (!(o.jiff === self.jiff)) throw "shares do not belong to the same instance (<)";
      if (!(o.Zp === self.Zp)) throw "shares must belong to the same field (<)";
      if (!self.jiff.helpers.array_equals(self.holders, o.holders)) throw "shares must be held by the same parties (<)";

      return self.sgteq(o, l, op_id).cmult(-1).cadd(1);
    };

    /**
     * Greater than or equal with a constant.
     * @method cgteq
     * @param {number} cst - the constant to compare with.
     * @param {number} l - the maximum bit length of this share. [optional]
     * @param {string} op_id - the operation id which is used to identify this comparison, this id must be unique, and must
     *                         be passed by all parties to the same instruction.
     *                         This id is used internally as a base for constructing other ids to allow parties to
     *                         identify and match all messages sent as part of this protocol. An automatic id
     *                         is generated by increasing a local counter, default ids suffice when all parties execute the
     *                         instructions in the same order. [optional]
     * @return {share-object} this party's share of the result, the final result is 1 if this >= cst, and 0 otherwise.
     * @memberof jiff.secret-share
     */
    self.cgteq = function(cst, l, op_id) {
      if (!(self.isConstant(cst))) throw "parameter should be a number (>=)";

      var share_id = op_id == null ? null : op_id + ":share_cst";
      var share_cst = self.jiff.coerce_to_share(cst, self.holders, self.Zp, share_id);
      return self.sgteq(share_cst, l, op_id);
    }

    /**
     * Greater than with a constant.
     * @method cgt
     * @param {number} cst - the constant to compare with.
     * @param {number} l - the maximum bit length of this share. [optional]
     * @param {string} op_id - the operation id which is used to identify this comparison, this id must be unique, and must
     *                         be passed by all parties to the same instruction.
     *                         This id is used internally as a base for constructing other ids to allow parties to
     *                         identify and match all messages sent as part of this protocol. An automatic id
     *                         is generated by increasing a local counter, default ids suffice when all parties execute the
     *                         instructions in the same order. [optional]
     * @return {share-object} this party's share of the result, the final result is 1 if this > cst, and 0 otherwise.
     * @memberof jiff.secret-share
     */
    self.cgt = function(cst, l, op_id) {
      if (!(self.isConstant(cst))) throw "parameter should be a number (>)";

      var share_id = op_id == null ? null : op_id + ":share_cst";
      var share_cst = self.jiff.coerce_to_share(cst, self.holders, self.Zp, share_id);
      return self.sgt(share_cst, l, op_id);
    };

    /**
     * Less than or equal with a constant.
     * @method clteq
     * @param {number} cst - the constant to compare with.
     * @param {number} l - the maximum bit length of this share. [optional]
     * @param {string} op_id - the operation id which is used to identify this comparison, this id must be unique, and must
     *                         be passed by all parties to the same instruction.
     *                         This id is used internally as a base for constructing other ids to allow parties to
     *                         identify and match all messages sent as part of this protocol. An automatic id
     *                         is generated by increasing a local counter, default ids suffice when all parties execute the
     *                         instructions in the same order. [optional]
     * @return {share-object} this party's share of the result, the final result is 1 if this <= cst, and 0 otherwise.
     * @memberof jiff.secret-share
     */
    self.clteq = function(cst, l, op_id) {
      if (!(self.isConstant(cst))) throw "parameter should be a number (<=)";

      var share_id = op_id == null ? null : op_id + ":share_cst";
      var share_cst = self.jiff.coerce_to_share(cst, self.holders, self.Zp, share_id);
      return self.slteq(share_cst, l, op_id);
    };

    /**
     * Less than with a constant.
     * @method clt
     * @param {number} cst - the constant to compare with.
     * @param {number} l - the maximum bit length of this share. [optional]

     * @param {string} op_id - the operation id which is used to identify this comparison, this id must be unique, and must
     *                         be passed by all parties to the same instruction.
     *                         This id is used internally as a base for constructing other ids to allow parties to
     *                         identify and match all messages sent as part of this protocol. An automatic id
     *                         is generated by increasing a local counter, default ids suffice when all parties execute the
     *                         instructions in the same order. [optional]
     * @return {share-object} this party's share of the result, the final result is 1 if this < cst, and 0 otherwise.
     * @memberof jiff.secret-share
     */
    self.clt = function(cst, l, op_id) {
      if (!(self.isConstant(cst))) throw "parameter should be a number (<)";

      var share_id = op_id == null ? null : op_id + ":share_cst";
      var share_cst = self.jiff.coerce_to_share(cst, self.holders, self.Zp, share_id);
      return self.slt(share_cst, l, op_id);
    };

    /**
     * Equality test with two shares.
     * @method seq
     * @param {share-object} o - the share to compare with.
     * @param {number} l - the maximum bit length of the two shares. [optional]
     * @param {string} op_id - the operation id which is used to identify this comparison, this id must be unique, and must
     *                         be passed by all parties to the same instruction.
     *                         This id is used internally as a base for constructing other ids to allow parties to
     *                         identify and match all messages sent as part of this protocol. An automatic id
     *                         is generated by increasing a local counter, default ids suffice when all parties execute the
     *                         instructions in the same order. [optional]
     * @return {share-object} this party's share of the result, the final result is 1 if this = o, and 0 otherwise.
     * @memberof jiff.secret-share
     */
    self.seq = function(o, l, op_id) {
      if (!(o.jiff === self.jiff)) throw "shares do not belong to the same instance (==)";
      if (!(o.Zp === self.Zp)) throw "shares must belong to the same field (==)";
      if (!self.jiff.helpers.array_equals(self.holders, o.holders)) throw "shares must be held by the same parties (==)";

      var sgteq1_id = op_id != null ? op_id+":lt" : null;
      var sgteq2_id = op_id != null ? op_id+":gt" : null;
      var smult_id = op_id != null ? op_id+"*" : null;

      var one_direction = self.sgteq(o, l, sgteq1_id);
      var other_direction = o.sgteq(self, l, sgteq2_id);
      return one_direction.smult(other_direction, smult_id);
    }

    /**
     * Unequality test with two shares.
     * @method sneq
     * @param {share-object} o - the share to compare with.
     * @param {number} l - the maximum bit length of the two shares. [optional]
     * @param {string} op_id - the operation id which is used to identify this comparison, this id must be unique, and must
     *                         be passed by all parties to the same instruction.
     *                         This id is used internally as a base for constructing other ids to allow parties to
     *                         identify and match all messages sent as part of this protocol. An automatic id
     *                         is generated by increasing a local counter, default ids suffice when all parties execute the
     *                         instructions in the same order. [optional]
     * @return {share-object} this party's share of the result, the final result is 0 if this = o, and 1 otherwise.
     * @memberof jiff.secret-share
     */
    self.sneq = function(o, l, op_id) {
      if (!(o.jiff === self.jiff)) throw "shares do not belong to the same instance (!=)";
      if (!(o.Zp === self.Zp)) throw "shares must belong to the same field (!=)";
      if (!self.jiff.helpers.array_equals(self.holders, o.holders)) throw "shares must be held by the same parties (!=)";

      return self.seq(o, l, op_id).cmult(-1).cadd(1);
    }

    /**
     * Equality test with a constant.
     * @method ceq
     * @param {number} cst - the constant to compare with.
     * @param {number} l - the maximum bit length of this share. [optional]
     * @param {string} op_id - the operation id which is used to identify this comparison, this id must be unique, and must
     *                         be passed by all parties to the same instruction.
     *                         This id is used internally as a base for constructing other ids to allow parties to
     *                         identify and match all messages sent as part of this protocol. An automatic id
     *                         is generated by increasing a local counter, default ids suffice when all parties execute the
     *                         instructions in the same order. [optional]
     * @return {share-object} this party's share of the result, the final result is 0 if this = o, and 1 otherwise.
     * @memberof jiff.secret-share
     */
    self.ceq = function(cst, l, op_id) {
      if (!(self.isConstant(cst))) throw "parameter should be a number (==)";

      var share_id = op_id == null ? null : op_id + ":share_cst";
      var share_cst = self.jiff.coerce_to_share(cst, self.holders, self.Zp, share_id);
      return self.seq(share_cst, l, op_id);
    }

    /**
     * Unequality test with a constant.
     * @method cneq
     * @param {number} cst - the constant to compare with.
     * @param {number} l - the maximum bit length of this share. [optional]
     * @param {string} op_id - the operation id which is used to identify this comparison, this id must be unique, and must
     *                         be passed by all parties to the same instruction.
     *                         This id is used internally as a base for constructing other ids to allow parties to
     *                         identify and match all messages sent as part of this protocol. An automatic id
     *                         is generated by increasing a local counter, default ids suffice when all parties execute the
     *                         instructions in the same order. [optional]
     * @return {share-object} this party's share of the result, the final result is 0 if this = o, and 1 otherwise.
     * @memberof jiff.secret-share
     */
    self.cneq = function(cst, l, op_id) {
      if (!(self.isConstant(cst))) throw "parameter should be a number (!=)";

      return self.ceq(cst, l, op_id).cmult(-1).cadd(1);
    }

    /**
     * Negation of a bit.
     * This has to be a share of a BIT in order for this to work properly.
     * @method not
     * @return {share-object} this party's share of the result (negated bit).
     * @memberof jiff.secret-share
     */
    self.not = function() {
      return self.cmult(-1).cadd(1);
    }

    /**
     * Integer divison with two shares (self / o)
     * @method sdiv
     * @param {share-object} o - the share to divide by.
     * @param {number} l - the maximum bit length of the two shares. [optional]
     * @param {string} op_id - the operation id which is used to identify this comparison, this id must be unique, and must
     *                         be passed by all parties to the same instruction.
     *                         This id is used internally as a base for constructing other ids to allow parties to
     *                         identify and match all messages sent as part of this protocol. An automatic id
     *                         is generated by increasing a local counter, default ids suffice when all parties execute the
     *                         instructions in the same order. [optional]
     * @return {share-object} this party's share of the result.
     * @memberof jiff.secret-share
     */
    self.sdiv = function(o, l, op_id) {
      if (!(o.jiff === self.jiff)) throw "shares do not belong to the same instance (!=)";
      if (!(o.Zp === self.Zp)) throw "shares must belong to the same field (!=)";
      if (!self.jiff.helpers.array_equals(self.holders, o.holders)) throw "shares must be held by the same parties (!=)";

      // default bit length is the max possible bit length without getting in trouble with javascript big numbers.
      if(l == null) l = 8;

      // q_shr is this party's share of the quotient, initialy a share of zero.
      var number_id = op_id == null ? null : op_id+":number";
      var q_shr = self.jiff.server_generate_and_share({"number": 0}, self.holders, self.threshold, self.Zp, number_id);
      for (var i = 0; i < l; i++) {
        var power = Math.pow(2, (l-1)-i);

        var mask = q_shr.cadd(power);
        var cmp_id = op_id == null ? null : op_id+":slteq"+i;
        var tmp_m = (mask.smult(o)).slteq(self, 2*l, cmp_id);
        q_shr = q_shr.sadd(tmp_m.cmult(power));
      }

      if(op_id != null) q_shr.id = op_id;
      return q_shr;
    };

    /**
     * Integer divison with a share and a constant (self / cst).
     * @method cdiv
     * @param {share-object} cst - the constant to divide by.
     * @param {number} l - the maximum bit length of the two numbers. [optional]
     * @param {string} op_id - the operation id which is used to identify this comparison, this id must be unique, and must
     *                         be passed by all parties to the same instruction.
     *                         This id is used internally as a base for constructing other ids to allow parties to
     *                         identify and match all messages sent as part of this protocol. An automatic id
     *                         is generated by increasing a local counter, default ids suffice when all parties execute the
     *                         instructions in the same order. [optional]
     * @return {share-object} this party's share of the result.
     * @memberof jiff.secret-share
     */
    self.cdiv = function(cst, l, op_id) {
      if (!(self.isConstant(cst))) throw "parameter should be a number (/)";

      var share_id = op_id == null ? null : op_id + ":share_cst";
      var share_cst = self.jiff.coerce_to_share(cst, self.holders, self.Zp, share_id);
      return self.sdiv(share_cst, l, op_id);
    };

    // when the promise is resolved, acquire the value of the share and set ready to true
    if(!ready) self.promise.then(self.receive_share, self.error);


    // return the share
    return jiff.execute_array_hooks('createSecretShare', [jiff, self], 1);
  }

  /**
   * The interface defined by an instance of jiff.
   * You can get an instance of jiff by calling function {@link jiff.make_jiff}.
   * You can access any of the specified members of function with &lt;jiff-instance&gt;.&lt;member-name&gt;.
   * @namespace jiff-instance
   * @memberof jiff
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
   *                           all parameters are optional, However, for private and public key for this party must be both provided (or neither).
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
     * The id of this party. [Do not modify]
     * @member {number} id
     * @memberof jiff.jiff-instance
     * @instance
     */
    jiff.id = options.party_id;

    /**
     * Stores the computation id. [Do not modify]
     * @member {string} computation_id
     * @memberof jiff.jiff-instance
     * @instance
     */
    jiff.computation_id = computation_id;

    /**
     * Flags whether this instance is capable of starting the computation.
     * In other words, the public keys for all parties and servers are known,
     * and the server is connected. [Do not use; ufse isReady() instead]
     * @member {boolean} __ready
     * @memberof jiff.jiff-instance
     * @instance
     */
    jiff.__ready = false;

    /**
     * Checks whether this instance is connected and the server signaled the start of computation.
     * @method isReady
     * @memberof jiff.jiff-instance
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
       * @memberof jiff.jiff-instance
       * @instance
       */
      jiff.keymap = options.public_keys;
    }

    else if(options.secret_key != null && options.public_key != null) {
      /**
       * The secret key of this party [(check Library Specs)]{@link https://download.libsodium.org/doc/public-key_cryptography/authenticated_encryption.html}. [Do not modify]
       * @member {Uint8Array} secret_key
       * @memberof jiff.jiff-instance
       * @instance
       */
      jiff.secret_key = options.secret_key;
      /**
       * The public key of this party [(check Library Specs)]{@link https://download.libsodium.org/doc/public-key_cryptography/authenticated_encryption.html}. [Do not modify]
       * @member {Uint8Array} public_key
       * @memberof jiff.jiff-instance
       * @instance
       */
      jiff.public_key = options.public_key;
    }

    if(options.party_count != null)
      /**
       * Total party count in the computation, parties will take ids between 1 to party_count (inclusive).
       * @member {number} party_count
       * @memberof jiff.jiff-instance
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
     * @memberof jiff.jiff-instance
     * @instance
     */
    jiff.listeners = options.listeners

    /**
     * The hooks for this instance.
     * Checkout the <a href="hooks.html">hooks documentation</a>
     * @member {object} hooks
     * @memberof jiff.jiff-instance
     * @instance
     */
    jiff.hooks = options.hooks;

    // Default hooks:
    if(jiff.hooks == null) jiff.hooks = {};
    if(jiff.hooks.computeShares == null) jiff.hooks.computeShares = jiff_compute_shares;
    if(jiff.hooks.reconstructShare == null) jiff.hooks.reconstructShare = jiff_lagrange;
    if(jiff.hooks.encryptSign == null) jiff.hooks.encryptSign = encrypt_and_sign;
    if(jiff.hooks.decryptSign == null) jiff.hooks.decryptSign = decrypt_and_sign;

    /**
     * Execute all hooks attached to the given name in order.
     * Hooks are executed sequentially such that the first hook's return value is passed into the second and so on.
     * @method execute_array_hooks
     * @memberof jiff.jiff-instance
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
     * @memberof jiff.jiff-instance
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
     * @memberof jiff.jiff-instance
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
     * @memberof jiff.jiff-instance
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
     * @memberof jiff.jiff-instance
     * @instance
     */
    jiff.server_count = 1;

    /**
     * Connect to the server and starts listening.
     * @method connect
     * @memberof jiff.jiff-instance
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
     * Use jiff.hooks.encryptSign / jiff.hooks.decryptSign
     * @memberof jiff.jiff-instance
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
      }

      jiff.socket.safe_emit("custom", JSON.stringify( {'tag': tag, 'receivers': receivers, 'message': message } ));
    };

    /**
     * Registers the given function as a listener for messages with the given tag.
     * Removes any previously set listener for this tag.
     * @memberof jiff.jiff-instance
     * @function listen
     * @instance
     * @param {string} tag - the tag to listen for.
     * @param {function(party_id, string)} handler - the function that handles the received message: takes the sender id and the message as parameters.
     */
    jiff.listen = function(tag, handler) {
      jiff.listeners[tag] = handler;
    }

    /**
     * Helper functions [DO NOT MODIFY UNLESS YOU KNOW WHAT YOU ARE DOING].
     * @type object
     * @memberof jiff.jiff-instance
     * @namespace helpers
     */
    jiff.helpers = {};

    /**
     * Correct Mod instead of javascript's remainder (%).
     * @memberof jiff.jiff-instance.helpers
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
     * @memberof jiff.jiff-instance.helpers
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
     * @memberof jiff.jiff-instance.helpers
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
     * @memberof jiff.jiff-instance.helpers
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
     * @memberof jiff.jiff-instance.helpers
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
     * Generate a random integer between 0 and max-1 [inclusive].
     * Modify this to change the source of randomness and how it is generated.
     * @method random
     * @memberof jiff.jiff-instance.helpers
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
     * @memberof jiff.jiff-instance.helpers
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
     * @memberof jiff.jiff-instance
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
     * @memberof jiff.jiff-instance
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
    jiff.share = function(secret, threshold, receivers_list, senders_list, Zp, share_id) { return jiff_share(jiff, secret, threshold, receivers_list, senders_list, Zp, share_id); };

    /**
     * Open a secret share to reconstruct secret.
     * @method open
     * @memberof jiff.jiff-instance
     * @instance
     * @param {share-object} share - this party's share of the secret to reconstruct.
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
    jiff.open = function(share, parties, op_ids) { return jiff_open(jiff, share, parties, op_ids); };

    /**
     * Opens a bunch of secret shares.
     * @method open_all
     * @memberof jiff.jiff-instance
     * @instance
     * @param {array<share-object>} shares - an array containing this party's shares of the secrets to reconstruct.
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
     * @memberof jiff.jiff-instance
     * @instance
     * @param {array} parties - an array with party ids (1 to n) specifying the parties sending the shares.
     * @param {number} threshold - the minimimum number of parties needed to reconstruct the secret, defaults to all the senders. [optional]
     * @param {number} Zp - the modulos (if null then the default Zp for the instance is used). [optional]
     * @param {string/number/object} op_ids - same as jiff.jiff-instance.open(..)
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
     * @memberof jiff.jiff-instance
     * @instance
     * @param {array} receivers_list - array of party ids that want to receive the triplet shares, by default, this includes all parties. [optional]
     * @param {number} threshold - the minimimum number of parties needed to reconstruct the triplet.
     * @param {number} Zp - the modulos (if null then the default Zp for the instance is used). [optional]
     * @param {string} triplet_id - the triplet id which is used to identify the triplet requested, so that every party
     *                              gets a share from the same triplet for every matching instruction. An automatic triplet id
     *                              is generated by increasing a local counter, default ids suffice when all parties execute the
     *                              instructions in the same order. [optional]
     * @returns an array of 3 share-objects [share_a, share_b, share_c] such that a * b = c.
     */
    jiff.triplet = function(receivers_list, threshold, Zp, triplet_id) { return jiff_triplet(jiff, receivers_list, threshold, Zp, triplet_id); };

    /**
     * Creates shares of an unknown random number. Every party comes up with its own random number and shares it.
     * Then every party combines all the received shares to construct one share of the random unknown number.
     * @method generate_and_share_random
     * @memberof jiff.jiff-instance
     * @instance
     * @param {number} threshold - the minimimum number of parties needed to reconstruct the secret, defaults to all the recievers. [optional]
     * @param {array} receivers_list - array of party ids to share with, by default, this includes all parties. [optional]
     * @param {array} senders_list - array of party ids to receive from, by default, this includes all parties. [optional]
     * @param {number} Zp - the modulos (if null then the default Zp for the instance is used). [optional]
     * @returns {share-object} a secret share of the random number, null if this party is not a receiver.
     */
    jiff.generate_and_share_random = function(threshold, receivers_list, senders_list, Zp) {
      return jiff_share_all_number(jiff, jiff.helpers.random(Zp), threshold, receivers_list, senders_list, Zp);
    };

    /**
     * Creates shares of 0, such that no party knows the other parties' shares.
     * Every party secret shares 0, then every party sums all the shares they received, resulting
     * in a new share of 0 for every party.
     * @method generate_and_share_zero
     * @memberof jiff.jiff-instance
     * @instance
     * @param {number} threshold - the minimimum number of parties needed to reconstruct the secret, defaults to all the recievers. [optional]
     * @param {array} receivers_list - array of party ids to share with, by default, this includes all parties. [optional]
     * @param {array} senders_list - array of party ids to receive from, by default, this includes all parties. [optional]
     * @param {number} Zp - the modulos (if null then the default Zp for the instance is used). [optional]
     * @returns {share-object} a secret share of zero, null if this party is not a receiver.
     */
    jiff.generate_and_share_zero = function(threshold, receivers_list, senders_list, Zp) {
      return jiff_share_all_number(jiff, 0, threshold, receivers_list, senders_list, Zp);
    };


    /**
     * Use the server to generate shares for a random bit, zero, random non-zero number, or a random number.
     * The parties will not know the value of the number (unless the request is for shares of zero) nor other parties' shares.
     * @method server_generate_and_share
     * @memberof jiff.jiff-instance
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
     * @returns {share-object} a secret share of zero/random bit/random number/random non-zero number.
     */
    jiff.server_generate_and_share = function(options, receivers_list, threshold, Zp, number_id) { return jiff_server_share_number(jiff, options, receivers_list, threshold, Zp, number_id) };

    /**
     * Coerce a number into a share.
     * THIS DOES NOT SHARE THE GIVEN NUMBER.
     * It is a local type-coersion by invoking the constructor on the given parameter,
     * this is useful for for operating on constants, not sharing secret data.
     * If all parties use this function with the same input number, then
     * you can think of their shares as being a share of that constant with threshold 1.
     * In other words, a trivial sharing scheme where the share is the number itself.
     * However, if some parties used different input numbers, then the actual value
     * yielded by reconstruction/opening of all these shares is arbitrary and depends
     * on all the input numbers of all parties.
     * @method coerce_to_share
     * @memberof jiff.jiff-instance
     * @instance
     * @param {number} number - the number to coerce.
     * @param {array} holders - array of party ids that will hold the shares, by default, this includes all parties. [optional]
     * @param {number} Zp - the modulos (if null then the default Zp for the instance is used). [optional]
     * @param {string} id - this share's id (should be unique). [optional]
     * @returns {share-object} a share object containing the given number.
     *
     */
    jiff.coerce_to_share = function(number, holders, Zp, share_id) { return jiff_coerce_to_share(jiff, number, holders, Zp, share_id); };

    /**
     * Disconnects from the computation.
     * Allows the client program to exit.
     */
    jiff.disconnect = function() { jiff.socket.disconnect(); jiff.triplets_socket.disconnect(); jiff.numbers_socket.disconnect(); };

    /**
     * Share an array of values. The maximum length of the shared arrays will be shared with the parties publicly.
     * @memberof jiff.jiff-instance
     * @instance
     * @param {array} array - the array to be shared.
     * @param {function} callback - a callback function having the array of shares.
     * @param {number} padding - a number to be padded as extra values. [optional]
     */
    jiff.share_array = function(array, callback, padding) { return jiff_share_array(jiff, array, callback, padding); }

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
      else
        console.log("No Listener for tag: " + tag +". Details: " + sender_id + ", " + message);
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
  exports.utils = { 'encrypt_and_sign': encrypt_and_sign, 'decrypt_and_sign': decrypt_and_sign };
  exports.sharing_schemes = { 'shamir_share': jiff_compute_shares, 'shamir_reconstruct': jiff_lagrange };
}((typeof exports == 'undefined' ? this.jiff = {} : exports), typeof exports != 'undefined'));
