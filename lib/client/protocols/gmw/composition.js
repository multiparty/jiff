module.exports = {
  /**
   *
   * Compose [secret GMW bits] as a numerical share, an element of Zp
   * @function compose
   * @ignore
   * @param {module:jiff-client~JIFFClient} jiff - the jiff client instance
   * @param {module:jiff-client~JIFFClient#SecretShare[]} bits - the bitwise shared number: array of secrets with index 0 being least significant bit
   * @param {string} [op_id=<auto-generate-id>] - the base operation id to use when generating unique ids for communication.
   *                                              default value should suffice when the code of all parties executes all instructions
   *                                              in the same exact order, otherwise, a unique base name is needed here
   * @returns {module:jiff-client~JIFFClient#SecretShare[]} bitwise sharing of the result. Note that the length of the returned result is |bits|+1, where
   *                          the bit at index 0 is the least significant bit
   */
  compose: function (jiff, bits, Zp, op_id) {
    var i, mask, p_id;

    if (Zp == null || Zp < 2) {
      Zp = jiff.Zp;
    }

    if (op_id == null) {
      op_id = jiff.counters.gen_op_id('gmw.bits.compose', bits[0].holders);
    }

    // copy to avoid aliasing problems during execution
    bits = bits.slice();

    var bit_length = jiff.helpers.number_to_bits(Zp-1).length;

    var mask_value = 255;//jiff.helpers.random(2);
    var mask_bits = jiff.helpers.number_to_bits(mask_value, bit_length);

    var masks = [];//Array(1).concat(Array(jiff.party_count));//.fill(Array(bit_length)));
    // for (p_id = 1; p_id <= jiff.party_count; p_id++) {
    //   masks[p_id] = Array(bit_length);
    // }
    for (var i = 0; i < bit_length; i++) {
      let bit = mask_bits[i];
      let bit_share = jiff.gmw_share(bit);
      let and = bit_share[1].gmw_and(bit_share[2], op_id + ':gmw_and:' + (i - 1));
      console.log(i, bit, bit_share, and);
      // for (p_id = 1; p_id <= jiff.party_count; p_id++) {
        masks.push(and);
      // }
    }

    // // Simulate addition under Z/pZ while working with bits in Z/2Z
    // var mask = [];
    // // for (p_id = 2; p_id <= jiff.party_count; p_id++) {
    //   // mask = jiff.protocols.gmw.bits.sadd(mask, masks[p_id]);
    //   for (var i = 0; i < bit_length; i++) {
    //     mask[i] = masks[1][i].gmw_and(masks[2][i], op_id + ':gmw_and:' + (i - 1));
    //   }
    // // }
    // // mask = jiff.protocols.gmw.bits.cmod(mask, Zp);

    // var _masked_bits = mask;//jiff.protocols.gmw.bits.sadd(bits, mask);

    var promise = new Promise(function (resolve) {
      Promise.all([
          Promise.all(masks.map(function (s) { return jiff.gmw_open(s); })),
          // Promise.all(masks[1].map(function (s) { return jiff.gmw_open(s); })),
          // Promise.all(masks[2].map(function (s) { return jiff.gmw_open(s); }))
      ]).then(function (arr) {
        console.log('arr', arr);
        [masked_bits/*, masks_1, masks_2*/] = arr;
        var masked = jiff.helpers.bits_to_number(masked_bits);
        // alert(masked_bits + ':' + masked);
        console.log('masked_bits', masked_bits, masked);
        // console.log('masks_1', masks_1, jiff.helpers.bits_to_number(masks_1));
        // console.log('masks_2', masks_2, jiff.helpers.bits_to_number(masks_2));
        console.log('mask_bits', mask_bits, mask_value);
        var share = jiff.share(masked)[1];

        // var masks = jiff.share(mask_value);
        //
        // var mask = masks[1];
        // for (p_id = 2; p_id <= jiff.party_count; p_id++) {
        //   mask = mask.sadd(masks[p_id]);
        // }
        //
        // share = share.ssub(mask);

        resolve(share);
      });
    });

    return promise;
  }
};
