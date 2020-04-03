/**
 * Creates shares of r and x, such that r is a uniform random number between 0 and Zp, and x is floor(r/constant)
 * where constant is provided by the extra params
 * @function generate_random_and_quotient
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
 *                               - constant: the constant to divide the random number by.
 *                               - output_op_id: the set op id of the output quotient and noise
 * @return {Object} contains 'share' (this party's share of the result) and 'promise'
 */
module.exports = function (jiff, threshold, receivers_list, compute_list, Zp, params, protocols) {
  // consistent and unique op_id for compute and receiver parties
  if (params.op_id == null && params.output_op_id == null) {
    params.op_id = jiff.counters.gen_op_id2('generate_random_and_quotient', receivers_list, compute_list);
  } else if (params.op_id == null) {
    params.op_id = 'preprocessing:' + params.output_op_id + ':' + compute_list.join(',');
  }

  if (params.compute_threshold == null) {
    params.compute_threshold = Math.floor((compute_list.length + 1) / 2); // honest majority BGW
  }

  var constant = params.constant;
  var op_id = params.op_id;
  Zp = Zp ? jiff.Zp : Zp;

  // stores the result
  var r, q;

  // for compute parties
  var promise;
  if (compute_list.indexOf(jiff.id) > -1) {
    var largestQuotient = jiff.share_helpers['floor'](jiff.share_helpers['/'](Zp, constant));
    var largestMultiple = jiff.share_helpers['*'](largestQuotient, constant);

    // Uniform random number between [0, Zp)
    var r_bits = jiff.protocols.bits.rejection_sampling(0, Zp, params.compute_threshold, compute_list, Zp, params.output_op_id + ':rejection1');
    var cmp = jiff.protocols.bits.cgteq(r_bits, largestMultiple, params.output_op_id + ':bits_cgteq');
    var r1 = jiff.protocols.bits.bit_composition(r_bits);

    // Uniform random number between [0, Math.floor(Zp / constant))
    var quotient = jiff.protocols.bits.rejection_sampling(0, largestQuotient, params.compute_threshold, compute_list, Zp, params.output_op_id + ':rejection2');
    quotient = jiff.protocols.bits.bit_composition(quotient);

    // Uniform random number between [0, constant)
    var remainder = jiff.protocols.bits.rejection_sampling(0, constant, params.compute_threshold, compute_list, Zp, params.output_op_id + ':rejection3');
    remainder = jiff.protocols.bits.bit_composition(remainder);
    var r2 = quotient.icmult(constant).isadd(remainder);

    // choose either (r1, largestQuotient) or (r2, quotient) based on cmp result
    r = cmp.iif_else(r1, r2, params.output_op_id + ':ifelse1');
    q = cmp.iif_else(largestQuotient, quotient, params.output_op_id + ':ifelse2');
    promise = Promise.all([r.value, q.value]);
  }

  // reshare the result with the designated receivers
  r = jiff.reshare(r, threshold, receivers_list, compute_list, Zp, op_id + ':reshare1');
  q = jiff.reshare(q, threshold, receivers_list, compute_list, Zp, op_id + ':reshare2');

  // return result
  if (receivers_list.indexOf(jiff.id) > -1) {
    promise = Promise.all([r.value, q.value]);
  }
  return {share: {r: r, q: q}, promise: promise};
};