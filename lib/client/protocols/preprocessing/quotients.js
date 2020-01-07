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
  if (params.op_id == null) {
    params.op_id = jiff.counters.gen_op_id2('generate_random_and_quotient', receivers_list, compute_list);
  }
  if (params.compute_threshold == null) {
    params.compute_threshold = Math.floor((compute_list.length + 1) / 2); // honest majority BGW
  }

  // read only copy
  var _params = params;

  var promise = null;
  // do preprocessing for this function
  if (params.ondemand !== true) {
    var intermediate_output_op_id = params.constant != null ? params.op_id : params.output_op_id;
    params = Object.assign({}, _params);
    params.op_id = params.op_id + ':preprocessing';
    params.output_op_id = intermediate_output_op_id;
    promise = jiff.__preprocessing('__generate_random_and_quotient', 1, protocols, params.compute_threshold, compute_list, compute_list, Zp, [intermediate_output_op_id], params);
  }

  // execute the actual function
  if (_params.constant == null) {
    return {share: { ondemand: true }, promise: promise};
  }

  var constant = _params.constant;
  var op_id = _params.op_id;

  // stores the result
  var r, q;

  // for compute parties
  var promise;
  if (compute_list.indexOf(jiff.id) > -1) {
    var largest_quotient, largest_multiple;
    if (Zp.isBigNumber === true) {
      largest_quotient = Zp.div(constant).floor();
      largest_multiple = largest_quotient.times(constant);
    } else {
      largest_quotient = Math.floor(Zp / constant);
      largest_multiple = largest_quotient * constant;
    }

    // Uniform random number between 0 and Zp
    var r_bits = jiff.get_preprocessing(op_id + ':rejection1');
    var cmp = jiff.protocols.bits.cgteq(r_bits, largest_multiple, op_id + ':bits_cgteq');
    var r1 = jiff.protocols.bits.bit_composition(r_bits); // assume cmp = 1

    // assume cmp = 0
    params = Object.assign({}, _params);
    params.op_id = op_id + ':rejection2';
    params.upper_bound = largest_quotient;
    var div = jiff.protocols.bits.rejection_sampling(params.compute_threshold, compute_list, compute_list, Zp, params, protocols).share;
    div = jiff.protocols.bits.bit_composition(div);

    params = Object.assign({}, params);
    params.op_id = op_id + ':rejection3';
    params.upper_bound = constant;
    var mod = jiff.protocols.bits.rejection_sampling(params.compute_threshold, compute_list, compute_list, Zp, params, protocols).share;
    mod = jiff.protocols.bits.bit_composition(mod);
    var r2 = div.icmult(constant).isadd(mod);

    // choose either (r1, largest_quotient) or (r2, div) based on cmp result
    r = cmp.iif_else(r1, r2, op_id + ':ifelse1');
    q = cmp.iif_else(largest_quotient, div, op_id + ':ifelse2');
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