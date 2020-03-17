/**
 * Share the given share to all the parties in the jiff instance.
 * @function jiff_broadcast
 * @ignore
 * @param {module:jiff-client~JIFFClient} jiff - the jiff client instance.
 * @param {module:jiff-client~JIFFClient#SecretShare} share - the share.
 * @param {Array} parties - the parties to broadcast the share to.
 * @param {number|string} op_id - a unique operation id, used to tag outgoing messages.
 *
 */
var jiff_broadcast = function (jiff, share, parties, op_id) {
  for (var index = 0; index < parties.length; index++) {
    var i = parties[index]; // Party id
    if (i === jiff.id) {
      jiff.handlers.receive_open({ party_id: i, share: share.value, op_id: op_id, Zp: share.Zp });
      continue;
    }

    // encrypt, sign and send
    var msg = {party_id: i, share: share.value, op_id: op_id, Zp: share.Zp};
    msg = jiff.hooks.execute_array_hooks('beforeOperation', [jiff, 'open', msg], 2);

    msg['share'] = jiff.hooks.encryptSign(jiff, msg['share'].toString(), jiff.keymap[msg['party_id']], jiff.secret_key);
    jiff.socket.safe_emit('open', JSON.stringify(msg));
  }
};

module.exports = {
  /**
   * Open up the given share to the participating parties.
   * @function jiff_open
   * @ignore
   * @param {module:jiff-client~JIFFClient} jiff - the jiff client instance.
   * @param {module:jiff-client~JIFFClient#SecretShare} share - the share of the secret to open that belongs to this party
   * @param {Array<number|string>} [parties=all_parties] - an array with party ids of receiving parties
   * @param {string|number} [op_id=auto_gen()] - the operation id to be used to tag outgoing messages
   * @returns {?promise} a (JQuery) promise to the open value of the secret, or null if the calling party is not a receiving party
   *
   */
  jiff_open: function (jiff, share, parties, op_id) {
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
      jiff.helpers.sort_ids(parties);
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
      share = jiff.hooks.execute_array_hooks('beforeOpen', [jiff, share, parties], 1);

      // refresh/reshare, so that the original share remains secret, instead
      // a new share is sent/open without changing the actual value.
      share = share.refresh(op_id + ':refresh');

      // The given share has been computed, broadcast it to all parties
      jiff.counters.pending_opens++;
      share.wThen(function () {
        jiff.counters.pending_opens--;
        jiff_broadcast(jiff, share, parties, op_id);
      }, share.error);
    }

    // Party is a receiver
    if (parties.indexOf(jiff.id) > -1) {
      var final_deferred = new jiff.helpers.Deferred(); // will be resolved when the final value is reconstructed
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
        recons_secret = jiff.hooks.execute_array_hooks('afterReconstructShare', [jiff, recons_secret], 1);
        return recons_secret;
      });
    }

    return null;
  },
  /**
   * Uses Lagrange polynomials to interpolate the polynomial
   * described by the given shares (points)
   * @function jiff_lagrange
   * @ignore
   * @param {module:jiff-client~JIFFClient} jiff - the jiff client instance
   * @param {Array} shares - an array of objects representing shares to reconstruct, every object has 3 attributes: value, sender_id, Zp
   * @returns {number} the value of the polynomial at x=0 (the secret value)
   *
   */
  jiff_lagrange: function (jiff, shares) {
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
};