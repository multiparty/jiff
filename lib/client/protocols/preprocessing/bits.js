module.exports = {
  /**
   * Generates a random bit under MPC by xoring all bits sent by participating parties using smult / beaver triples
   * @function generate_random_bit_bgw
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
   * @return {Object} contains 'share' (this party's share of the generated bit) and 'promise'
   */
  generate_random_bit_smult: function (jiff, threshold, receivers_list, compute_list, Zp, params) {
    if (params.compute_threshold == null) {
      params.compute_threshold = threshold;
    }

    if (params.op_id == null && params.output_op_id == null) {
      params.op_id = jiff.counters.gen_op_id2('generate_random_bit_smult', receivers_list, compute_list);
    } else if (params.op_id == null) {
      params.op_id = 'preprocessing:' + params.output_op_id + ':' + compute_list.join(',');
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
        random_bit = random_bit.isxor_bit(obit,  op_id + ':sxor_bit:' + i);
      }

      promise = random_bit.value;
    }

    // Reshare
    random_bit = jiff.reshare(random_bit, threshold, receivers_list, compute_list, Zp, op_id + ':reshare');
    if (receivers_list.indexOf(jiff.id) > -1) {
      promise = random_bit.value;
    }
    return {share: random_bit, promise: promise};
  },
  /**
   * Generates a random bit under MPC by xoring all bits sent by participating parties using smult_bgw
   * @function generate_random_bit_bgw
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
   * @return {Object} contains 'share' (this party's share of the generated bit) and 'promise'
   */
  generate_random_bit_bgw: function (jiff, threshold, receivers_list, compute_list, Zp, params) {
    if (params.compute_threshold == null) {
      params.compute_threshold = Math.floor((compute_list.length + 1) / 2); // honest majority BGW
    }

    if (params.op_id == null && params.output_op_id == null) {
      params.op_id = jiff.counters.gen_op_id2('generate_random_bit_bgw', receivers_list, compute_list);
    } else if (params.op_id == null) {
      params.op_id = 'preprocessing:' + params.output_op_id + ':' + compute_list.join(',');
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

      promise = random_bit.value;
    }

    // Reshare
    random_bit = jiff.reshare(random_bit, threshold, receivers_list, compute_list, Zp, op_id + ':reshare');
    if (receivers_list.indexOf(jiff.id) > -1) {
      promise = random_bit.value;
    }
    return {share: random_bit, promise: promise};
  },
  /**
   * Generates a sequence of random bits under MPC
   * @function generate_random_bits
   * @ignore
   * @param {module:jiff-client~JIFFClient} jiff - the jiff client instance
   * @param {number} [threshold=receivers_list.length] - the threshold of the bit when stored by receivers after generation
   * @param {number} threshold - the min number of parties needed to reconstruct the secret after it is computed
   * @param {Array} receivers_list - array of party ids to receive the result
   * @param {Array} compute_list - array of party ids to perform the protocol
   * @param {number} Zp - the mod
   * @param {object} params - an object containing extra parameters passed by the user
   *                                 Expects:
   *                               - op_id: the base id to use for operation during the execution of this protocol, defaults to auto generated
   *                               - count: how many random bits to generate
   *                               - compute_threshold: the threshold to use during computation: defaults to compute_list.length
   * @param {object} protocols - the protocols to use for preprocessing
   * @return {Object} contains 'share' (array of secret shares bits) and 'promise'
   */
  generate_random_bits: function (jiff, threshold, receivers_list, compute_list, Zp, params, protocols) {
    if (params.count == null) {
      params.count = 1;
    }

    if (params.op_id == null && params.output_op_id == null) {
      params.op_id = jiff.counters.gen_op_id2('generate_random_bits', receivers_list, compute_list);
    } else if (params.op_id == null) {
      params.op_id = 'preprocessing:' + params.output_op_id + ':' + compute_list.join(',');
    }

    var op_id = params.op_id;
    var _params = params;

    var promises = [];
    var bits = [];
    for (var i = 0; i < params.count; i++) {
      params = Object.assign({}, _params);
      params.op_id = op_id + ':' + i;

      var bit = protocols.generate_random_bit(threshold, receivers_list, compute_list, Zp, params, protocols);

      promises.push(bit.value);
      if (bit.share != null) {
        bits.push(bit.share);
      }
    }

    if (bits.length === 0) {
      bits = null;
    }
    return {share: bits, promise: Promise.all(promises)};
  }
};