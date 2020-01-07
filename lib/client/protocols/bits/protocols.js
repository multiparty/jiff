// private
var __rejection_sampling = function (jiff, lower_bound, upper_bound, compute_list, Zp, params, protocols) {
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
  var many_shares = jiff.utils.many_secret_shares(finalLength, compute_list, params.compute_threshold, Zp);
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
        return jiff.utils.resolve_many_secrets(deferreds, bits_add);
      } else if (cmp === false) {
        return resample(reject_count+1);
      }

      var promise = jiff.internal_open(cmp, compute_list, params.op_id + ':open:' + reject_count);
      promise.then(function (cmp) {
        if (cmp.toString() === '1') {
          return jiff.utils.resolve_many_secrets(deferreds, bits_add);
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

module.exports = {
  /**
   * Wrapper for when doing rejection sampling during pre processing.
   * @function rejection_sampling
   * @ignore
   * @param {module:jiff-client~JIFFClient} jiff - the jiff client instance
   * @param {number} [threshold=receivers_list.length] - the threshold of the resulting shares after sampling
   * @param {Array} [receivers_list=all_parties] - array of party ids that want to receive the sampling shares, by default, this includes all parties
   * @param {Array} [compute_list=all_parties] - array of party ids that will perform this protocol, by default, this includes all parties
   * @param {number} [Zp=jiff-instance.Zp] - the mod (if null then the default Zp for the instance is used)
   * @param {string} [op_id=auto_gen()] - the operation id which is used to identify this operation.
   *                         This id must be unique, and must be passed by all parties to the same instruction, to
   *                         ensure that corresponding instructions across different parties are matched correctly
   * @param {object} [params={}] - an object containing extra parameters passed by the user
   *                               Expects:
   *                               - an optional number compute_threshold parameter, which specifies threshold used
   *                               during the protocol execution. By default, this is (|compute_list|+1)/2
   *                               - optional 'lower_bound' and 'upper_bound' numeric parameters, default to 0 and Zp respectively
   *                               - op_id, the base op_id to tag operations inside this protocol with, defaults to auto generated
   * @param {object} [protocols=defaults] - the protocols to use for preprocessing, any protocol(s) not provided will be replaced with defaults
   * @returns {Object} an object containing keys: 'share', and 'promise'. The promise is resolved when the rejection sampling is completed.
   *                   The object is consumed by <jiff_instance>.preprocessing:
   *                        - 'share' attribute contains the resulting array of secret shared bits representing the sampled value, and is stored in the preprocessing table internally
   *                        - The promise is consumed and a new promise is returned by <jiff_instance>.preprocessing that is resolved after this returned promise (and all other promise generated by that .preprocessing call) are resolved
   */
  rejection_sampling: function (jiff, threshold, receivers_list, compute_list, Zp, params, protocols) {
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
      result = __rejection_sampling(jiff, lower_bound, upper_bound, compute_list, Zp, params, protocols);
      for (var j = 0; j < result.length; j++) {
        promises.push(result[j].value);
      }
    }

    // fix threshold
    for (var i = 0; i < result.length; i++) {
      result[i] = jiff.reshare(result[i], threshold, receivers_list, compute_list, Zp, op_id + ':reshare:' + i);
      if (receivers_list.indexOf(jiff.id) > -1) {
        promises[i] = result[i].value;
      }
    }

    // return output
    if (receivers_list.indexOf(jiff.id) === -1) {
      result = null;
    }

    return {share: result, promise: Promise.all(promises)};
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