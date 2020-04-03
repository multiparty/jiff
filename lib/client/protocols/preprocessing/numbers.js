/**
 * Can be used to generate shares of a random number, or shares of zero.
 * For a random number, every party generates a local random number and secret share it,
 * then every party sums its share, resulting in a single share of an unknown random number for every party.
 * The same approach is followed for zero, but instead, all the parties know that the total number is zero, but they
 * do not know the value of any resulting share (except their own)
 * @function jiff_share_all_number
 * @ignore
 * @param {module:jiff-client~JIFFClient} jiff - the jiff client instance
 * @param {number} n - the number to share
 * @param {number} [threshold=receivers_list.length] - the min number of parties needed to reconstruct the secret, defaults to all the receivers
 * @param {Array} [receivers_list=all_parties] - array of party ids to receive the result, by default, this includes all parties
 * @param {Array} [compute_list=all_parties] - array of party ids to perform the protocol, by default, this includes all parties
 * @param {number} [Zp=jiff.Zp] - the mod
 * @param {object} [params={}] - an object containing extra parameters passed by the user
 *                                 Expects:
 *                               - op_id: the base id to use for operation during the execution of this protocol, defaults to auto generated
 *                               - compute_threshold: the threshold to use during computation: defaults to compute_list.length
 * @return {Object} contains 'share' (this party's share of the result) and 'promise'
 */
var jiff_share_all_number = function (jiff, n, threshold, receivers_list, compute_list, Zp, params) {
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
    promise = result.value;
  }

  result = jiff.reshare(result, threshold, receivers_list, compute_list, Zp, params.op_id + ':reshare');
  if (receivers_list.indexOf(jiff.id) > -1) {
    promise = result.value;
  }

  return {share: result, promise: promise};
};

module.exports = {
  /**
   * Creates shares of an unknown random number. Every party comes up with its own random number and shares it.
   * Then every party combines all the received shares to construct one share of the random unknown number
   * @function generate_random_number
   * @ignore
   * @param {module:jiff-client~JIFFClient} jiff - the jiff client instance
   * @param {number} threshold - the min number of parties needed to reconstruct the secret after it is computed
   * @param {Array} receivers_list - array of party ids to receive the result
   * @param {Array} compute_list - array of party ids to perform the protocol
   * @param {number} Zp - the mod
   * @param {object} params - an object containing extra parameters passed by the user
   *                                 Expects:
   *                               - op_id: the base id to use for operation during the execution of this protocol, defaults to auto generated
   *                               - compute_threshold: the threshold to use during computation: defaults to compute_list.length
   * @return {Object} contains 'share' (this party's share of the result) and 'promise'
   */
  generate_random_number: function (jiff, threshold, receivers_list, compute_list, Zp, params) {
    if (params.op_id == null && params.output_op_id == null) {
      params.op_id = jiff.counters.gen_op_id2('generate_random_number', receivers_list, compute_list);
    } else if (params.op_id == null) {
      params.op_id = 'preprocessing:' + params.output_op_id + ':' + compute_list.join(',');
    }
    return jiff_share_all_number(jiff, jiff.helpers.random(Zp), threshold, receivers_list, compute_list, Zp, params);
  },
  /**
   * Creates shares of 0, such that no party knows the other parties' shares.
   * Every party secret shares 0, then every party sums all the shares they received, resulting
   * in a new share of 0 for every party
   * @function generate_zero
   * @ignore
   * @param {module:jiff-client~JIFFClient} jiff - the jiff instance
   * @param {number} threshold - the min number of parties needed to reconstruct the secret after it is computed
   * @param {Array} receivers_list - array of party ids to receive the result
   * @param {Array} compute_list - array of party ids to perform the protocol
   * @param {number} Zp - the mod
   * @param {object} params - an object containing extra parameters passed by the user
   *                                 Expects:
   *                               - op_id: the base id to use for operation during the execution of this protocol, defaults to auto generated
   *                               - compute_threshold: the threshold to use during computation: defaults to compute_list.length
   * @return {Object} contains 'share' (this party's share of the result) and 'promise'
   */
  generate_zero: function (jiff, threshold, receivers_list, compute_list, Zp, params) {
    if (params.op_id == null && params.output_op_id == null) {
      params.op_id = jiff.counters.gen_op_id2('generate_zero', receivers_list, compute_list);
    } else if (params.op_id == null) {
      params.op_id = 'preprocessing:' + params.output_op_id + ':' + compute_list.join(',');
    }
    return jiff_share_all_number(jiff, 0, threshold, receivers_list, compute_list, Zp, params);
  }
};