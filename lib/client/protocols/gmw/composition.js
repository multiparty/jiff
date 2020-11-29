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

    var mask_value = 0;//jiff.helpers.random(Zp);
    var mask_bits = jiff.helpers.number_to_bits(mask_value, bit_length);

    // Combine the individual masks into one composite mask (SSS not GMW)
    var masks = jiff.share(mask_value);
    var mask = masks[1];
    for (p_id = 2; p_id <= jiff.party_count; p_id++) {
      mask = mask.sadd(masks[p_id]);
    }
    var mask_inv = mask.cmult(-1);  // the additive inverse for unmasking

    // Share each individual mask and combine (GMW bits)
    var masks = [];
    for (p_id = 1; p_id <= jiff.party_count; p_id++) {
      masks[p_id] = Array(bit_length);
    }
    for (var i = 0; i < bit_length; i++) {
      let bit = mask_bits[i];
      let bit_share = jiff.gmw_share(bit);
      for (p_id = 1; p_id <= jiff.party_count; p_id++) {
        masks[p_id][i] = bit_share[p_id];
      }
    }

    // Simulate addition under Z/pZ while working with bits in Z/2Z (GMW shares)
    var mask = masks[1];
    for (p_id = 2; p_id <= jiff.party_count; p_id++) {
      mask = jiff.protocols.gmw.bits.sadd(mask, masks[p_id], op_id + ':gmw.bits.sadd:' + p_id);
    }
    // mask = jiff.protocols.gmw.bits.cmod(mask, Zp, op_id + ':gmw.bits.cmod:1');

    // Apply the mask
    var _masked_bits = jiff.protocols.gmw.bits.sadd(bits, mask);
    // _masked_bits = jiff.protocols.gmw.bits.cmod(_masked_bits, Zp, op_id + ':gmw.bits.cmod:2');

    var promise = new Promise(function (resolve) {
      Promise.all(
        _masked_bits.map(function (bit_share) {
          return jiff.gmw_open(bit_share);
        })
      ).then(function (masked_bits) {
        var masked_value = jiff.helpers.bits_to_number(masked_bits);
        var share = mask_inv.cadd(masked_value);  // secretly remove the the value
        resolve(share);
      });
    });

    return promise;
  }
};
