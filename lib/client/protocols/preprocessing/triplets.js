/**
 * Generation of beaver triplet via MPC, uses the server for communication channels, but not for generation
 * @function generate_beaver_bgw
 * @ignore
 * @param {module:jiff-client~JIFFClient} jiff - the jiff client instance
 * @param {number} threshold - the threshold of the triplets when stored by receivers after generation
 * @param {Array} receivers_list - array of party ids that want to receive the triplet shares
 * @param {Array} compute_list - array of party ids that will perform this protocol
 * @param {number} Zp - the mod
 * @param {object} params - an object containing extra parameters passed by the user
 *                               Expects:
 *                               - op_id: the base id to use for operation during the execution of this protocol, defaults to auto generated
 *                               - an optional number compute_threshold parameter, which specifies threshold used
 *                               during the protocol execution. By default, this is the length of the (compute_list+1)/2
 * @param {object} protocols - the sub protocols to use for preprocessing
 * @return {object} all pre-processing protocols must return an object with these keys:
 *  {
 *    'share': the share(s)/value(s) to store attached to op_id for later use by the computation (i.e. the result of preprocessing),
 *    'promise': a promise for when this protocol is fully completed (could be null if the protocol was already completed)
 *  }
 *  In this case, 'share' is an array of this party's shares of the resulting triplet, a,b,c such that a*b=c
 */
module.exports = function (jiff, threshold, receivers_list, compute_list, Zp, params, protocols) {
  if (params.compute_threshold == null) {
    params.compute_threshold = Math.floor((compute_list.length + 1) / 2); // honest majority BGW
  }
  if (params.op_id == null && params.output_op_id == null) {
    params.op_id = jiff.counters.gen_op_id2('generate_beaver_bgw', receivers_list, compute_list);
  } else if (params.op_id == null) {
    params.op_id = 'preprocessing:' + params.output_op_id + ':' + compute_list.join(',');
  }

  var op_id = params.op_id;
  var _params = params;

  var a, b, c, promises;
  if (compute_list.indexOf(jiff.id) > -1) {
    params = Object.assign({}, _params);
    params.op_id = op_id + ':share_a';
    a = protocols.generate_random_number(params.compute_threshold, compute_list, compute_list, Zp, params, protocols).share;

    params = Object.assign({}, _params);
    params.op_id = op_id + ':share_b';
    b = protocols.generate_random_number(params.compute_threshold, compute_list, compute_list, Zp, params, protocols).share;

    c = a.ismult_bgw(b, op_id + ':smult_bgw');
    promises = [a.value, b.value, c.value];
  }

  a = jiff.reshare(a, threshold, receivers_list, compute_list, Zp, op_id + ':reshare_a');
  b = jiff.reshare(b, threshold, receivers_list, compute_list, Zp, op_id + ':reshare_b');
  c = jiff.reshare(c, threshold, receivers_list, compute_list, Zp, op_id + ':reshare_c');
  if (receivers_list.indexOf(jiff.id) > -1) {
    promises = [a.value, b.value, c.value];
  }

  return { share: [a, b, c], promise: Promise.all(promises) };
};
