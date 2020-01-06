/**
 * Can be used to generate shares of a random number, or shares of zero.
 * For a random number, every party generates a local random number and secret share it,
 * then every party sums its share, resulting in a single share of an unknown random number for every party.
 * The same approach is followed for zero, but instead, all the parties know that the total number is zero, but they
 * do not know the value of any resulting share (except their own).
 * @param {jiff-instance} jiff - the jiff instance.
 * @param {number} n - the number to share.
 * @param {number} [threshold=receivers_list.length] - the min number of parties needed to reconstruct the secret, defaults to all the receivers.
 * @param {Array} [receivers_list=all_parties] - array of party ids to receive the result, by default, this includes all parties.
 * @param {Array} [compute_list=all_parties] - array of party ids to perform the protocol, by default, this includes all parties.
 * @param {number} [Zp=jiff.Zp] - the mod.
 * @param {object} [params={}] - an object containing extra parameters passed by the user.
 *                                 Expects:
 *                               - op_id: the base id to use for operation during the execution of this protocol, defaults to auto generated.
 *                               - compute_threshold: the threshold to use during computation: defaults to compute_list.length
 * @return {Object} contains 'share' (this party's share of the result) and 'promise'.
 */
function jiff_share_all_number(jiff, n, threshold, receivers_list, compute_list, Zp, params) {
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
    promise = result.promise;
  }

  result = jiff.protocols.reshare(result, threshold, receivers_list, compute_list, Zp, params.op_id + ':reshare');
  if (receivers_list.indexOf(jiff.id) > -1) {
    promise = result.promise;
  }

  return {share: result, promise: promise};
}

/**
 * Creates shares of an unknown random number. Every party comes up with its own random number and shares it.
 * Then every party combines all the received shares to construct one share of the random unknown number.
 * @method generate_random_number
 * @memberof jiff-instance.protocols
 * @instance
 * @param {number} threshold - the min number of parties needed to reconstruct the secret after it is computed.
 * @param {Array} receivers_list - array of party ids to receive the result.
 * @param {Array} compute_list - array of party ids to perform the protocol.
 * @param {number} Zp - the mod.
 * @param {object} params - an object containing extra parameters passed by the user.
 *                                 Expects:
 *                               - op_id: the base id to use for operation during the execution of this protocol, defaults to auto generated.
 *                               - compute_threshold: the threshold to use during computation: defaults to compute_list.length
 * @return {Object} contains 'share' (this party's share of the result) and 'promise'.
 */
jiff.protocols.generate_random_number = function (threshold, receivers_list, compute_list, Zp, params) {
  if (params.op_id == null) {
    params.op_id = jiff.counters.gen_op_id2('generate_random_number', receivers_list, compute_list);
  }
  return jiff_share_all_number(jiff, jiff.helpers.random(Zp), threshold, receivers_list, compute_list, Zp, params);
};

/**
 * Creates shares of 0, such that no party knows the other parties' shares.
 * Every party secret shares 0, then every party sums all the shares they received, resulting
 * in a new share of 0 for every party.
 * @method generate_zero
 * @memberof jiff-instance.protocols
 * @instance
 * @param {number} threshold - the min number of parties needed to reconstruct the secret after it is computed.
 * @param {Array} receivers_list - array of party ids to receive the result.
 * @param {Array} compute_list - array of party ids to perform the protocol.
 * @param {number} Zp - the mod.
 * @param {object} params - an object containing extra parameters passed by the user.
 *                                 Expects:
 *                               - op_id: the base id to use for operation during the execution of this protocol, defaults to auto generated.
 *                               - compute_threshold: the threshold to use during computation: defaults to compute_list.length
 * @return {Object} contains 'share' (this party's share of the result) and 'promise'.
 */
jiff.protocols.generate_zero = function (threshold, receivers_list, compute_list, Zp, params) {
  if (params.op_id == null) {
    params.op_id = jiff.counters.gen_op_id2('generate_random_number', receivers_list, compute_list);
  }
  return jiff_share_all_number(jiff, 0, threshold, receivers_list, compute_list, Zp, params);
};

