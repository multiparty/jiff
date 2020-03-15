module.exports = {
  /**
   * Retrieves preprocessed rejection_sampling bits or performs the rejection sampling on the fly if crypto_provider is enabled
   * @function rejection_sampling
   * @ignore
   * @param {module:jiff-client~JIFFClient} jiff - the jiff instance
   * @param {number} [lower_bound=0] - the lower bound, included (can be a bigNumber if using bigNumber extension)
   * @param {number} [upper_bound=jiff-instance.Zp] - the upper bound, excluded (can be a bigNumber if using bigNumber extension)
   * @param {number} [threshold=parties.length] - the threshold of the resulting shares after sampling
   * @param {Array} [parties=all_parties] - array of party ids that want to receive (or compute if needed) the sampling shares, by default, this includes all parties
   * @param {number} [Zp=jiff-instance.Zp] - the mod (if null then the default Zp for the instance is used)
   * @param {string} [op_id=auto_gen()] - the operation id which is used to identify this operation.
   *                         This id must be unique, and must be passed by all parties to the same instruction, to
   *                         ensure that corresponding instructions across different parties are matched correctly
   * @returns {SecretShare[]} an array of secret shares, each representing a bit from the sampled value (from least to most significant)
   */
  rejection_sampling: function (jiff, lower_bound, upper_bound, threshold, parties, Zp, op_id) {
    // defaults
    if (parties == null) {
      parties = [];
      for (var i = 1; i <= jiff.party_count; i++) {
        parties.push(i);
      }
    } else {
      jiff.helpers.sort_ids(parties);
    }

    if (op_id == null) {
      op_id = jiff.counters.gen_op_id('rejection_sampling', parties);
    }

    // try to get preprocessed samples
    var result = jiff.get_preprocessing(op_id);
    if (result != null && result.ondemand !== true) {
      return result;
    }

    // Not ready, either preprocess it on demand, or use crypto provider!
    lower_bound = lower_bound ? lower_bound : 0;
    upper_bound = upper_bound ? upper_bound : jiff.Zp;
    if (threshold == null) {
      threshold = parties.length;
    }
    if (Zp == null) {
      Zp = jiff.Zp;
    }

    var finalLength = jiff.helpers.ceil(jiff.helpers.bLog(upper_bound, 2));
    finalLength = parseInt(finalLength.toString(), 10);
    finalLength = Math.max(finalLength, 1); // special case: when upper_bound is 1!

    var many_shares = jiff.utils.many_secret_shares(finalLength, parties, threshold, Zp);
    var final_deferreds = many_shares.deferreds;

    // Crypto provider
    if (result == null) {
      var promise = jiff.from_crypto_provider('numbers', parties, threshold, Zp, op_id, {
        max: upper_bound,
        min: lower_bound,
        bitLength: finalLength,
        count: 1
      });
      promise.then(function (result) {
        jiff.utils.resolve_many_secrets(final_deferreds, result['shares']);
      });
    } else { // preprocess on demand
      delete jiff.preprocessing_table[op_id];
      jiff.preprocessing('rejection_sampling', 1, null, threshold, parties, parties, Zp, [op_id], {
        lower_bound: lower_bound,
        upper_bound: upper_bound
      });
      jiff.executePreprocessing(function () {
        jiff.utils.resolve_many_secrets(final_deferreds, jiff.get_preprocessing(op_id));
      });
    }

    return many_shares.shares;
  },

  /**
   * Creates a secret share of the number represented by the given array of secret shared bits.
   * Requires no communication, only local operations
   * @function bit_composition
   * @ignore
   * @param {module:jiff-client~JIFFClient#SecretShare[]} bits - an array of the secret shares of bits, starting from least to most significant bits.
   * @returns {module:jiff-client~JIFFClient#SecretShare} a secret share of the number represented by bits.
   */
  bit_composition: function (bits) {
    var result = bits[0];
    var pow = 1;
    for (var i = 1; i < bits.length; i++) {
      pow = pow * 2;
      result = result.isadd(bits[i].icmult(pow));
    }
    return result;
  }
};