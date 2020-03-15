var sample = function (jiff, range, compute_list, Zp, params, protocols, reject_count) {
  // Transform sampling range into bit size
  var bitLength = jiff.helpers.ceil(jiff.helpers.bLog(range, 2));
  bitLength = parseInt(bitLength.toString(), 10);

  var paramsCopy = Object.assign({}, params);
  paramsCopy['count'] = bitLength;
  paramsCopy['op_id'] = params.op_id + ':sampling:' + reject_count;
  return protocols.generate_random_bits(params.compute_threshold, compute_list, compute_list, Zp, paramsCopy, protocols).share;
};

var one_round_sampling = function (jiff, lower_bound, upper_bound, compute_list, Zp, params, protocols, finalLength, reject_count) {
  // Figure out sampling range
  var range;
  if (upper_bound.isBigNumber === true) {
    range = upper_bound.minus(lower_bound);
  } else {
    range = upper_bound - lower_bound;
  }

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
    return {share: resultOne, promise: true};
  }

  // Rejection protocol
  var bits = sample(jiff, range, compute_list, Zp, params, protocols, reject_count);
  var cmp = jiff.protocols.bits.clt(bits, range, params.output_op_id + ':bits.clt:' + reject_count);
  var bits_add = jiff.protocols.bits.cadd(bits, lower_bound, params.output_op_id + ':bits.cadd:' + reject_count);

  if (cmp === true) {
    return {share: bits_add, promise: true};
  } else if (cmp === false) { // need to resample
    return {share: bits_add, promise: false};
  }

  var promise = jiff.internal_open(cmp, compute_list, params.output_op_id + ':open:' + reject_count);
  return {share: bits_add, promise: promise.then(
    function (cmp) {
      return cmp.toString() === '1';
    }
  )};
};

var computeParty = function (jiff, lower_bound, upper_bound, threshold, receivers_list, compute_list, Zp, params, protocols, op_id, finalLength, reject_count) {
  var result = one_round_sampling(jiff, lower_bound, upper_bound, compute_list, Zp, params, protocols, finalLength, reject_count);

  // Case 1: we know whether sampling succeeded or not
  if (result.promise === true) {
    return reshareResult(jiff, upper_bound, threshold, receivers_list, compute_list, Zp, op_id, finalLength, result.share);
  }
  if (result.promise === false) {
    return {share: 'RETRY', promise: jiff.utils.all_promises(result.share)};
  }

  // Case 2: we only have a promise to whether the sampling succeeded or not
  var many_shares = jiff.utils.many_secret_shares(finalLength, compute_list, threshold, Zp);
  var final_deferreds = many_shares.deferreds;

  result.promise.then(function (promiseVal) {
    // RETRY and PLACEHOLDER shares are cleaned up later in the preprocessing pipeline
    if (promiseVal === false) {
      for (var i = 0; i < final_deferreds.length; i++) {
        final_deferreds[i].resolve('RETRY');
      }
      return;
    }

    // Need to make sure party only executes the reshare operation if sampling succeeds
    var reshared = reshareResult(jiff, upper_bound, threshold, receivers_list, compute_list, Zp, op_id, finalLength, result.share);

    if (receivers_list.indexOf(jiff.id) > -1) {
      jiff.utils.resolve_many_secrets(final_deferreds, reshared.share);
    } else {
      for (i = 0; i < final_deferreds.length; i++) {
        final_deferreds[i].resolve('PLACEHOLDER');
      }
    }
  });

  return {share: many_shares.shares, promise: jiff.utils.all_promises(many_shares.shares)};
};

var reshareResult = function (jiff, upper_bound, threshold, receivers_list, compute_list, Zp, op_id, finalLength, shares) {
  // fix threshold and parties
  var promises = [];
  for (var i = 0; i < finalLength; i++) {
    if (compute_list.indexOf(jiff.id) > -1) {
      promises[i] = shares[i].value;
    }
    shares[i] = jiff.reshare(shares[i], threshold, receivers_list, compute_list, Zp, op_id + ':reshare:' + i);
    if (receivers_list.indexOf(jiff.id) > -1) {
      promises[i] = shares[i].value;
    }
  }

  // return output
  if (receivers_list.indexOf(jiff.id) === -1) {
    shares = null;
  }

  // handle rejection case
  return {share: shares, promise: Promise.all(promises)};
};

/**
 * Wrapper for when doing rejection sampling during pre processing
 *
 * Do not use this function directly, especially during online computation time, use jiffClient.protocols.bits.rejection_sampling instead
 *
 * @function sampling
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
 *                               - compute_threshold, an optional number compute_threshold parameter, which specifies threshold used
 *                               during the protocol execution. By default, this is (|compute_list|+1)/2
 *                               - optional 'lower_bound' and 'upper_bound', numeric parameters, default to 0 and Zp respectively
 *                               - op_id, the base op_id to tag operations inside this protocol with, defaults to auto generated
 *                               - output_op_id, the tag id for the output result
 *                               - retry_count, how many times rejection sampling have been retried!
 * @param {object} [protocols=defaults] - the protocols to use for preprocessing, any protocol(s) not provided will be replaced with defaults
 * @returns {Object} an object containing keys: 'share', and 'promise'. The promise is resolved when the rejection sampling is completed.
 *                   The object is consumed by <jiff_instance>.preprocessing:
 *                        - 'share' attribute contains the resulting array of secret shared bits representing the sampled value, and is stored in the preprocessing table internally
 *                        - The promise is consumed and a new promise is returned by <jiff_instance>.preprocessing that is resolved after this returned promise (and all other promise generated by that .preprocessing call) are resolved
 */
module.exports = function (jiff, threshold, receivers_list, compute_list, Zp, params, protocols) {
  // Internal version: set parameters (e.g. receivers_list) do not need defaults
  // defaults (for internal preprocessing)
  var lower_bound = params.lower_bound != null ? params.lower_bound : 0;
  var upper_bound = params.upper_bound != null ? params.upper_bound : Zp;
  if (params.compute_threshold == null) { // honest majority BGW
    params.compute_threshold = Math.floor((compute_list.length + 1) / 2);
  }

  // Figure out final bit size (after adding back lower)
  var finalLength = jiff.helpers.ceil(jiff.helpers.bLog(upper_bound, 2));
  finalLength = parseInt(finalLength.toString(), 10);
  finalLength = Math.max(finalLength, 1); // special case: when upper_bound is 1!

  if (params.op_id == null && params.output_op_id == null) {
    params.op_id = jiff.counters.gen_op_id2('rejection_sampling', receivers_list, compute_list);
  } else if (params.op_id == null) {
    params.op_id = 'preprocessing:' + params.output_op_id + ':' + compute_list.join(',');
  }
  var op_id = params.op_id;

  // Rejection count
  var reject_count = params.reject_count || 0;

  if (compute_list.indexOf(jiff.id) === -1) {
    return reshareResult(jiff, upper_bound, threshold, receivers_list, compute_list, Zp, op_id, finalLength, [])
  }

  return computeParty(jiff, lower_bound, upper_bound, threshold, receivers_list, compute_list, Zp, params, protocols, op_id, finalLength, reject_count);
};