/**
 * Creates shares of r and x, such that r is a uniform random number between 0 and Zp, and x is floor(r/constant)
 * where constant is provided by the extra params.
 * @method generate_random_and_quotient
 * @memberof jiff-instance.protocols
 * @instance
 * @param {number} threshold - the min number of parties needed to reconstruct the secret after it is computed.
 * @param {Array} receivers_list - array of party ids to receive the result.
 * @param {Array} compute_list - array of party ids to perform the protocol.
 * @param {number} Zp - the mod.
 * @param {object} params - an object containing extra parameters passed by the user.
 *                                 Expects:
 *                               - op_id: the base id to use for operation during the execution of this protocol, defaults to auto generated.
 *                               - compute_threshold: the threshold to use during computation: defaults to compute_list.length
 *                               - constant: the constant to divide the random number by.
 *                               - output_op_id: the set op id of the output quotient and noise.
 * @return {Object} contains 'share' (this party's share of the result) and 'promise'.
 */
jiff.protocols.generate_random_and_quotient = function (threshold, receivers_list, compute_list, Zp, params, protocols) {
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
    promise = Promise.all([r.promise, q.promise]);
  }

  // reshare the result with the designated receivers
  r = jiff.protocols.reshare(r, threshold, receivers_list, compute_list, Zp, op_id + ':reshare1');
  q = jiff.protocols.reshare(q, threshold, receivers_list, compute_list, Zp, op_id + ':reshare2');

  // return result
  if (receivers_list.indexOf(jiff.id) > -1) {
    promise = Promise.all([r.promise, q.promise]);
  }
  return {share: {r: r, q: q}, promise: promise};
};

/**
 * generation of beaver triplet via MPC, uses the server for communication channels, but not for generation.
 * @method generate_beaver_bgw
 * @memberof jiff-instance.protocols
 * @instance
 * @param {number} threshold - the threshold of the triplets when stored by receivers after generation.
 * @param {Array} receivers_list - array of party ids that want to receive the triplet shares.
 * @param {Array} compute_list - array of party ids that will perform this protocol.
 * @param {number} Zp - the mod.
 * @param {object} params - an object containing extra parameters passed by the user.
 *                               Expects:
 *                               - op_id: the base id to use for operation during the execution of this protocol, defaults to auto generated.
 *                               - an optional number compute_threshold parameter, which specifies threshold used
 *                               during the protocol execution. By default, this is the length of the (compute_list+1)/2.
 * @param {object} protocols - the sub protocols to use for preprocessing.
 * @return {object} all pre-processing protocols must return an object with these keys:
 *  {
     *    'share': the share(s)/value(s) to store attached to op_id for later use by the computation (i.e. the result of preprocessing),
     *    'promise': a promise for when this protocol is fully completed (could be null if the protocol was already completed)
     *  }
 *  In this case, 'share' is an array of this party's shares of the resulting triplet, a,b,c such that a*b=c.
 */
jiff.protocols.generate_beaver_bgw = function (threshold, receivers_list, compute_list, Zp, params, protocols) {
  if (params.compute_threshold == null) {
    params.compute_threshold = Math.floor((compute_list.length + 1) / 2); // honest majority BGW
  }
  if (params.op_id == null) {
    params.op_id = jiff.counters.gen_op_id2('generate_beaver_bgw', receivers_list, compute_list);
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
    promises = [a.promise, b.promise, c.promise];
  }

  a = jiff.protocols.reshare(a, threshold, receivers_list, compute_list, Zp, op_id + ':reshare_a');
  b = jiff.protocols.reshare(b, threshold, receivers_list, compute_list, Zp, op_id + ':reshare_b');
  c = jiff.protocols.reshare(c, threshold, receivers_list, compute_list, Zp, op_id + ':reshare_c');
  if (receivers_list.indexOf(jiff.id) > -1) {
    promises = [a.promise, b.promise, c.promise];
  }

  return { share: [a, b, c], promise: Promise.all(promises) };
};

