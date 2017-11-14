/** The modulos to be used in secret sharing and operations on shares. */
var gZp = 1299827;

/** The length of RSA key in bits. */
var RSA_bits = 1024;

/** Size of the Passphrase used in generating an RSA key */
var passphrase_size = 25;

/**
 * The exposed API from jiff.js (The client side library of JIFF).
 * Wraps the jiff API. Internal members can be accessed with jiff.&lt;member-name&gt;.
 * @namespace jiff
 * @version 1.0
 */
(function(exports, node) {
  if(node) {
    io = require('socket.io-client');
    cryptico = require('cryptico');
    $ = require('jquery-deferred');
  }
  
  /** Return the maximum of two numbers */
  function max(x, y) {
    return x > y ? x : y;
  }

  /** Randomly generate a string of size length */
  function random_string(length) {
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for(var i = 0; i < length; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }

    return text;
  }

  /**
   * Mod instead of javascript's remainder (%).
   * @memberof jiff
   * @function mod
   * @instance
   * @param {number} x
   * @param {number} y
   * @return {number} x mod y.
   */
  function mod(x, y) {
    if (x < 0) {
      return ((x%y)+y)%y;
    }

    return x%y;
  }

  /** Extended Euclead */
  function extended_gcd(a,b) {
    if (b == 0)
      return [1, 0, a];

    temp = extended_gcd(b, a % b);
    x = temp[0];
    y = temp[1];
    d = temp[2];
    return [y, x-y*Math.floor(a/b), d];
  }

  /** Compute the log to a given base (2 by default). */
  function bLog(value, base) {
    if(base == null) base = 2;
    return Math.log(value) / Math.log(base);
  }

  /**
   * Get the party number from the given party_id, the number is used to compute/open shares.
   * If party id was a number (regular party), that number is returned,
   * If party id referred to the ith server, then party_count + i is returned (i > 0).
   * @param {number} party_count - the party count (how many non server parties).
   * @param {number/string} party_id - the party id from which to compute the number.
   * @return {number} the party number (> 0).
   */
  function get_party_number(party_count, party_id) {
    if (typeof(party_id) == "number") return party_id;
    if (party_id.startsWith("s")) return party_count + parseInt(party_id.substring(1), 10);
    return parseInt(party_id, 10);
  }

  /**
   * Encrypts and signs the given message, the function will execute message.toString(10)
   * internally to ensure type of message is a string before encrypting.
   * @param {number} message - the message to encrypt.
   * @param {string} encryption_public_key - ascii-armored public key to encrypt with.
   * @param {RSAKey} signing_private_key - the private key of the encrypting party to sign with.
   * @param {boolean} is_string - set to true if message is a string, defaults to false [optional].
   * @returns {String} the signed cipher text.
   */
  function encrypt_and_sign(message, encryption_public_key, signing_private_key, is_string) {
    if(is_string == null || is_string == false) message = message.toString(10);
    return cryptico.encrypt(message, encryption_public_key, signing_private_key).cipher;
  }

  /**
   * Decrypts and checks the signature of the given ciphertext, the function will execute
   * parseInt internally to ensure returned value is a number.
   * @param {number} cipher_text - the ciphertext to decrypt.
   * @param {RSAKey} decryption_secret_key - the secret key to decrypt with.
   * @param {string} signing_public_key - ascii-armored public key to verify against signature.
   * @param {boolean} is_string - set to true if decrypted message is expected to be a string, defaults to false [optional].
   * @returns {number} the decrypted message if the signature was correct.
   * @throws error if signature was forged/incorrect.
   */
  function decrypt_and_sign(cipher_text, decryption_secret_key, signing_public_key, is_string) {
      var decryption_result = cryptico.decrypt(cipher_text, decryption_secret_key);
      if(decryption_result.signature == "verified" && decryption_result.publicKeyString == signing_public_key) {
        if(is_string === true) return decryption_result.plaintext;
        return parseInt(decryption_result.plaintext, 10);
      }
      else
        throw "Bad signature";
  }

  /**
   * Share given secret to the participating parties.
   * @param {jiff-instance} jiff - the jiff instance.
   * @param {number} secret - the secret to share.
   * @param {number} threshold - the minimimum number of parties needed to reconstruct the secret, defaults to all the recievers [optional].
   * @param {array} receivers_list - array of party ids to share with, by default, this includes all parties [optional].
   * @param {array} senders_list - array of party ids to receive from, by default, this includes all parties [optional].
   * @param {number} Zp - the modulos (if null global gZp will be used) [optional].
   * @param {number} op_id - the operation id that matches this operation with received messages [optional].
   * @returns {object} a map where the key is the sender party id
   *          and the value is the share object that wraps
   *          what was sent from that party (the internal value maybe deferred).
   *          if the party that calls this function is not a receiver then the map
   *          will be empty.
   */
  function jiff_share(jiff, secret, threshold, receivers_list, senders_list, Zp, op_id) {
    // defaults
    if(Zp == null) Zp = gZp;
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
    if(op_id == undefined) {
      var label = receivers_list.join(",") + ":" + senders_list.join(",");
      if(jiff.share_op_count[label] == null) jiff.share_op_count[label] = 0;
      op_id = "share:" + label + ":" + (jiff.share_op_count[label]++);
    }

    // stage sending of shares
    if(senders_list.indexOf(jiff.id) > -1) {
      // compute shares
      var shares = jiff_compute_shares(secret, jiff.party_count, receivers_list, threshold, Zp);

      // send shares
      for(var i = 0; i < receivers_list.length; i++) {
        var p_id = receivers_list[i];
        if(p_id == jiff.id) continue;

        // send encrypted and signed shares_id[p_id] to party p_id
        var cipher_share = encrypt_and_sign(shares[p_id], jiff.keymap[p_id], jiff.secret_key);
        var msg = { party_id: p_id, share: cipher_share, op_id: op_id };
        jiff.socket.emit('share', JSON.stringify(msg));
      }
    }

    // stage receiving of shares
    var result = {};
    if(receivers_list.indexOf(jiff.id) > -1) {
      // setup a map of deferred for every received share
      if(jiff.deferreds[op_id] == null) jiff.deferreds[op_id] = {};

      for(var i = 0; i < senders_list.length; i++) {
        var p_id = senders_list[i];
        if(p_id == jiff.id) {
          result[p_id] = new secret_share(jiff, true, null, shares[p_id], receivers_list, threshold, Zp);
          continue; // Keep party's own share
        }

        // check if a deferred is set up (maybe the message was previously received)
        if(jiff.deferreds[op_id][p_id] == null)
          // not ready, setup a deferred
          jiff.deferreds[op_id][p_id] = $.Deferred();

        var promise = jiff.deferreds[op_id][p_id].promise();

        // destroy deferred when done
        (function(promise, p_id) { // p_id is modified in a for loop, must do this to avoid scoping issues.
          promise.then(function() { jiff.deferreds[op_id][p_id] = null; });
        })(promise, p_id);

        // receive share_i[id] from party p_id
        result[p_id] = new secret_share(jiff, false, promise, undefined, receivers_list, threshold, Zp);
      }
    }

    return result;
  }

  /**
   * Compute the shares of the secret (as many shares as parties) using
   * a polynomial of degree: ceil(parties/2) - 1 (honest majority).
   * @param {number} secret - the secret to share.
   * @param {number} party_count - the number of parties in the entire computation (excluding servers).
   * @param {array} parties_list - array of party ids to share with.
   * @param {number} threshold - the minimimum number of parties needed to reconstruct the secret, defaults to all the recievers [optional].
   * @param {number} Zp - the modulos.
   * @returns {object} a map between party number (from 1 to parties) and its
   *          share, this means that (party number, share) is a
   *          point from the polynomial.
   *
   */
  function jiff_compute_shares(secret, party_count, parties_list, threshold, Zp) {
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
    for(var i = 1; i <= t; i++) polynomial[i] = Math.floor(Math.random() * Zp);

    // Compute each players share such that share[i] = f(i)
    for(var i = 0; i < parties_list.length; i++) {
      var p_id = parties_list[i];
      shares[p_id] = polynomial[0];
      var power = get_party_number(party_count, p_id);

      for(var j = 1; j < polynomial.length; j++) {
        shares[p_id] = mod((shares[p_id] + polynomial[j] * power), Zp);
        power = power * get_party_number(party_count, p_id);
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
    share = decrypt_and_sign(share, jiff.secret_key, jiff.keymap[sender_id]);

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
   * @param {array} parties - an array with party ids (1 to n) of receiving parties [optional].
   * @param {number} op_id - the operation id that matches this operation with received messages [optional].
   * @returns {promise} a (JQuery) promise to the open value of the secret, null if the calling party is not a receiving party.
   * @throws error if share does not belong to the passed jiff instance.
   *
   */
  function jiff_open(jiff, share, parties, op_id) {
    if(!(share.jiff === jiff)) throw "share does not belong to given instance";

    // Default values
    if(parties == null || parties == []) {
      parties = [];
      for(var i = 1; i <= jiff.party_count; i++)
        parties.push(i);
    }

    // If not a receiver nor holder, do nothing
    if(share.holders.indexOf(jiff.id) == -1 && parties.indexOf(jiff.id) == -1) return null;

    // Compute operation id
    if(op_id == null) {
      var label = share.holders.join(",");
      if(jiff.open_op_count[label] == null) jiff.open_op_count[label] = 0;
      op_id = "open:" + label + ":" + (jiff.open_op_count[label]++);
    }

    // Party is a holder
    if(share.holders.indexOf(jiff.id) > -1) {
      // refresh/reshare, so that the original share remains secret, instead
      // a new share is sent/open without changing the actual value.
      share = share.refresh();

      // The given share has been computed, share it to all parties
      if(share.ready) jiff_broadcast(jiff, share, parties, op_id);

      // Share is not ready, setup sharing as a callback to its promise
      else share.promise.then(function() { jiff_broadcast(jiff, share, parties, op_id); }, share.error);
    }

    // Party is a receiver
    if(parties.indexOf(jiff.id) > -1) {
      var promises = [];
      for(var i = 0; i < share.holders.length; i++) {
        var p_id = share.holders[i];

        // Setup a deferred for receiving a share from party p_id
        if(jiff.deferreds[op_id] == null) jiff.deferreds[op_id] = {};
        if(jiff.deferreds[op_id][p_id] == null) jiff.deferreds[op_id][p_id] = $.Deferred();

        // Clean up deferred when fulfilled
        var promise = jiff.deferreds[op_id][p_id].promise();

        // destroy deferred when done
        (function(promise, p_id) { // p_id is modified in a for loop, must do this to avoid scoping issues.
          promise.then(function() { jiff.deferreds[op_id][p_id] = null; });
        })(promise, p_id);

        // Keep track of all promises to open when all is received
        promises.push(promise);
      }

      // All shares received, reconstruct using holders list
      return Promise.all(promises).then(function(shares) {
        jiff.deferreds[op_id] = null;
        return jiff_lagrange(shares, jiff.party_count);
      });
    }

    return null;
  }

  /**
   * Opens a bunch of secret shares.
   * @param {jiff-instance} jiff - the jiff instance.
   * @param {array<share-object>} shares - an array containing this party's shares of the secrets to reconstruct.
   * @param {array} parties - an array with party ids (1 to n) of receiving parties [optional].
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
   * @param {number} op_id - the id of the share operation.
   *
   */
  function jiff_broadcast(jiff, share, parties, op_id) {
    for(var index = 0; index < parties.length; index++) {
      var i = parties[index]; // Party id
      if(i == jiff.id) { receive_open(jiff, i, share.value, op_id, share.Zp); continue; }

      // encrypt, sign and send
      var cipher_share = encrypt_and_sign(share.value, jiff.keymap[i], jiff.secret_key);
      var msg = { party_id: i, share: cipher_share, op_id: op_id, Zp: share.Zp };
      jiff.socket.emit('open', JSON.stringify(msg));
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
      share = decrypt_and_sign(share, jiff.secret_key, jiff.keymap[sender_id]);

    // Resolve the deferred.
    if(jiff.deferreds[op_id] == null) jiff.deferreds[op_id] = {};
    if(jiff.deferreds[op_id][sender_id] == null) jiff.deferreds[op_id][sender_id] = $.Deferred();

    jiff.deferreds[op_id][sender_id].resolve( { "value": share, "sender_id": sender_id, "Zp": Zp } );
  }

  /*
   * Uses Lagrange polynomials to interpolate the polynomial
   * described by the given shares (points).
   * @param {array} shares - an array of objects representing shares to reconstruct, every object has 3 attributes: value, sender_id, Zp.
   * @param {number} party_count - number of parties in the entire computation.
   * @returns {number} the value of the polynomial at x=0 (the secret value).
   *
   */
  function jiff_lagrange(shares, party_count) {
    var lagrange_coeff = []; // will contain shares.length many elements.

    // Compute the Langrange coefficients at 0.
    for(var i = 0; i < shares.length; i++) {
      var pi = get_party_number(party_count, shares[i].sender_id);
      lagrange_coeff[pi] = 1;

      for(var j = 0; j < shares.length; j++) {
        var pj = get_party_number(party_count, shares[j].sender_id);
        if(pj != pi) lagrange_coeff[pi] = lagrange_coeff[pi] * (0 - pj) / (pi - pj);
      }
    }

    // Reconstruct the secret via Lagrange interpolation
    var recons_secret = 0;
    for(var i = 0; i < shares.length; i++) {
      var pi = get_party_number(party_count, shares[i].sender_id);
      recons_secret = mod((recons_secret + shares[i].value * lagrange_coeff[pi]), shares[i].Zp);
    }

    return recons_secret;
  }

  /*
   * Creates 3 shares, a share for every one of three numbers from a beaver triplet.
   * The server generates and sends the triplets on demand.
   * @param {jiff-instance} jiff - the jiff instance.
   * @param {array} receivers_list - array of party ids that want to receive the triplet shares, by default, this includes all parties [optional].
   * @param {number} threshold - the minimimum number of parties needed to reconstruct the triplet.
   * @param {number} Zp - the modulos (if null then global Zp is used by default) [optional].
   * @returns {array<share-object>} an array of 3 share-objects [share_a, share_b, share_c] such that a * b = c.
   */
  function jiff_triplet(jiff, receivers_list, threshold, Zp) {
    if(Zp == null) Zp = gZp;
    if(receivers_list == null)
      for(var i = 1; i <= jiff.party_count; i++) receivers_list.push(i);

    // Get the id of the triplet needed.
    var label = receivers_list.join(",");
    if(jiff.triplet_op_count[label] == null) jiff.triplet_op_count[label] = 0;
    var triplet_id = "triplet:" + label + ":" + (jiff.triplet_op_count[label]++);

    // Send a request to the server.
    var msg = JSON.stringify({triplet_id: triplet_id, receivers: receivers_list, threshold: threshold, Zp: Zp});

    // Setup deferreds to handle receiving the triplets later.
    var a_deferred = $.Deferred();
    var b_deferred = $.Deferred();
    var c_deferred = $.Deferred();
    jiff.deferreds[triplet_id] = { a: a_deferred, b: b_deferred, c: c_deferred };

    // send a request to the server.
    if(jiff.id == "s1")
      jiff.triplets_socket.emit('triplet', msg);
    else
      jiff.triplets_socket.emit('triplet', encrypt_and_sign(msg, jiff.keymap["s1"], jiff.secret_key, true));

    var a_share = new secret_share(jiff, false, a_deferred.promise(), undefined, receivers_list, threshold, Zp);
    var b_share = new secret_share(jiff, false, b_deferred.promise(), undefined, receivers_list, threshold, Zp);
    var c_share = new secret_share(jiff, false, c_deferred.promise(), undefined, receivers_list, threshold, Zp);
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
   * @param {number} threshold - the minimimum number of parties needed to reconstruct the secret, defaults to all the recievers [optional].
   * @param {array} receivers_list - array of party ids to share with, by default, this includes all parties [optional].
   * @param {array} senders_list - array of party ids to receive from, by default, this includes all parties [optional].
   * @param {number} Zp - the modulos (if null then global Zp is used by default) [optional].
   * @return {share-object} this party's share of the the number, null if this party is not a receiver.
   */
  function jiff_share_all_number(jiff, n, threshold, receivers_list, senders_list, Zp) {
    if(Zp == null) Zp = gZp;
    var shares = jiff_share(jiff, n, threshold, receivers_list, senders_list, Zp);

    var share = shares[1];
    if(share != null) { // only do this if you are a receiving party.
      for(var i = 2; i <= jiff.party_count; i++) {
        share = share.add(shares[i]);
      }
    }

    return share;
  }

  /**
   * Use the server to generate shares for a random bit, zero, random non-zero number, or a random number.
   * The parties will not know the value of the number (unless the request is for shares of zero) nor other parties' shares.
   * @param {jiff-instance} jiff - the jiff instance.
   * @param {object} options - an object with these properties:
   *                           { "number": number, "bit": boolean, "nonzero": boolean, "max": number}
   * @param {array} receivers_list - array of party ids that want to receive the triplet shares, by default, this includes all parties [optional].
   * @param {number} threshold - the minimimum number of parties needed to reconstruct the number.
   * @param {number} Zp - the modulos (if null then global Zp is used by default) [optional].
   */
  function jiff_server_share_number(jiff, options, receivers_list, threshold, Zp) {
    if(Zp == null) Zp = gZp;
    if(receivers_list == null)
      for(var i = 1; i <= jiff.party_count; i++) receivers_list.push(i);

    // Get the id of the number.
    var label = receivers_list.join(",");
    if(jiff.number_op_count[label] == null) jiff.number_op_count[label] = 0;
    var number_id = "number:" + label + ":" + (jiff.number_op_count[label]++);

    var msg = { number_id: number_id, receivers: receivers_list, threshold: threshold, Zp: Zp };
    msg = Object.assign(msg, options);
    msg = JSON.stringify(msg);

    // Setup deferreds to handle receiving the triplets later.
    var deferred = $.Deferred();
    jiff.deferreds[number_id] = deferred;

    // Send a request to the server.
    if(jiff.id == "s1")
      jiff.numbers_socket.emit('number', msg);
    else
      jiff.numbers_socket.emit('number', encrypt_and_sign(msg, jiff.keymap["s1"], jiff.secret_key, true));

    var share = new secret_share(jiff, false, deferred.promise(), undefined, receivers_list, threshold, Zp);
    return share;
  }

  /*
   * Store the received share of a previously requested number from the server.
   * @param {jiff-instance} jiff - the jiff instance.
   * @param {number} number_id - the id of the number.
   * @param {number} share - the value of the share.
   */
  function receive_server_share_number(jiff, number_id, share) {
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
   *  @param {array} holders - array of party ids that will hold the shares, by default, this includes all parties [optional].
   *  @param {number} Zp - the modulos [optional].
   *  @returns {share-object} a share object containing the given number.
   *
   */
  function jiff_coerce_to_share(jiff, number, holders, Zp) {
    if(Zp == null) Zp = gZp;
    if(holders == null)
      for(var i = 1; i <= jiff.party_count; i++) holders.push(i);
    return new secret_share(jiff, true, null, number, holders, 1, Zp);
  }


  /**
   * Create a new share.
   * A share is a value wrapper with a share object, it has a unique id
   * (per computation instance), and a pointer to the instance it belongs to.
   * A share also has methods for performing operations.
   * @memberof jiff
   * @class
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
  function secret_share(jiff, ready, promise, value, holders, threshold, Zp) {
    var self = this;

    /** @member {jiff-instance} */
    this.jiff = jiff;
    /** @member {boolean} */
    this.ready = ready;
    /** @member {promise} */
    this.promise = promise;
    /** @member {number} */
    this.value = value;
    /** @member {array} */
    this.holders = holders;
    /** @member {array} */
    this.threshold = threshold;
    /** @member {number} */
    this.Zp = Zp;

    /** @member {string} */
    this.id = "share"+jiff.share_obj_count;
    jiff.share_obj_count++;

    /**
     * Gets the value of this share.
     * @method
     * @returns {number} the value (undefined if not ready yet).
     */
    this.valueOf = function() {
      if(ready) return self.value;
      else return undefined;
    };

    /**
     * Gets a string representation of this share.
     * @method
     * @returns {string} the id and value of the share as a string.
     */
    this.toString = function() {
      if(ready) return self.id + ": " + self.value;
      else return self.id + ": <deferred>";
    };

    /**
     * Logs an error.
     * @method
     */
    this.error = function() { console.log("Error receiving " + self.toString); };

    /**
     * Receives the value of this share when ready.
     * @method
     * @param {number} value - the value of the share.
     */
    this.receive_share = function(value) { self.value = value; self.ready = true; self.promise = null; };

    /**
     * Joins the pending promises of this share and the given share.
     * @method
     * @param {share-object} o - the other share object.
     * @returns {promise} the joined promise for both shares (or whichever is pending).
     */
    this.pick_promise = function(o) {
      if(self.ready && o.ready) return null;

      if(self.ready) return o.promise;
      else if(o.ready) return self.promise;
      else return Promise.all([self.promise, o.promise]);
    };

    /**
     * Reshares/refreshes the sharing of this number, used before opening to keep the share secret.
     * @method
     * @returns {secret-share} a new share of the same number.
     */
    this.refresh = function() {
      return self.add(self.jiff.server_generate_and_share({"number": 0}, self.holders, self.threshold, self.Zp));
    };

    /**
     * Reveals/Opens the value of this share.
     * @method
     * @param {function(number)} success - the function to handle successful open.
     * @param {function(string)} error - the function to handle errors and error messages. [optional]
     * @returns {promise} a (JQuery) promise to the open value of the secret.
     * @throws error if share does not belong to the passed jiff instance.
     */
    this.open = function(success, failure) {
      if(failure == null) failure = self.error;
      var promise = self.jiff.open(self);
      if(promise != null) promise.then(success, failure);
      return promise;
    };

    /**
     * Reveals/Opens the value of this share to a specific array of parties.
     * @method
     * @param {array} parties - the ids of parties to reveal secret to.
     * @param {function(number)} success - the function to handle successful open.
     * @param {function(string)} error - the function to handle errors and error messages. [optional]
     */
    this.open_to = function(parties, success, failure) {
      if(failure == null) failure = self.error;
      var promise = self.jiff.open(self, parties);
      if(promise != null) promise.then(success, failure);
    };

    /**
     * Addition with a constant.
     * @method
     * @param {number} cst - the constant to add.
     * @return {share-object} this party's share of the result.
     */
    this.add_cst = function(cst){
      if (!(typeof(cst) == "number")) throw "parameter should be a number (+)";

      if(self.ready) // if share is ready
        return new secret_share(self.jiff, true, null, mod((self.value + cst), self.Zp), self.holders, self.threshold, self.Zp);

      var promise = self.promise.then(function() { return mod((self.value + cst), self.Zp); }, self.error);
      return new secret_share(self.jiff, false, promise, undefined, self.holders, self.threshold, self.Zp);
    };

    /**
     * Subtraction with a constant.
     * @method
     * @param {number} cst - the constant to subtract from this share.
     * @return {share-object} this party's share of the result.
     */
    this.sub_cst = function(cst){
      if (!(typeof(cst) == "number")) throw "parameter should be a number (-)";

      if(self.ready) // if share is ready
        return new secret_share(self.jiff, true, null, mod((self.value - cst), self.Zp), self.holders, self.threshold, self.Zp);

      var promise = self.promise.then(function() { return mod((self.value - cst), self.Zp); }, self.error);
      return new secret_share(self.jiff, false, promise, undefined, self.holders, self.threshold, self.Zp);
    }

    /**
     * Multiplication by a constant.
     * @method
     * @param {number} cst - the constant to multiply to this share.
     * @return {share-object} this party's share of the result.
     */
    this.mult_cst = function(cst){
      if (!(typeof(cst) == "number")) throw "parameter should be a number (*)";

      if(self.ready) // if share is ready
        return new secret_share(self.jiff, true, null, mod((self.value * cst), self.Zp), self.holders, self.threshold, self.Zp);

      var promise = self.promise.then(function() { return mod((self.value * cst), self.Zp); }, self.error);
      return new secret_share(self.jiff, false, promise, undefined, self.holders, self.threshold, self.Zp);
    };

    /**
     * Addition of two secret shares.
     * @method
     * @param {share-object} o - the share to add to this share.
     * @return {share-object} this party's share of the result.
     */
    this.add = function(o) {
      if (!(o.jiff === self.jiff)) throw "shares do not belong to the same instance (+)";
      if (!(o.Zp === self.Zp)) throw "shares must belong to the same field (+)";
      if (!(o.holders === self.holders)) throw "shares must be held by the same parties (+)";

      // add the two shares when ready locally
      var ready_add = function() {
        return mod(self.value + o.value, self.Zp);
      }

      if(self.ready && o.ready) // both shares are ready
        return new secret_share(self.jiff, true, null, ready_add(), self.holders, max(self.threshold, o.threshold), self.Zp);

      // promise to execute ready_add when both are ready
      var promise = self.pick_promise(o).then(ready_add, self.error);
      return new secret_share(self.jiff, false, promise, undefined, self.holders, max(self.threshold, o.threshold), self.Zp);
    };

    /**
     * Subtraction of two secret shares.
     * @method
     * @param {share-object} o - the share to subtract from this share.
     * @return {share-object} this party's share of the result.
     */
    this.sub = function(o) {
      if (!(o.jiff === self.jiff)) throw "shares do not belong to the same instance (-)";
      if (!(o.Zp === self.Zp)) throw "shares must belong to the same field (-)";
      if (!(o.holders === self.holders)) throw "shares must be held by the same parties (-)";

      // add the two shares when ready locally
      var ready_sub = function() {
        return mod(self.value - o.value, self.Zp);
      }

      if(self.ready && o.ready) // both shares are ready
        return new secret_share(self.jiff, true, null, ready_sub(), self.holders, max(self.threshold, o.threshold), self.Zp);

      // promise to execute ready_add when both are ready
      var promise = self.pick_promise(o).then(ready_sub, self.error);
      return new secret_share(self.jiff, false, promise, undefined, self.holders, max(self.threshold, o.threshold), self.Zp);
    };

    /**
     * Multiplication of two secret shares through Beaver Triplets.
     * @method
     * @param {share-object} o - the share to multiply with.
     * @return {share-object} this party's share of the result.
     */
    this.mult = function(o) {
      if (!(o.jiff === self.jiff)) throw "shares do not belong to the same instance (*)";
      if (!(o.Zp === self.Zp)) throw "shares must belong to the same field (*)";
      if (!(o.holders === self.holders)) throw "shares must be held by the same parties (*)";

      var final_deferred = $.Deferred();
      var final_promise = final_deferred.promise();
      var result = new secret_share(self.jiff, false, final_promise, undefined, self.holders, max(self.threshold, o.threshold), self.Zp);

      // Get shares of triplets.
      var triplet = jiff.triplet(self.holders, self.threshold, self.Zp);

      var a = triplet[0];
      var b = triplet[1];
      var c = triplet[2];

      // d = s - a. e = o - b.
      var d = self.add(a.mult_cst(-1));
      var e = o.add(b.mult_cst(-1));

      // Open d and e.
      // The only communication cost.
      var e_promise = self.jiff.open(e);
      var d_promise = self.jiff.open(d);
      Promise.all([e_promise, d_promise]).then(function(arr) {
        var e_open = arr[0];
        var d_open = arr[1];

        // result_share = d_open * e_open + d_open * b_share + e_open * a_share + c.
        var t1 = d_open * e_open;
        var t2 = b.mult_cst(d_open);
        var t3 = a.mult_cst(e_open);

        // All this happens locally.
        var final_result = t2.add_cst(t1);
        final_result = final_result.add(t3);
        final_result = final_result.add(c);

        if(final_result.ready)
          final_deferred.resolve(final_result.value);
        else // Resolve the deferred when ready.
          final_result.promise.then(function () { final_deferred.resolve(final_result.value); });
      });

      return result;
    };

    /**
     * bitwise-XOR of two secret shares OF BITS.
     * @method
     * @param {share-object} o - the share to XOR with.
     * @return {share-object} this party's share of the result.
     */
    this.xor = function(o) {
      if (!(o.jiff === self.jiff)) throw "shares do not belong to the same instance (^)";
      if (!(o.Zp === self.Zp)) throw "shares must belong to the same field (^)";
      if (!(o.holders === self.holders)) throw "shares must be held by the same parties (^)";

      return self.add(o).sub(self.mult(o).mult_cst(2));
    };

    /**
     * bitwise-XOR with a constant (BOTH BITS).
     * @method
     * @param {number} cst - the constant bit to XOR with (0 or 1).
     * @return {share-object} this party's share of the result.
     */
    this.xor_cst = function(cst) {
      if (!(typeof(cst) == "number")) throw "parameter should be a number (^)";
      return self.add_cst(cst).sub(self.mult_cst(cst).mult_cst(2));
    };

    /**
     * Greater than or equal with another share.
     * @method
     * @param {share-object} o - the other share.
     * @param {number} l - the maximum bit length of the two shares. [optional]
     * @return {share-object} this party's share of the result, the final result is 1 if this >= o, and 0 otherwise.
     */
    this.greater_or_equal = function(o, l) {
      if (!(o.jiff === self.jiff)) throw "shares do not belong to the same instance (>=)";
      if (!(o.Zp === self.Zp)) throw "shares must belong to the same field (>=)";
      if (!(o.holders === self.holders)) throw "shares must be held by the same parties (>=)";

      var final_deferred = $.Deferred();
      var final_promise = final_deferred.promise();
      var result = new secret_share(self.jiff, false, final_promise, undefined, self.holders, max(self.threshold, o.threshold), self.Zp);

      var k = self.jiff.party_count;
      if(l == null) l = Math.floor(bLog(self.Zp, 2) - bLog(1 + Math.pow(2, k)) - 1);
      function preprocess() {
        var assert = Math.pow(2, (l+2)) + Math.pow(2, (l+k));
        if(!(self.Zp > assert)) throw "field too small compared to security and bit length (" + assert + ")";

        var r_bits = [];
        for(var i = 0; i < l + k; i++)
          r_bits[i] = self.jiff.server_generate_and_share({ "bit": true }, self.holders, self.threshold, self.Zp);

        var r_modl = r_bits[0];
        for(var i = 1; i < l; i++)
          r_modl = r_modl.add(r_bits[i].mult_cst(Math.pow(2, i)));

        var r_full = r_modl;
        for(var i = l; i < l + k; i++)
          r_full = r_full.add(r_bits[i].mult_cst(Math.pow(2, i)));

        r_bits = r_bits.slice(0, l);

        var s_bit = self.jiff.server_generate_and_share({ "bit": true }, self.holders, self.threshold, self.Zp);
        var s_sign = s_bit.mult_cst(-2).add_cst(1);

        var mask = self.jiff.server_generate_and_share({ "nonzero": true }, self.holders, self.threshold, self.Zp);

        return { "s_bit": s_bit, "s_sign": s_sign, "mask": mask, "r_full": r_full, "r_modl": r_modl, "r_bits": r_bits };
      }

      function finish_compare(c, s_bit, s_sign, mask, r_modl, r_bits, z) {
        var c_bits = [];
        for(var i = 0; i < l; i++)
          c_bits[i] = (c >> i) & 1;

        var sumXORs = [];
        for(var i = 0; i < l; i++)
          sumXORs[i] = 0;

        sumXORs[l-2] = r_bits[l-1].xor_cst(c_bits[l-1]).add_cst(sumXORs[l-1]);
        for(var i = l-3; i > -1; i--)
          sumXORs[i] = r_bits[i+1].xor_cst(c_bits[i+1]).add(sumXORs[i+1]);

        var E_tilde = [];
        for(var i = 0; i < r_bits.length; i++) {
          var e_i = r_bits[i].add_cst(-1 * c_bits[i]).add(s_sign);
          if(typeof(sumXORs[i]) != "number")
            e_i = e_i.add(sumXORs[i].mult_cst(3));
          else
            e_i = e_i.add_cst(3 * sumXORs[i]);

          E_tilde.push(e_i);
        }

        var product = mask;
        for(var i = 0; i < E_tilde.length; i++)
          product = product.mult(E_tilde[i]);

        product.open(function(product) {
          var non_zero = (product != 0) ? 1 : 0;
          var UF = s_bit.xor_cst(non_zero);
          var c_mod2l = mod(c, Math.pow(2, l));
          var res = UF.mult_cst(Math.pow(2, l)).sub(r_modl.add_cst(-1 * c_mod2l));

          var inverse = extended_gcd(Math.pow(2, l), self.Zp)[0];
          var final_result = z.sub(res).mult_cst(inverse);
          if(final_result.ready)
            final_deferred.resolve(final_result.value);
          else
            final_result.promise.then(function () { final_deferred.resolve(final_result.value); });
        });
      }

      function compare_online(preprocess) {
        var a = self.mult_cst(2).add_cst(1);
        var b = o.mult_cst(2);

        var z = a.sub(b).add_cst(Math.pow(2, l));
        var c = preprocess.r_full.add(z);
        c.open(function(c) { finish_compare(c, preprocess.s_bit, preprocess.s_sign, preprocess.mask, preprocess.r_modl, preprocess.r_bits, z); });
      }

      var pre = preprocess();
      compare_online(pre);

      return result;
    };

    /**
     * Greater than with another share.
     * @method
     * @param {share-object} o - the other share.
     * @param {number} l - the maximum bit length of the two shares. [optional]
     * @return {share-object} this party's share of the result, the final result is 1 if this > o, and 0 otherwise.
     */
    this.greater = function(o, l) {
      if (!(o.jiff === self.jiff)) throw "shares do not belong to the same instance (>)";
      if (!(o.Zp === self.Zp)) throw "shares must belong to the same field (>)";
      if (!(o.holders === self.holders)) throw "shares must be held by the same parties (>)";

      return o.greater_or_equal(self, l).mult_cst(-1).add_cst(1);
    };

    /**
     * Less than or equal with another share.
     * @method
     * @param {share-object} o - the other share.
     * @param {number} l - the maximum bit length of the two shares. [optional]
     * @return {share-object} this party's share of the result, the final result is 1 if this <= o, and 0 otherwise.
     */
    this.less_or_equal = function(o, l) {
      if (!(o.jiff === self.jiff)) throw "shares do not belong to the same instance (<=)";
      if (!(o.Zp === self.Zp)) throw "shares must belong to the same field (<=)";
      if (!(o.holders === self.holders)) throw "shares must be held by the same parties (<=)";

      return o.greater_or_equal(self, l);
    };

    /**
     * Less than with another share.
     * @method
     * @param {share-object} o - the other share.
     * @param {number} l - the maximum bit length of the two shares. [optional]
     * @return {share-object} this party's share of the result, the final result is 1 if this < o, and 0 otherwise.
     */
    this.less = function(o, l) {
      if (!(o.jiff === self.jiff)) throw "shares do not belong to the same instance (<)";
      if (!(o.Zp === self.Zp)) throw "shares must belong to the same field (<)";
      if (!(o.holders === self.holders)) throw "shares must be held by the same parties (<)";

      return self.greater_or_equal(o, l).mult_cst(-1).add_cst(1);
    };

    /**
     * Greater than or equal with a constant.
     * @method
     * @param {number} cst - the constant to compare with.
     * @param {number} l - the maximum bit length of this share. [optional]
     * @return {share-object} this party's share of the result, the final result is 1 if this >= cst, and 0 otherwise.
     */
    this.greater_or_equal_cst = function(cst, l) {
      if (!(typeof(cst) == "number")) throw "parameter should be a number (>=)";

      var share_cst = self.jiff.coerce_to_share(cst, self.holders, self.Zp);
      return self.greater_or_equal(share_cst, l);
    }

    /**
     * Greater than with a constant.
     * @method
     * @param {number} cst - the constant to compare with.
     * @param {number} l - the maximum bit length of this share. [optional]
     * @return {share-object} this party's share of the result, the final result is 1 if this > cst, and 0 otherwise.
     */
    this.greater_cst = function(cst, l) {
      if (!(typeof(cst) == "number")) throw "parameter should be a number (>)";

      var share_cst = self.jiff.coerce_to_share(cst, self.holders, self.Zp);
      return self.greater(share_cst, l);
    };

    /**
     * Less than or equal with a constant.
     * @method
     * @param {number} cst - the constant to compare with.
     * @param {number} l - the maximum bit length of this share. [optional]
     * @return {share-object} this party's share of the result, the final result is 1 if this <= cst, and 0 otherwise.
     */
    this.less_or_equal_cst = function(cst, l) {
      if (!(typeof(cst) == "number")) throw "parameter should be a number (<=)";

      var share_cst = self.jiff.coerce_to_share(cst, self.holders, self.Zp);
      return self.less_or_equal(share_cst, l);
    };

    /**
     * Less than with a constant.
     * @method
     * @param {number} cst - the constant to compare with.
     * @param {number} l - the maximum bit length of this share. [optional]
     * @return {share-object} this party's share of the result, the final result is 1 if this < cst, and 0 otherwise.
     */
    this.less_cst = function(cst, l) {
      if (!(typeof(cst) == "number")) throw "parameter should be a number (<)";

      var share_cst = self.jiff.coerce_to_share(cst, self.holders, self.Zp);
      return self.less(share_cst, l);
    };

    /**
     * Equality test with two shares.
     * @method
     * @param {share-object} o - the share to compare with.
     * @param {number} l - the maximum bit length of the two shares. [optional]
     * @return {share-object} this party's share of the result, the final result is 1 if this = o, and 0 otherwise.
     */
    this.eq = function(o, l) {
      if (!(o.jiff === self.jiff)) throw "shares do not belong to the same instance (==)";
      if (!(o.Zp === self.Zp)) throw "shares must belong to the same field (==)";
      if (!(o.holders === self.holders)) throw "shares must be held by the same parties (==)";

      var one_direction = self.greater_or_equal(o, l);
      var other_direction = o.greater_or_equal(self, l);
      return one_direction.mult(other_direction);
    }

    /**
     * Unequality test with two shares.
     * @method
     * @param {share-object} o - the share to compare with.
     * @param {number} l - the maximum bit length of the two shares. [optional]
     * @return {share-object} this party's share of the result, the final result is 0 if this = o, and 1 otherwise.
     */
    this.neq = function(o, l) {
      if (!(o.jiff === self.jiff)) throw "shares do not belong to the same instance (!=)";
      if (!(o.Zp === self.Zp)) throw "shares must belong to the same field (!=)";
      if (!(o.holders === self.holders)) throw "shares must be held by the same parties (!=)";

      return self.eq(o, l).mult_cst(-1).add_cst(1);
    }

    /**
     * Equality test with a constant.
     * @method
     * @param {number} cst - the constant to compare with.
     * @param {number} l - the maximum bit length of this share. [optional]
     * @return {share-object} this party's share of the result, the final result is 0 if this = o, and 1 otherwise.
     */
    this.eq_cst = function(cst, l) {
      if (!(typeof(cst) == "number")) throw "parameter should be a number (==)";

      var share_cst = self.jiff.coerce_to_share(cst, self.holders, self.Zp);
      return self.eq(share_cst);
    }

    /**
     * Unequality test with a constant.
     * @method
     * @param {number} cst - the constant to compare with.
     * @param {number} l - the maximum bit length of this share. [optional]
     * @return {share-object} this party's share of the result, the final result is 0 if this = o, and 1 otherwise.
     */
    this.neq_cst = function(cst, l) {
      if (!(typeof(cst) == "number")) throw "parameter should be a number (!=)";

      return self.eq_cst(cst, l).mult_cst(-1).add_cst(1);
    }

    // when the promise is resolved, acquire the value of the share and set ready to true
    if(!ready) this.promise.then(this.receive_share, this.error);
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
   * @param {object} options - javascript object with additonal options [optional],
   *                           all parameters are optional, However, for predefined public keys to work all
   *                           of "party_id", "secret_key", and "public_keys" should be provided.
  <pre>
  {
    "triplets_server": "http://hostname:port",
    "numbers_server": "http://hostname:port",
    "keys_server": "http://hostname:port",
    "party_id": number,
    "party_count": number,
    "secret_key": &lt;RSAKey&gt; [(check Cryptico Library)]{@link https://github.com/wwwtyro/cryptico},
    "public_keys": { 1: "ascii-armored-key1", 2: "ascii-armored-key2", ... }
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
     * Stores the computation id. [Do not modify]
     * @member {string} computation_id
     * @memberof jiff.jiff-instance
     * @instance
     */
    jiff.computation_id = computation_id;

    /**
     * Flags whether this instance is connected and the server signaled the start of computation. [Do not modify]
     * @member {boolean} ready
     * @memberof jiff.jiff-instance
     * @instance
     */
    jiff.ready = false;

    // Setup sockets.
    jiff.socket = io(hostname);
    if(options.triplets_server == null || options.triplets_server == hostname)
      jiff.triplets_socket = jiff.socket;
    else
      jiff.triplets_socket = io(options.triplets_server);

    if(options.numbers_server == null || options.numbers_server == hostname)
      jiff.numbers_socket = jiff.socket;
    else
      jiff.numbers_socket = io(options.numbers_server);

    // Parse options
    if(options.onError == null) options.onError = console.log;

    if(options.party_id != null && options.secret_key != null && options.public_keys != null) {
      /**
       * The id of this party. [Do not modify]
       * @member {number} id
       * @memberof jiff.jiff-instance
       * @instance
       */
      jiff.id = options.party_id;

      /**
       * The secret key of this party as an RSAKey object [(check Cryptico Library)]{@link https://github.com/wwwtyro/cryptico}. [Do not modify]
       * @member {RSAKey} secret_key
       * @memberof jiff.jiff-instance
       * @instance
       */
      jiff.secret_key = options.secret_key;

      /**
       * The public key of this party (as ascii-armored string). [Do not modify]
       * @member {string} public_key
       * @memberof jiff.jiff-instance
       * @instance
       */
      jiff.public_key = options.public_keys[jiff.id];

      /**
       * A map from party id to public key. Where key is the party id (number), and
       * value is the public key (ascii-armored string).
       * @member {object} keymap
       * @memberof jiff.jiff-instance
       * @instance
       */
      jiff.keymap = options.public_keys;
    }

    if(options.party_count != null)
      /**
       * Total party count in the computation, parties will take ids between 1 to party_count (inclusive).
       * @member {number} party_count
       * @memberof jiff.jiff-instance
       * @instance
       */
      jiff.party_count = options.party_count;

    /**
     * Total server count in the computation, servers will take ids between "s1" to "s<server_count>" (inclusive).
     * @member {number} server_count
     * @memberof jiff.jiff-instance
     * @instance
     */
    jiff.server_count = 1;

    // Send the computation id to the server to receive proper
    // identification
    jiff.socket.emit("computation_id", JSON.stringify({ "computation_id": computation_id, "party_id": jiff.id, "party_count": jiff.party_count }));

    /**
     * Share a secret input.
     * @method share
     * @memberof jiff.jiff-instance
     * @instance
     * @param {number} secret - the number to share (this party's input).
     * @param {number} threshold - the minimimum number of parties needed to reconstruct the secret, defaults to all the recievers [optional].
     * @param {array} receivers_list - array of party ids to share with, by default, this includes all parties [optional].
     * @param {array} senders_list - array of party ids to receive from, by default, this includes all parties [optional].
     * @param {number} Zp - the modulos (if null global gZp will be used) [optional].
     * @returns {object} a map (of size equal to the number of parties)
     *          where the key is the party id (from 1 to n)
     *          and the value is the share object that wraps
     *          the value sent from that party (the internal value maybe deferred).
     */
    jiff.share = function(secret, threshold, receivers_list, senders_list, Zp) { return jiff_share(jiff, secret, threshold, receivers_list, senders_list, Zp); };

    /**
     * Open a secret share to reconstruct secret.
     * @method open
     * @memberof jiff.jiff-instance
     * @instance
     * @param {share-object} share - this party's share of the secret to reconstruct.
     * @param {array} parties - an array with party ids (1 to n) of receiving parties [optional].
     * @returns {promise} a (JQuery) promise to the open value of the secret.
     * @throws error if share does not belong to the passed jiff instance.
     */
    jiff.open = function(share, parties) { return jiff_open(jiff, share, parties); };

    /**
     * Opens a bunch of secret shares.
     * @method open_all
     * @memberof jiff.jiff-instance
     * @instance
     * @param {array<share-object>} shares - an array containing this party's shares of the secrets to reconstruct.
     * @param {array} parties - an array with party ids (1 to n) of receiving parties [optional].
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
     * @param {number} threshold - the minimimum number of parties needed to reconstruct the secret, defaults to all the senders [optional].
     * @returns {promise} a (JQuery) promise to the open value of the secret.
     */
    jiff.receive_open = function(parties, threshold) { 
      return jiff_open(jiff, 
        new secret_share(jiff, true, null, null, parties, (threshold == null ? parties.length : threshold), gZp),
        [ jiff.id ]); 
    };

    /**
     * Creates 3 shares, a share for every one of three numbers from a beaver triplet.
     * The server generates and sends the triplets on demand.
     * @method triplet
     * @memberof jiff.jiff-instance
     * @instance
     * @param {array} receivers_list - array of party ids that want to receive the triplet shares, by default, this includes all parties [optional].
     * @param {number} threshold - the minimimum number of parties needed to reconstruct the triplet.
     * @param {number} Zp - the modulos (if null then global Zp is used by default) [optional].
     * @returns an array of 3 share-objects [share_a, share_b, share_c] such that a * b = c.
     */
    jiff.triplet = function(receivers_list, threshold, Zp) { return jiff_triplet(jiff, receivers_list, threshold, Zp); };

    /**
     * Creates shares of an unknown random number. Every party comes up with its own random number and shares it.
     * Then every party combines all the received shares to construct one share of the random unknown number.
     * @method generate_and_share_random
     * @memberof jiff.jiff-instance
     * @instance
     * @param {number} threshold - the minimimum number of parties needed to reconstruct the secret, defaults to all the recievers [optional].
     * @param {array} receivers_list - array of party ids to share with, by default, this includes all parties [optional].
     * @param {array} senders_list - array of party ids to receive from, by default, this includes all parties [optional].
     * @param {number} Zp - the modulos (if null then global Zp is used by default) [optional].
     * @returns {share-object} a secret share of the random number, null if this party is not a receiver.
     */
    jiff.generate_and_share_random = function(threshold, receivers_list, senders_list, Zp) { 
      return jiff_share_all_number(jiff, Math.floor(Math.random() * Zp), threshold, receivers_list, senders_list, Zp); 
    };

    /**
     * Creates shares of 0, such that no party knows the other parties' shares.
     * Every party secret shares 0, then every party sums all the shares they received, resulting
     * in a new share of 0 for every party.
     * @method generate_and_share_zero
     * @memberof jiff.jiff-instance
     * @instance
     * @param {number} threshold - the minimimum number of parties needed to reconstruct the secret, defaults to all the recievers [optional].
     * @param {array} receivers_list - array of party ids to share with, by default, this includes all parties [optional].
     * @param {array} senders_list - array of party ids to receive from, by default, this includes all parties [optional].
     * @param {number} Zp - the modulos (if null then global Zp is used by default) [optional].
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
     * @param {array} receivers_list - array of party ids that want to receive the triplet shares, by default, this includes all parties [optional].
     * @param {number} threshold - the minimimum number of parties needed to reconstruct the triplet.     
     * @param {number} Zp - the modulos (if null then global Zp is used by default) [optional].
     * @returns {share-object} a secret share of zero/random bit/random number/random non-zero number.
     */
    jiff.server_generate_and_share = function(options, receivers_list, threshold, Zp) { return jiff_server_share_number(jiff, options, receivers_list, threshold, Zp) };

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
     * @param {array} holders - array of party ids that will hold the shares, by default, this includes all parties [optional].
     * @param {number} Zp - the modulos [optional].
     * @returns {share-object} a share object containing the given number.
     *
     */
    jiff.coerce_to_share = function(number, holders, Zp) { return jiff_coerce_to_share(jiff, number, holders, Zp); };
    
    /**
     * Disconnects from the computation.
     * Allows the client program to exit.
     */
    jiff.disconnect = function() { jiff.socket.disconnect(); jiff.triplets_socket.disconnect(); jiff.numbers_socket.disconnect(); };

    // Store the id when server sends it back
    jiff.socket.on('init', function(msg) {
      msg = JSON.parse(msg);
      if(jiff.id == null)
        jiff.id = msg.party_id;

      if(jiff.party_count == null)
        jiff.party_count = msg.party_count;

      if(jiff.public_key == null) {
        jiff.secret_key = cryptico.generateRSAKey(random_string(passphrase_size), RSA_bits);
        jiff.public_key = cryptico.publicKeyString(jiff.secret_key);
      }

      jiff.socket.emit("public_key", jiff.public_key);
    });

    jiff.socket.on('public_key', function(msg) {
      if(jiff.keymap == null)
        jiff.keymap = JSON.parse(msg);

      jiff.ready = true;
      if(options.onConnect != null)
        options.onConnect();
    });

    // Store sharing and shares counter which keeps track of the count of
    // sharing operations (share and open) and the total number of shares
    // respectively (used to get a unique id for each share operation and
    // share object).
    jiff.share_op_count = {};
    jiff.open_op_count = {};
    jiff.triplet_op_count = {};
    jiff.number_op_count = {};
    jiff.share_obj_count = 0;

    // Store a map from a sharing id (which share operation) to the
    // corresponding deferred and shares array.
    jiff.shares = {}; // Stores receive shares for open purposes.
    jiff.deferreds = {}; // Stores deferred that are resolved when required messages arrive.

    // Setup receiving matching shares
    jiff.socket.on('share', function(msg) {
      // parse message
      var json_msg = JSON.parse(msg);
      var sender_id = json_msg["party_id"];
      var op_id = json_msg["op_id"];
      var share = json_msg["share"];

      receive_share(jiff, sender_id, share, op_id);
    });

    jiff.socket.on('open', function(msg) {
      // parse message
      var json_msg = JSON.parse(msg);

      var sender_id = json_msg["party_id"];
      var op_id = json_msg["op_id"];
      var share = json_msg["share"];
      var Zp = json_msg["Zp"];

      receive_open(jiff, sender_id, share, op_id, Zp);
    });

    jiff.triplets_socket.on('triplet', function(msg) {
      // decrypt and verify message signature
      msg = decrypt_and_sign(msg, jiff.secret_key, jiff.keymap["s1"], true);

      // parse message
      var json_msg = JSON.parse(msg);
      var triplet = json_msg["triplet"];
      var triplet_id = json_msg["triplet_id"];

      receive_triplet(jiff, triplet_id, triplet);
    });

    jiff.numbers_socket.on('number', function(msg) {
      // decrypt and verify message signature
      msg = decrypt_and_sign(msg, jiff.secret_key, jiff.keymap["s1"], true);

      // parse message
      var json_msg = JSON.parse(msg);
      var number = json_msg["number"];
      var number_id = json_msg["number_id"];

      receive_server_share_number(jiff, number_id, number);
    });

    jiff.socket.on('error', function(msg) {
      jiff.socket = null;
      jiff.ready = false;

      if(options.onError != null)
        options.onError(msg);

      throw msg;
    });

    return jiff;
  }

  // Exported API
  if(node) { // For nodejs
    exports.gZp = gZp;
    exports.RSA_bits = RSA_bits;
    exports.passphrase_size = passphrase_size;

    exports.make_jiff = make_jiff; // In case nodejs is used as a client (not performing message routing).

    exports.mod = mod;
    exports.random_string = random_string;
    exports.bLog = bLog;
    exports.get_party_number = get_party_number;
    exports.encrypt_and_sign = encrypt_and_sign;
    exports.decrypt_and_sign = decrypt_and_sign;

    exports.jiff_share = jiff_share;
    exports.jiff_compute_shares = jiff_compute_shares;
    exports.receive_share = receive_share;
    exports.jiff_open = jiff_open;
    exports.jiff_open_all = jiff_open_all;
    exports.jiff_broadcast = jiff_broadcast;
    exports.receive_open = receive_open;
    exports.jiff_lagrange = jiff_lagrange;
    exports.jiff_share_all_number = jiff_share_all_number;
    exports.jiff_coerce_to_share = jiff_coerce_to_share;
    exports.secret_share = secret_share;

    exports.jiff_triplet = jiff_triplet;
    exports.receive_triplet = receive_triplet;
    exports.jiff_server_share_number = jiff_server_share_number;
    exports.receive_server_share_number = receive_server_share_number;
  }
  else { // For client
    exports.make_jiff = make_jiff;
    exports.mod = mod;
  }
}((typeof exports == 'undefined' ? this.jiff = {} : exports), typeof exports != 'undefined'));
