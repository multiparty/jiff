/**
 * @namespace jiff_fixedpoint
 * @version 1.0
 */
(function (exports, node) {
  /**
   * The name of this extension: 'multipleshares'
   * @type {string}
   * @memberOf jiff_multipleshares
   */
  exports.name = 'multipleshares';

  function createMultipleSharesSecretShare(jiff, share, share_helpers) {
    share.legacy = {};
    var internals = ['cadd', 'csub', 'cmult',
      'sadd', 'ssub', 'smult', 'smult_bgw',
      'cdivfac', 'cdiv', 'sdiv', 'smod',
      'cxor_bit', 'sxor_bit', 'cor_bit', 'sor_bit', 'not',
      'slt', 'slteq', 'sgt', 'sgteq', 'seq', 'sneq',
      'clt', 'clteq', 'cgt', 'cgteq', 'ceq', 'cneq',
      'lt_halfprime', 'if_else' ];
    for (var i = 0; i < internals.length; i++) {
      var key = internals[i];
      share.legacy[key] = share[key];
    }
    return share;
  }

  function make_jiff(base_instance, options) {
    var jiff = base_instance;

    // Parse options
    if (options == null) {
      options = {};
    }

    old_open = jiff.open;
    jiff.open = function(share, parties, op_ids) {
      console.log(share, typeof(share.value));
      if (typeof(share.value) === 'number') {
        old_open(share, parties, op_ids);
      } else {
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

        if (typeof (op_ids) === 'string' || typeof (op_ids) === 'number') {
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
          var numberofshares = 0;
          var final_deferred = new Deferred(); // will be resolved when the final value is reconstructed
          var final_promise = final_deferred.promise;
          for (i = 0; i < share.holders.length; i++) {
            var p_id = share.holders[i];

            // Setup a deferred for receiving a share from party p_id
            if (jiff.deferreds[op_ids[jiff.id]] == null) {
              jiff.deferreds[op_ids[jiff.id]] = {};
            }
            if (jiff.deferreds[op_ids[jiff.id]][p_id] == null) {
              jiff.deferreds[op_ids[jiff.id]][p_id] = new Deferred();
            }

            // Clean up deferred when fulfilled
            var promise = jiff.deferreds[op_ids[jiff.id]][p_id].promise;

            // destroy deferred when done
            (function (promise, p_id) { // p_id is modified in a for loop, must do this to avoid scoping issues.
              promise.then(function (received_share) {
                jiff.deferreds[op_ids[jiff.id]][p_id] = null;
                shares.push(received_share);
                numberofshares += received_share['share'].length;

                // Too few shares, nothing to do.
                if (numberofshares < share.threshold) {
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
    }

    function receive_open(jiff, json_msg) {
      // Decrypt share
      if (json_msg['party_id'] !== jiff.id) {
        for (var i = 0; i < json_msg['share'].length; i++) {
          json_msg['share'][i] = jiff.hooks.decryptSign(jiff, json_msg['share'][i], jiff.secret_key, jiff.keymap[json_msg['party_id']]);
        }
        json_msg = jiff.execute_array_hooks('afterOperation', [jiff, 'open', json_msg], 2);
      }

      var sender_id = json_msg['party_id'];
      var op_id = json_msg['op_id'];
      var share = json_msg['share'];
      var Zp = json_msg['Zp'];

      // call hook
      share = jiff.execute_array_hooks('receiveOpen', [jiff, sender_id, share, Zp], 2);

      // Resolve the deferred.
      if (jiff.deferreds[op_id] == null) {
        jiff.deferreds[op_id] = {};
      }
      if (jiff.deferreds[op_id][sender_id] == null) {
        jiff.deferreds[op_id][sender_id] = new Deferred();
      }

      jiff.deferreds[op_id][sender_id].resolve({value: share, sender_id: sender_id, Zp: Zp});
    }

    function jiff_broadcast(jiff, share, parties, op_ids) {
      for (var index = 0; index < parties.length; index++) {
        var i = parties[index]; // Party id
        if (i === jiff.id) {
          receive_open(jiff, {party_id: i, share: share.value, op_id: op_ids[i], Zp: share.Zp});
          continue;
        }

        // encrypt, sign and send
        var msg = {party_id: i, share: share.value, op_id: op_ids[i], Zp: share.Zp};
        msg = jiff.execute_array_hooks('beforeOperation', [jiff, 'open', msg], 2);

        for (var j = 0; j < msg['share'].length; j++) {
          msg['share'][j] = jiff.hooks.encryptSign(jiff, msg['share'][j].toString(), jiff.keymap[msg['party_id']], jiff.secret_key);
        }
        jiff.socket.safe_emit('open', JSON.stringify(msg));
      }
    }

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

    var old_share = jiff.share;
    jiff.share = function (secret, threshold, receivers_list, senders_list, Zp, share_id, receivers_ratios) {
      receivers_ratios = {};
      for (var i = 1; i <= jiff.party_count; i++) {
        receivers_ratios[i] = 2;
      }
      if (receivers_ratios == null){
        var result = old_share(secret, threshold, receivers_list, senders_list, Zp, share_id);
        return result;
      }
      else{
        var i, j, p_id, p_ratio;

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
          var shares = jiff_compute_shares(jiff, secret, receivers_list, threshold, Zp, receivers_ratios);

          // Call hook
          shares = jiff.execute_array_hooks('afterComputeShare', [jiff, shares, threshold, receivers_list, senders_list, Zp], 1);

          // send shares
          for (i = 0; i < receivers_list.length; i++) {
            p_id = receivers_list[i];
            if (p_id === jiff.id) {
              continue;
            }

            // send encrypted and signed shares_id[p_id] to party p_id
            var msg = { party_id: p_id, share: shares[p_id], op_id: share_id, p_ratio: p_ratio};
            msg = jiff.execute_array_hooks('beforeOperation', [jiff, 'share', msg], 2);
            p_ratio = (p_id in receivers_ratios) ? receivers_ratios[p_id] : 1;
            for (j = 0; j < p_ratio; j++) {
              msg['share'][j] = jiff.hooks.encryptSign(jiff, msg['share'][j].toString(10), jiff.keymap[msg['party_id']], jiff.secret_key);
            }
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
            p_ratio = (p_id in receivers_ratios) ? receivers_ratios[p_ratio] : 1;
            if (p_id === jiff.id) {
              var my_share = jiff.execute_array_hooks('receiveShare', [jiff, p_id, shares[p_id]], 2);
              result[p_id] = jiff.secret_share(jiff, true, null, my_share, receivers_list, threshold, Zp);
              continue; // Keep party's own share
            }

            // check if a deferred is set up (maybe the message was previously received)
            if (jiff.deferreds[share_id][p_id] == null) {
              // not ready, setup a deferred
              jiff.deferreds[share_id][p_id] = new Deferred();
            }

            var promise = jiff.deferreds[share_id][p_id].promise;

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
    }

    function jiff_compute_shares(jiff, secret, parties_list, threshold, Zp, parties_ratios) {
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
        var p_ratio = p_id in parties_ratios ? parties_ratios[p_id] : 1;
        shares[p_id] = [];
        for (var share_num = 0; share_num < p_ratio; share_num++) {
          shares[p_id][share_num] = polynomial[0];
          var power = jiff.helpers.get_party_number(p_id, share_num);

          for (var j = 1; j < polynomial.length; j++) {
            var tmp = jiff.helpers.mod((polynomial[j] * power), Zp);
            shares[p_id][share_num] = jiff.helpers.mod((shares[p_id][share_num] + tmp), Zp);
            power = jiff.helpers.mod(power * jiff.helpers.get_party_number(p_id, share_num), Zp);
          }
        }
      }
      return shares;
    }

    function receive_share(jiff, json_msg) {
      // Decrypt share
      var num_shares = json_msg['share'].length;
      for (var i = 0; i < num_shares; i++) {
        json_msg['share'][i] = jiff.hooks.decryptSign(jiff, json_msg['share'][i], jiff.secret_key, jiff.keymap[json_msg['party_id']]);
      }

      // change afterOperation hook to handle array of shares
      jiff.hooks.afterOperation = (function (jiff, label, msg) {
        if (label === 'share' || label === 'open') {
          for (var i = 0; i < msg['share'].length; i++) {
            msg['share'][i] = parseInt(msg['share'][i], 10);
          }
        }
        return msg;
      });
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
        jiff.deferreds[op_id][sender_id] = new Deferred();
      }

      // Deferred is already setup, resolve it.
      jiff.deferreds[op_id][sender_id].resolve(share);
    }

    function Deferred() {
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
    }

    /* HOOKS */
    jiff.hooks.createSecretShare.push(createMultipleSharesSecretShare);

    return jiff;
  }

  // Expose API
  exports.make_jiff = make_jiff;

}((typeof exports === 'undefined' ? this.jiff_multipleshares = {} : exports), typeof exports !== 'undefined'));