/**
 * generates a random bit under MPC by xoring all bits sent by participating parties
 * @method generate_random_bit_bgw
 * @memberof jiff-instance.protocols
 * @instance
 * @param {number} threshold - the min number of parties needed to reconstruct the secret after it is computed.
 * @param {Array} receivers_list - array of party ids to receive the result.
 * @param {Array} compute_list - array of party ids to perform the protocol.
 * @param {number} Zp - the mod.
 * @param {object} params - an object containing extra parameters passed by the user.
 *                                 Expects:
 *                               - op_id: the base id to use for operation during the execution of this protocol, defaults to auto generated.
 *                               - compute_threshold: the threshold to use during computation: defaults to compute_list.length
 * @return {Object} contains 'share' (this party's share of the generated bit) and 'promise'.
 */
jiff.protocols.generate_random_bit_bgw  = function (threshold, receivers_list, compute_list, Zp, params) {
  if (params.op_id == null) {
    params.op_id = jiff.counters.gen_op_id2('generate_random_bit_bgw', receivers_list, compute_list);
  }
  if (params.compute_threshold == null) {
    params.compute_threshold = Math.floor((compute_list.length + 1) / 2); // honest majority BGW
  }

  var op_id = params.op_id;

  // Generate random bit
  var random_bit, promise;
  if (compute_list.indexOf(jiff.id) > -1) {
    var bit = jiff.helpers.random(2);
    var bit_shares = jiff.internal_share(bit, params.compute_threshold, compute_list, compute_list, Zp, op_id + ':share');

    random_bit = bit_shares[compute_list[0]];
    for (var i = 1; i < compute_list.length; i++) {
      var party_id = compute_list[i];
      var obit = bit_shares[party_id];
      random_bit = random_bit.isadd(obit).issub(random_bit.ismult_bgw(obit, op_id + ':smult' + i).icmult(2));
    }

    promise = random_bit.promise;
  }

  // Reshare
  random_bit = jiff.protocols.reshare(random_bit, threshold, receivers_list, compute_list, Zp, op_id+':reshare');
  if (receivers_list.indexOf(jiff.id) > -1) {
    promise = random_bit.promise;
  }
  return { share: random_bit, promise: promise };
};

/**
 * generates a sequence of random bits under MPC.
 * @method generate_random_bits
 * @memberof jiff-instance.protocols
 * @instance
 * @param {number} [threshold=receivers_list.length] - the threshold of the bit when stored by receivers after generation.     * @param {number} threshold - the min number of parties needed to reconstruct the secret after it is computed.
 * @param {Array} receivers_list - array of party ids to receive the result.
 * @param {Array} compute_list - array of party ids to perform the protocol.
 * @param {number} Zp - the mod.
 * @param {object} params - an object containing extra parameters passed by the user.
 *                                 Expects:
 *                               - op_id: the base id to use for operation during the execution of this protocol, defaults to auto generated.
 *                               - count: how many random bits to generate.
 *                               - compute_threshold: the threshold to use during computation: defaults to compute_list.length
 * @param {object} protocols - the protocols to use for preprocessing.
 * @return {Object} contains 'share' (array of secret shares bits) and 'promise'.
 */
jiff.protocols.generate_random_bits = function (threshold, receivers_list, compute_list, Zp, params, protocols) {
  if (params.count == null) {
    params.count = 1;
  }
  if (params.op_id == null) {
    params.op_id = jiff.counters.gen_op_id2('generate_random_bits', receivers_list, compute_list);
  }

  var op_id = params.op_id;
  var _params = params;

  var promises = [];
  var bits = [];
  for (var i = 0; i < params.count; i++) {
    params = Object.assign({}, _params);
    params.op_id = op_id + ':' + i;

    var bit = protocols.generate_random_bit(threshold, receivers_list, compute_list, Zp, params, protocols);

    promises.push(bit.promise);
    if (bit.share != null) {
      bits.push(bit.share);
    }
  }

  if (bits.length === 0) {
    bits = null;
  }
  return {share: bits, promise: Promise.all(promises)};
};