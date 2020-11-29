module.exports = {
  /**
   *
   * Compute [secret GMW bits1] + [secret GMW bits2]
   * @function sadd
   * @ignore
   * @param {module:jiff-client~JIFFClient} jiff - the jiff client instance
   * @param {module:jiff-client~JIFFClient#SecretShare[]} bits1 - the first bitwise shared number: array of secrets with index 0 being least significant bit
   * @param {module:jiff-client~JIFFClient#SecretShare[]} bits2 - the second bitwise shared number (length may be different)
   * @param {string} [op_id=<auto-generate-id>] - the base operation id to use when generating unique ids for communication.
   *                                              default value should suffice when the code of all parties executes all instructions
   *                                              in the same exact order, otherwise, a unique base name is needed here
   * @returns {module:jiff-client~JIFFClient#SecretShare[]} bitwise sharing of the result. Note that the length of the returned result is |bits|+1, where
   *                          the bit at index 0 is the least significant bit
   */
  sadd: function (jiff, bits1, bits2, op_id) {
    if (op_id == null) {
      op_id = jiff.counters.gen_op_id('gmw.bits.sadd', bits1[0].holders);
    }

    // copy to avoid aliasing problems during execution
    bits1 = bits1.slice();
    bits2 = bits2.slice();

    var tmp = bits1.length > bits2.length ? bits1 : bits2;
    bits2 = bits1.length > bits2.length ? bits2 : bits1; // shortest array
    bits1 = tmp; // longest array

    // initialize results
    var result = jiff.utils.many_secret_shares(bits1.length, bits1[0].holders, Math.max(bits1[0].threshold, bits2[0].threshold), bits1[0].Zp);
    var deferreds = result.deferreds;
    result = result.shares;

    var sum = bits1[0].gmw_xor(bits2[0], op_id + ':gmw_xor:initial');
    var carry = bits1[0].gmw_and(bits2[0], op_id + ':gmw_and:initial');

    // put initial bit at head of result array
    result.unshift(sum);
    deferreds.unshift(null);

    // compute sum one bit at a time, propagating carry
    jiff.utils.bit_combinator(deferreds[deferreds.length - 1], 1, deferreds.length - 1, carry, function (i, carry) {
      var sum;
      if (i < bits2.length) {
        var and = bits1[i].gmw_and(bits2[i], op_id + ':gmw_and1:' + (i - 1));
        var xor = bits1[i].gmw_xor(bits2[i], op_id + ':gmw_xor1:' + (i - 1));
        var xorAndCarry = xor.gmw_and(carry, op_id + ':gmw_and2:' + (i - 1));

        sum = xor.gmw_xor(carry, op_id + ':gmw_xor2:' + (i - 1));
        // NOTE: expensive or is a.gmw_xor(b).gmw_xor(a.gmw_and(b))
        carry = and.gmw_xor(xorAndCarry, op_id + ':gmw_xor3:' + (i - 1)); // cheap or, xor and and cannot both be true!
      } else {
        // and is always zero, xor is equal to bits1[i]
        sum = bits1[i].gmw_xor(carry, op_id + ':gmw_xor1:' + (i - 1));
        carry = bits1[i].gmw_and(carry, op_id + ':gmw_and1:' + (i - 1));
      }

      sum.wThen(deferreds[i].resolve);
      return carry;
    });

    return result;
  },

  /**
   * Compute [secret bits1] * [secret bits2]
   * @function gmw_smult
   * @ignore
   * @param {module:jiff-client~JIFFClient} jiff - the jiff client instance
   * @param {module:jiff-client~JIFFClient#SecretShare[]} bits1 - bitwise shared secret to multiply: lower indices represent less significant bits
   * @param {module:jiff-client~JIFFClient#SecretShare[]} bits2 - bitwise shared secret to multiply
   * @param {string} [op_id=<auto-generate-id>] - the base operation id to use when generating unique ids for communication.
   *                                              default value should suffice when the code of all parties executes all instructions
   *                                              in the same exact order, otherwise, a unique base name is needed here
   * @returns {module:jiff-client~JIFFClient#SecretShare[]} bitwise sharing of the result, the length of the result will be bits1.length + bits2.length
   */
  smult: function (jiff, bits1, bits2, op_id) {
    if (op_id == null) {
      op_id = jiff.counters.gen_op_id('gmw.bits.smult', bits1[0].holders);
    }

    // copy to avoid aliasing problems during execution
    bits1 = bits1.slice();
    bits2 = bits2.slice();

    // bits1 will be the longest array, bits2 will be the shortest
    var tmp = bits1.length > bits2.length ? bits1 : bits2;
    bits2 = bits1.length > bits2.length ? bits2 : bits1;
    bits1 = tmp;

    // Initialize the result
    var offset = bits2.length === 1 ? -1 : 0;
    var result = jiff.utils.many_secret_shares(bits1.length + bits2.length + offset, bits1[0].holders, Math.max(bits1[0].threshold, bits2[0].threshold), bits1[0].Zp);
    var deferreds = result.deferreds;
    result = result.shares;

    // Resolve result when ready
    var final_deferred = new jiff.helpers.Deferred();
    final_deferred.promise.then(jiff.utils.resolve_many_secrets.bind(null, deferreds));

    // Loop over *shortest* array one bit at a time
    jiff.utils.bit_combinator(final_deferred, 0, bits2.length, bits2, function (i, intermediate) {
      var this_bit = bits2[i];
      var bit_mult = []; // add bits1 or 0 to the result according to this bit
      for (var j = 0; j < bits1.length; j++) {
        // bit_mult[j] := if this_bit===1 then bits1[j] else 0
        if (this_bit.isConstant(bits1[j])) {
          if (bits1[j] === 0) {
            bit_mult[j] = this_bit.gmw_xor(this_bit, op_id + ':gmw_xor:' + i + ':' + j);
          } else {
            bit_mult[j] = this_bit;
          }
        } else {
          bit_mult[j] = this_bit.gmw_and(bits1[j], op_id + ':gmw_and:' + i + ':' + j);
        }
      }
      bits1.unshift(0); // increase magnitude

      if (i === 0) {
        return bit_mult;
      }

      return jiff.protocols.gmw.bits.sadd(intermediate, bit_mult, op_id + ':gmw.bits.sadd:' + i);
    }, function (intermediate) {
      // promise-ify an array of intermediate results
      var promises = [];
      for (var i = 0; i < intermediate.length; i++) {
        promises.push(intermediate[i].value);
      }
      return Promise.all(promises);
    }, function (result) {
      // identity
      return result;
    });

    return result;
  }
};
