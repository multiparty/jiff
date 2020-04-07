module.exports = {
  /**
   * Compute sum of bitwise secret shared number and a constant
   * @function cadd
   * @ignore
   * @param {module:jiff-client~JIFFClient} jiff - the jiff client instance
   * @param {module:jiff-client~JIFFClient#SecretShare[]} bits - the bit wise secret shares
   * @param {number} constant - the constant
   * @param {string} [op_id=<auto-generate-id>] - the base operation id to use when generating unique ids for communication
   *                                              default value should suffice when the code of all parties executes all instructions
   *                                              in the same exact order, otherwise, a unique base name is needed here
   * @returns {module:jiff-client~JIFFClient#SecretShare[]} bitwise sharing of the result. Note that the length here will be max(|bits|, |constant|) + 1
   *                          in case of potential overflow / carry
   */
  cadd: function (jiff, bits, constant, op_id) {
    if (!(bits[0].isConstant(constant))) {
      throw new Error('parameter should be a number (bits.cadd)');
    }
    if (op_id == null) {
      op_id = jiff.counters.gen_op_id('bits.cadd', bits[0].holders);
    }

    if (constant.toString() === '0') {
      return bits;
    }

    // copy to avoid aliasing problems during execution
    bits = bits.slice();

    // decompose constant into bits
    var constant_bits = jiff.helpers.number_to_bits(constant, bits.length); // pads with zeros to bits.length

    // initialize results
    var result = jiff.utils.many_secret_shares(Math.max(constant_bits.length, bits.length), bits[0].holders, bits[0].threshold, bits[0].Zp);
    var deferreds = result.deferreds;
    result = result.shares;

    var sum = bits[0].icxor_bit(constant_bits[0]);
    var carry = bits[0].icmult(constant_bits[0]);

    // put initial bit at head of result array
    result.unshift(sum);
    deferreds.unshift(null);

    // compute sum one bit at a time, propagating carry
    jiff.utils.bit_combinator(deferreds[deferreds.length - 1], 1, deferreds.length - 1, carry, function (i, carry) {
      var sum;
      if (i < bits.length) {
        var and = bits[i].icmult(constant_bits[i]);
        var xor = bits[i].icxor_bit(constant_bits[i]);
        var xorAndCarry = xor.ismult(carry, op_id + ':smult:' + (i - 1));

        sum = xor.isxor_bit(carry, op_id + ':sxor_bit:' + (i - 1));
        carry = and.isadd(xorAndCarry); // cheap or, xor and and cannot both be true!
      } else {
        // bits.length <= i < constant_bits.length
        // and is zero, xor is constant_bits[i]
        sum = carry.icxor_bit(constant_bits[i]);
        carry = carry.icmult(constant_bits[i]);
      }

      sum.wThen(deferreds[i].resolve);
      return carry;
    });

    return result;
  },
  /**
   * Compute [secret bits] - [constant bits]
   * @function csubl
   * @ignore
   * @param {module:jiff-client~JIFFClient} jiff - the jiff client instance
   * @param {number} constant - the constant
   * @param {module:jiff-client~JIFFClient#SecretShare[]} bits - the bit wise secret shares
   * @param {string} [op_id=<auto-generate-id>] - the base operation id to use when generating unique ids for communication.
   *                                              default value should suffice when the code of all parties executes all instructions
   *                                              in the same exact order, otherwise, a unique base name is needed here
   * @returns {module:jiff-client~JIFFClient#SecretShare[]} bitwise sharing of the result. Note that the length of the returned result is |bits|+1, where
   *                          the bit at index 0 is the least significant bit. The bit at index 1 is the most significant bit,
   *                          and the bit at index |bits| is 1 if the result overflows, or 0 otherwise
   */
  csubl: function (jiff, bits, constant, op_id) {
    if (!(bits[0].isConstant(constant))) {
      throw new Error('parameter should be a number (bits.csubl)');
    }
    if (op_id == null) {
      op_id = jiff.counters.gen_op_id('bits.csubl', bits[0].holders);
    }

    if (constant.toString() === '0') {
      return bits;
    }

    // copy to avoid aliasing problems during execution
    bits = bits.slice();

    // decompose constant into bits
    var constant_bits = jiff.helpers.number_to_bits(constant, bits.length); // pads with zeros to bits.length

    // initialize results
    var result = jiff.utils.many_secret_shares(Math.max(constant_bits.length, bits.length), bits[0].holders, bits[0].threshold, bits[0].Zp);
    var deferreds = result.deferreds;
    result = result.shares;

    var diff = bits[0].icxor_bit(constant_bits[0]);
    var borrow = bits[0].inot().icmult(constant_bits[0]);

    // put initial bit at head of result array
    result.unshift(diff);
    deferreds.unshift(null);

    // compute diff one bit at a time, propagating borrow
    jiff.utils.bit_combinator(deferreds[deferreds.length - 1], 1, deferreds.length - 1, borrow, function (i, borrow) {
      var diff;
      if (i < bits.length) {
        var xor = bits[i].icxor_bit(constant_bits[i]);
        var andNot = bits[i].inot().icmult(constant_bits[i]);

        // save and update borrow
        diff = xor.isxor_bit(borrow, op_id + ':sxor_bit:' + (i - 1));
        borrow = xor.inot().ismult(borrow, op_id + ':smult:' + (i - 1));
        borrow = borrow.isadd(andNot);
      } else {
        // bits.length <= i < constant_bits.length
        // xor and andNot are equal to the constant bit value since secret bit is always zero here
        diff = borrow.icxor_bit(constant_bits[i]);
        borrow = borrow.issub(borrow.icmult(constant_bits[i]));
        borrow = borrow.icadd(constant_bits[i]);
      }

      diff.wThen(deferreds[i].resolve);
      return borrow;
    });

    return result;
  },
  /**
   * Compute [constant bits] - [secret bits]
   * @function csubr
   * @ignore
   * @param {module:jiff-client~JIFFClient} jiff - the jiff client instance
   * @param {number} constant - the constant
   * @param {module:jiff-client~JIFFClient#SecretShare[]} bits - the bit wise secret shares
   * @param {string} [op_id=<auto-generate-id>] - the base operation id to use when generating unique ids for communication.
   *                                              default value should suffice when the code of all parties executes all instructions
   *                                              in the same exact order, otherwise, a unique base name is needed here
   * @returns {module:jiff-client~JIFFClient#SecretShare[]} bitwise sharing of the result. Note that the length of the returned result is |bits|+1, where
   *                          the bit at index 0 is the least significant bit. The bit at index 1 is the most significant bit,
   *                          and the bit at index |bits| is 1 if the result overflows, or 0 otherwise
   */
  csubr: function (jiff, constant, bits, op_id) {
    if (!(bits[0].isConstant(constant))) {
      throw new Error('parameter should be a number (bits.csubr)');
    }
    if (op_id == null) {
      op_id = jiff.counters.gen_op_id('bits.csubr', bits[0].holders);
    }

    // copy to avoid aliasing problems during execution
    bits = bits.slice();

    // decompose constant into bits
    var constant_bits = jiff.helpers.number_to_bits(constant, bits.length); // pads with zeros to bits.length

    // initialize results
    var result = jiff.utils.many_secret_shares(Math.max(constant_bits.length, bits.length), bits[0].holders, bits[0].threshold, bits[0].Zp);
    var deferreds = result.deferreds;
    result = result.shares;

    var diff = bits[0].icxor_bit(constant_bits[0]);
    var borrow = bits[0].issub(bits[0].icmult(constant_bits[0]));

    // put initial bit at head of result array
    result.unshift(diff);
    deferreds.unshift(null);

    // compute diff one bit at a time, propagating borrow
    jiff.utils.bit_combinator(deferreds[deferreds.length - 1], 1, deferreds.length - 1, borrow, function (i, borrow) {
      var diff;
      if (i < bits.length) {
        var xor = bits[i].icxor_bit(constant_bits[i]);
        var andNot = bits[i].issub(bits[i].icmult(constant_bits[i]));

        // save and update borrow
        diff = xor.isxor_bit(borrow, op_id + ':sxor_bit:' + (i - 1));
        borrow = xor.inot().ismult(borrow, op_id + ':smult:' + (i - 1));
        borrow = borrow.isadd(andNot);
      } else {
        // andNot is zero and xor is equal to the constant bit since secret bit is always zero here.
        diff = borrow.icxor_bit(constant_bits[i]);
        borrow = borrow.icmult(constant_bits[i] === 1 ? 0 : 1);
      }

      diff.wThen(deferreds[i].resolve);
      return borrow;
    });

    return result;
  },
  /**
   *
   * Compute [secret bits1] + [secret bits2]
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
      op_id = jiff.counters.gen_op_id('bits.sadd', bits1[0].holders);
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

    var sum = bits1[0].isxor_bit(bits2[0], op_id + ':sxor_bit:initial');
    var carry = bits1[0].ismult(bits2[0], op_id + ':smult:initial');

    // put initial bit at head of result array
    result.unshift(sum);
    deferreds.unshift(null);

    // compute sum one bit at a time, propagating carry
    jiff.utils.bit_combinator(deferreds[deferreds.length - 1], 1, deferreds.length - 1, carry, function (i, carry) {
      var sum;
      if (i < bits2.length) {
        var and = bits1[i].ismult(bits2[i], op_id + ':smult1:' + (i - 1));
        var xor = bits1[i].isxor_bit(bits2[i], op_id + ':sxor_bit1:' + (i - 1));
        var xorAndCarry = xor.ismult(carry, op_id + ':smult2:' + (i - 1));

        sum = xor.isxor_bit(carry, op_id + ':sxor_bit2:' + (i - 1));
        carry = and.isadd(xorAndCarry); // cheap or, xor and and cannot both be true!
      } else {
        // and is always zero, xor is equal to bits1[i]
        sum = bits1[i].isxor_bit(carry, op_id + ':sxor_bit1:' + (i - 1));
        carry = bits1[i].ismult(carry, op_id + ':smult1:' + (i - 1));
      }

      sum.wThen(deferreds[i].resolve);
      return carry;
    });

    return result;
  },
  /**
   * Compute [secret bits1] - [secret bits2]
   * @function ssub
   * @ignore
   * @param {module:jiff-client~JIFFClient} jiff - the jiff client instance
   * @param {module:jiff-client~JIFFClient#SecretShare[]} bits1 - first bitwise secret shared number: lower indices represent less significant bits
   * @param {module:jiff-client~JIFFClient#SecretShare[]} bits2 - second bitwise secret shared number (length may be different)
   * @param {string} [op_id=<auto-generate-id>] - the base operation id to use when generating unique ids for communication.
   *                                              default value should suffice when the code of all parties executes all instructions
   *                                              in the same exact order, otherwise, a unique base name is needed here
   * @returns {module:jiff-client~JIFFClient#SecretShare[]} bitwise sharing of the result. Note that the length of the returned result is |bits|+1, where
   *                          the bit at index 0 is the least significant bit. The bit at index 1 is the most significant bit,
   *                          and the bit at index |bits| is 1 if the result overflows, or 0 otherwise
   */
  ssub: function (jiff, bits1, bits2, op_id) {
    if (op_id == null) {
      op_id = jiff.counters.gen_op_id('bits.ssub', bits1[0].holders);
    }

    // copy to avoid aliasing problems during execution
    bits1 = bits1.slice();
    bits2 = bits2.slice();

    // initialize results
    var result = jiff.utils.many_secret_shares(Math.max(bits1.length, bits2.length), bits1[0].holders, Math.max(bits1[0].threshold, bits2[0].threshold), bits1[0].Zp);
    var deferreds = result.deferreds;
    result = result.shares;

    var diff = bits1[0].isxor_bit(bits2[0], op_id + ':sxor_bit:initial');
    var borrow = bits1[0].inot().ismult(bits2[0], op_id + ':smult:initial');

    // put initial bit at head of result array
    result.unshift(diff);
    deferreds.unshift(null);

    // compute diff one bit at a time, propagating borrow
    jiff.utils.bit_combinator(deferreds[deferreds.length - 1], 1, deferreds.length - 1, borrow, function (i, borrow) {
      var diff;
      if (i < bits1.length && i < bits2.length) {
        var xor = bits1[i].isxor_bit(bits2[i], op_id + ':sxor_bit1:' + (i - 1));
        var andNot = bits1[i].inot().ismult(bits2[i], op_id + ':smult1:' + (i - 1));

        // save and update borrow
        diff = xor.isxor_bit(borrow, op_id + ':sxor_bit2:' + (i - 1));
        borrow = xor.inot().ismult(borrow, op_id + ':smult2:' + (i - 1));
        borrow = borrow.isadd(andNot);
      } else if (i < bits1.length) {
        // xor is equal to the value of bits1[i], andNot is equal to 0, since bits[2] is all zeros here
        diff = bits1[i].isxor_bit(borrow, op_id + ':sxor_bit1:' + (i - 1));
        borrow = bits1[i].inot().ismult(borrow, op_id + ':smult1:' + (i - 1));
      } else { // i < bits2.length
        // xor and andNot are equal to the value of bits2[i]
        diff = bits2[i].isxor_bit(borrow, op_id + ':sxor_bit1:' + (i - 1));
        borrow = bits2[i].inot().ismult(borrow, op_id + ':smult1:' + (i - 1));
        borrow = borrow.isadd(bits2[i]);
      }

      diff.wThen(deferreds[i].resolve);
      return borrow;
    });

    return result;
  },
  /**
   * Compute [secret bits] * constant
   * @function cmult
   * @ignore
   * @param {module:jiff-client~JIFFClient} jiff - the jiff client instance
   * @param {module:jiff-client~JIFFClient#SecretShare[]} bits - bitwise shared secret to multiply: lower indices represent less significant bits
   * @param {number} constant - constant to multiply with
   * @param {string} [op_id=<auto-generate-id>] - the base operation id to use when generating unique ids for communication.
   *                                              default value should suffice when the code of all parties executes all instructions
   *                                              in the same exact order, otherwise, a unique base name is needed here
   * @returns {module:jiff-client~JIFFClient#SecretShare[]} bitwise sharing of the result, the length of the result will be bits.length + ceil(log2(constant)), except
   *                          if constant is zero, the result will then be [ zero share ]
   */
  cmult: function (jiff, bits, constant, op_id) {
    if (!(bits[0].isConstant(constant))) {
      throw new Error('parameter should be a number (bits.cmult)');
    }
    if (op_id == null) {
      op_id = jiff.counters.gen_op_id('bits.cmult', bits[0].holders);
    }

    // copy to avoid aliasing problems during execution
    bits = bits.slice();

    // decompose constant into bits
    var constant_bits = jiff.helpers.number_to_bits(constant); // do not pad

    // Initialize the result
    var result = jiff.utils.many_secret_shares(bits.length + constant_bits.length, bits[0].holders, bits[0].threshold, bits[0].Zp);
    var deferreds = result.deferreds;
    result = result.shares;

    // Resolve result when ready
    var final_deferred = new jiff.helpers.Deferred();
    final_deferred.promise.then(jiff.utils.resolve_many_secrets.bind(null, deferreds));

    // get useless share of zero (just for padding)
    var zero = new jiff.SecretShare(0, bits[0].holders, bits[0].threshold, bits[0].Zp);
    var initial = [zero];

    // special case
    if (constant.toString() === '0') {
      return initial;
    }

    // main function
    jiff.utils.bit_combinator(final_deferred, 0, constant_bits.length, initial, function (i, intermediate) {
      // Shift bits to create the intermediate values,
      // and sum if the corresponding bit in a is 1
      if (constant_bits[i].toString() === '1') {
        intermediate = jiff.protocols.bits.sadd(intermediate, bits, op_id + ':bits.sadd:' + i);
      }

      bits.unshift(zero);
      return intermediate;
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
  },
  /**
   * Compute [secret bits1] * [secret bits2]
   * @function smult
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
      op_id = jiff.counters.gen_op_id('bits.smult', bits1[0].holders);
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
        bit_mult[j] = this_bit.iif_else(bits1[j], 0, op_id + ':if_else:' + i + ':' + j);
      }
      bits1.unshift(0); // increase magnitude

      if (i === 0) {
        return bit_mult;
      }

      return jiff.protocols.bits.sadd(intermediate, bit_mult, op_id + ':bits.sadd:' + i);
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
  },
  /**
   * Computes integer division of [secret bits 1] / [secret bits 2]
   * @function sdiv
   * @ignore
   * @param {module:jiff-client~JIFFClient} jiff - the jiff client instance
   * @param {module:jiff-client~JIFFClient#SecretShare[]} bits1 - an array of secret shares of bits, starting from least to most significant bits
   * @param {module:jiff-client~JIFFClient#SecretShare[]} bits2 - the second bitwise shared number
   * @param {string} [op_id=<auto-generate-id>] - the base operation id to use when generating unique ids for multiplications
   *                                              default value should suffice when the code of all parties executes all instructions
   *                                              in the same exact order, otherwise, a unique base name is needed here
   * @returns {{quotient: module:jiff-client~JIFFClient#SecretShare[], remainder: module:jiff-client~JIFFClient#SecretShare[]}} the quotient and remainder bits arrays, note that
   *                                                                the quotient array has the same length as bits1,
   *                                                                and the remainder array has the same length as bits2 or bits1, whichever is smaller.
   *                                                                Note: if bits2 represent 0, the returned result is the maximum
   *                                                                number that fits in the number of bits (all 1), and the remainder
   *                                                                is equal to bits1
   */
  sdiv: function (jiff, bits1, bits2, op_id) {
    if (op_id == null) {
      op_id = jiff.counters.gen_op_id('bits.sdiv', bits1[0].holders);
    }

    // copy to avoid aliasing problems during execution
    bits1 = bits1.slice();
    bits2 = bits2.slice();

    // Initialize the result
    var quotient = jiff.utils.many_secret_shares(bits1.length, bits1[0].holders, Math.max(bits1[0].threshold, bits2[0].threshold), bits1[0].Zp);
    var quotientDeferreds = quotient.deferreds;
    quotient = quotient.shares;

    var remainder = jiff.utils.many_secret_shares(Math.min(bits1.length, bits2.length), bits1[0].holders, Math.max(bits1[0].threshold, bits2[0].threshold), bits1[0].Zp);
    var remainderDeferreds = remainder.deferreds;
    remainder = remainder.shares;

    // Resolve result when ready
    var final_deferred = new jiff.helpers.Deferred();
    final_deferred.promise.then(function (result) {
      jiff.utils.resolve_many_secrets(remainderDeferreds, result);
    });

    var initial = []; // initial remainder
    jiff.utils.bit_combinator(final_deferred, bits1.length - 1, -1, initial, function (i, _remainder) {
      var iterationCounter = (bits1.length - i - 1);

      // add bit i to the head of remainder (least significant bit)
      _remainder.unshift(bits1[i]);

      // Get the next bit of the quotient
      // and conditionally subtract b from the
      // intermediate remainder to continue
      var sub = jiff.protocols.bits.ssub(_remainder, bits2, op_id + ':bits.ssub:' + iterationCounter);
      var noUnderflow = sub.pop().inot(); // get the overflow bit, sub is now the result of subtraction

      // Get next bit of quotient
      noUnderflow.wThen(quotientDeferreds[i].resolve);

      // Update remainder
      for (var j = 0; j < _remainder.length; j++) {
        // note, if noUnderflow, then |# bits in sub| <= |# bits in remainder|
        _remainder[j] = noUnderflow.iif_else(sub[j], _remainder[j], op_id + ':if_else:' + iterationCounter + ':' + j);
      }

      // Remainder cannot be greater than divisor at this point
      while (_remainder.length > remainder.length) {
        _remainder.pop();
      }

      return _remainder;
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

    return {quotient: quotient, remainder: remainder}
  },
  /**
   * Computes integer division of [secret bits] / constant
   * @function cdivl
   * @ignore
   * @param {module:jiff-client~JIFFClient} jiff - the jiff client instance
   * @param {module:jiff-client~JIFFClient#SecretShare[]} bits - numerator: an array of secret shares of bits, starting from least to most significant bits
   * @param {number} constant - the denominator number
   * @param {string} [op_id=<auto-generate-id>] - the base operation id to use when generating unique ids for multiplications.
   *                                              default value should suffice when the code of all parties executes all instructions
   *                                              in the same exact order, otherwise, a unique base name is needed here
   * @returns {{quotient: module:jiff-client~JIFFClient#SecretShare[], remainder: module:jiff-client~JIFFClient#SecretShare[]}} the quotient and remainder bits arrays, note that
   *                                                                the quotient array has the same length as bits,
   *                                                                and the remainder array has the same length as
   *                                                                constant or bits, whichever is smaller
   * @throws if constant is 0.
   */
  cdivl: function (jiff, bits, constant, op_id) {
    if (!(bits[0].isConstant(constant))) {
      throw new Error('parameter should be a number (bits.cdivl)');
    }
    if (op_id == null) {
      op_id = jiff.counters.gen_op_id('bits.cdivl', bits[0].holders);
    }

    if (constant.toString() === '0') {
      throw new Error('constant cannot be 0 in bits.cdiv');
    }

    // copy to avoid aliasing problems during execution
    bits = bits.slice();

    // special case, divide by 1
    if (constant.toString() === '1') {
      return {
        quotient: bits,
        remainder: [new jiff.SecretShare(0, bits[0].holders, bits[0].threshold, bits[0].Zp)]
      }
    }

    // Initialize the result
    var quotient = jiff.utils.many_secret_shares(bits.length, bits[0].holders, bits[0].threshold, bits[0].Zp);
    var quotientDeferreds = quotient.deferreds;
    quotient = quotient.shares;

    var constantLessBits = jiff.helpers.ceil(jiff.helpers.bLog(constant, 2));
    constantLessBits = parseInt(constantLessBits.toString(), 10);
    var remainder = jiff.utils.many_secret_shares(Math.min(constantLessBits, bits.length), bits[0].holders, bits[0].threshold, bits[0].Zp);
    var remainderDeferreds = remainder.deferreds;
    remainder = remainder.shares;

    // Resolve result when ready
    var final_deferred = new jiff.helpers.Deferred();
    final_deferred.promise.then(jiff.utils.resolve_many_secrets.bind(null, remainderDeferreds));

    var initial = []; // initial remainder
    jiff.utils.bit_combinator(final_deferred, bits.length - 1, -1, initial, function (i, _remainder) {
      var iterationCounter = (bits.length - i - 1);

      // add bit i to the head of remainder (least significant bit)
      _remainder.unshift(bits[i]);

      // Get the next bit of the quotient
      // and conditionally subtract b from the
      // intermediate remainder to continue
      var sub = jiff.protocols.bits.csubl(_remainder, constant, op_id + ':bits.csubl:' + iterationCounter);
      var noUnderflow = sub.pop().inot(); // get the overflow bit, sub is now the result of subtraction

      // Get next bit of quotient
      noUnderflow.wThen(quotientDeferreds[i].resolve);

      // Update remainder
      for (var j = 0; j < _remainder.length; j++) {
        // note, if noUnderflow, then |# bits in sub| <= |# bits in remainder|
        _remainder[j] = noUnderflow.iif_else(sub[j], _remainder[j], op_id + ':if_else:' + iterationCounter + ':' + j);
      }

      // Remainder cannot be greater than constant at this point
      while (_remainder.length > remainder.length) {
        _remainder.pop();
      }

      return _remainder;
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

    return {quotient: quotient, remainder: remainder};
  },
  /**
   * Computes integer division of constant / [secret bits]
   * @function cdivr
   * @ignore
   * @param {module:jiff-client~JIFFClient} jiff - the jiff client instance
   * @param {number} constant - the numerator number
   * @param {module:jiff-client~JIFFClient#SecretShare[]} bits - denominator: an array of secret shares of bits, starting from least to most significant bits
   * @param {string} [op_id=<auto-generate-id>] - the base operation id to use when generating unique ids for multiplications.
   *                                              default value should suffice when the code of all parties executes all instructions
   *                                              in the same exact order, otherwise, a unique base name is needed here
   * @returns {{quotient: module:jiff-client~JIFFClient#SecretShare[], remainder: module:jiff-client~JIFFClient#SecretShare[]}} the quotient and remainder bits arrays, note that
   *                                                                the quotient array has the same length as the number of bits in constant,
   *                                                                and the remainder array has the same length as bits or constant, whichever is smaller.
   *                                                                Note: if bits represent 0, the returned result is the maximum
   *                                                                number that fits in its bits (all 1), and the remainder
   *                                                                is equal to constant
   */
  cdivr: function (jiff, constant, bits, op_id) {
    if (!(bits[0].isConstant(constant))) {
      throw new Error('parameter should be a number (bits.cdivr)');
    }
    if (op_id == null) {
      op_id = jiff.counters.gen_op_id('bits.cdivr', bits[0].holders);
    }

    // copy to avoid aliasing problems during execution
    bits = bits.slice();

    // do not pad
    var constant_bits = jiff.helpers.number_to_bits(constant);

    // Initialize the result
    var quotient = jiff.utils.many_secret_shares(constant_bits.length, bits[0].holders, bits[0].threshold, bits[0].Zp);
    var quotientDeferreds = quotient.deferreds;
    quotient = quotient.shares;

    var remainder = jiff.utils.many_secret_shares(Math.min(constant_bits.length, bits.length), bits[0].holders, bits[0].threshold, bits[0].Zp);
    var remainderDeferreds = remainder.deferreds;
    remainder = remainder.shares;

    // Resolve result when ready
    var final_deferred = new jiff.helpers.Deferred();
    final_deferred.promise.then(jiff.utils.resolve_many_secrets.bind(null, remainderDeferreds));

    var initial = []; // initial remainder
    jiff.utils.bit_combinator(final_deferred, constant_bits.length - 1, -1, initial, function (i, _remainder) {
      var iterationCounter = (constant_bits.length - i - 1);

      // add bit i to the head of remainder (least significant bit)
      // turn into a secret without communication, just for typing
      var cbit_share = new jiff.SecretShare(constant_bits[i], bits[0].holders, bits[0].threshold, bits[0].Zp);
      _remainder.unshift(cbit_share);

      // Get the next bit of the quotient
      // and conditionally subtract b from the
      // intermediate remainder to continue
      var sub = jiff.protocols.bits.ssub(_remainder, bits, op_id + ':bits.ssub:' + iterationCounter);
      var noUnderflow = sub.pop().inot(); // get the overflow bit, sub is now the result of subtraction

      // Get next bit of quotient
      noUnderflow.wThen(quotientDeferreds[i].resolve);

      // Update remainder
      for (var j = 0; j < _remainder.length; j++) {
        // note, if noUnderflow, then |# bits in sub| <= |# bits in remainder|
        _remainder[j] = noUnderflow.iif_else(sub[j], _remainder[j], op_id + ':if_else:' + iterationCounter + ':' + j);
      }

      // cannot be bigger than divisor at this point
      while (_remainder.length > remainder.length) {
        _remainder.pop();
      }

      return _remainder;
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

    return {quotient: quotient, remainder: remainder};
  }
};