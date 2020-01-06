/**
 * Checks whether the given bitwise secret shared number and numeric constant are equal.
 * @method ceq
 * @memberof jiff-instance.protocols.bits
 * @instance
 * @param {SecretShare[]} bits - an array of secret shares of bits, starting from least to most significant bits.
 * @param {number} constant - the constant number.
 * @param {string} [op_id=<auto-generate-id>] - the base operation id to use when generating unique ids for multiplications.
 *                                              default value should suffice when the code of all parties executes all instructions
 *                                              in the same exact order, otherwise, a unique base name is needed here.
 * @returns {SecretShare|boolean} a secret share of 1 if parameters are equal, 0 otherwise. If result is known
 *                                (e.g. constant has a greater non-zero bit than bits' most significant bit), the result is
 *                                returned immediately as a boolean.
 */
jiff.protocols.bits.ceq = function (bits, constant, op_id) {
  if (!(bits[0].isConstant(constant))) {
    throw new Error('parameter should be a number (bits.ceq)');
  }
  if (op_id == null) {
    op_id = jiff.counters.gen_op_id('bits.ceq', bits[0].holders);
  }
  var result = jiff.protocols.bits.cneq(bits, constant, op_id);
  if (result === true || result === false) {
    return !result;
  }
  return result.inot();
};

/**
 * Checks whether the given bitwise secret shared number and numeric constant are not equal.
 * @method cneq
 * @memberof jiff-instance.protocols.bits
 * @instance
 * @param {SecretShare[]} bits - an array of secret shares of bits, starting from least to most significant bits.
 * @param {number} constant - the constant number.
 * @param {string} [op_id=<auto-generate-id>] - the base operation id to use when generating unique ids for multiplications.
 *                                              default value should suffice when the code of all parties executes all instructions
 *                                              in the same exact order, otherwise, a unique base name is needed here.
 * @returns {SecretShare|boolean} a secret share of 1 if parameters are not equal, 0 otherwise. If result is known
 *                                (e.g. constant has a greater non-zero bit than bits' most significant bit), the result is
 *                                returned immediately as a boolean.
 */
jiff.protocols.bits.cneq = function (bits, constant, op_id) {
  if (!(bits[0].isConstant(constant))) {
    throw new Error('parameter should be a number (bits.cneq)');
  }

  if (op_id == null) {
    op_id = jiff.counters.gen_op_id('bits.cneq', bits[0].holders);
  }

  // copy to avoid aliasing problems during execution
  bits = bits.slice();

  var constant_bits = jiff.helpers.number_to_bits(constant, bits.length);
  if (constant_bits.length > bits.length) {
    // Optimization: if constant has more bits, one of them must be 1, constant must be greater than bits.
    return true;
  }

  var deferred = new jiff.helpers.Deferred();
  var result = jiff.secret_share(jiff, false, deferred.promise, undefined, bits[0].holders, bits[0].threshold, bits[0].Zp);

  // big or of bitwise XORs
  var initial = bits[0].icxor_bit(constant_bits[0]);
  bit_combinator(deferred, 1, bits.length, initial, function (i, prev) {
    var xor = bits[i].icxor_bit(constant_bits[i]);
    xor = prev.isor_bit(xor, op_id + ':sor_bit:' + (i - 1));
    return xor;
  });

  return result;
};

/**
 * Checks whether given secret shared bits are greater than the given constant.
 * @method cgt
 * @memberof jiff-instance.protocols.bits
 * @instance
 * @param {SecretShare[]} bits - an array of the secret shares of bits, starting from least to most significant bits.
 * @param {number} constant - the constant number.
 * @param {string} [op_id=<auto-generate-id>] - the base operation id to use when generating unique ids for multiplications.
 *                                              default value should suffice when the code of all parties executes all instructions
 *                                              in the same exact order, otherwise, a unique base name is needed here.
 * @returns {SecretShare|boolean} a secret share of 1 if bits are greater than constant, 0 otherwise, if result is known
 *                                (e.g. constant has greater non-zero bit than bits' most significant bit), the result is
 *                                returned immediately as a boolean.
 */
jiff.protocols.bits.cgt = function (bits, constant, op_id) {
  if (!(bits[0].isConstant(constant))) {
    throw new Error('parameter should be a number (bits.cgt)');
  }
  if (op_id == null) {
    op_id = jiff.counters.gen_op_id('bits.cgt', bits[0].holders);
  }
  return jiff.protocols.bits.cgteq(bits, constant+1, op_id);
};

/**
 * Checks whether given secret shared bits are greater or equal to the given constant.
 * @method cgteq
 * @memberof jiff-instance.protocols.bits
 * @instance
 * @param {SecretShare[]} bits - an array of the secret shares of bits, starting from least to most significant bits.
 * @param {number} constant - the constant number.
 * @param {string} [op_id=<auto-generate-id>] - the base operation id to use when generating unique ids for multiplications.
 *                                              default value should suffice when the code of all parties executes all instructions
 *                                              in the same exact order, otherwise, a unique base name is needed here.
 * @returns {SecretShare|boolean} a secret share of 1 if bits are greater or equal to constant, 0 otherwise, if result is known
 *                                (e.g. constant has greater non-zero bit than bits' most significant bit or constant is zero), the result is
 *                                returned immediately as a boolean.
 */
jiff.protocols.bits.cgteq = function (bits, constant, op_id) {
  if (!(bits[0].isConstant(constant))) {
    throw new Error('parameter should be a number (bits.cgteq)');
  }

  if (op_id == null) {
    op_id = jiff.counters.gen_op_id('bits.cgteq', bits[0].holders);
  }

  // copy to avoid aliasing problems during execution
  bits = bits.slice();

  // Optimization: the bits are a share of non-negative number, if constant <= 0, return true
  if (constant.toString().startsWith('-') || constant.toString() === '0') {
    return true;
  }

  // decompose result into bits
  var constant_bits = jiff.helpers.number_to_bits(constant, bits.length);
  if (constant_bits.length > bits.length) {
    // Optimization: if constant has more bits, one of them must be 1, constant must be greater than bits.
    return false;
  }

  // initialize result
  var deferred = new jiff.helpers.Deferred();
  var result = jiff.secret_share(jiff, false, deferred.promise, undefined, bits[0].holders, bits[0].threshold, bits[0].Zp);

  // Subtract bits2 from bits1, only keeping track of borrow
  var borrow = bits[0].inot().icmult(constant_bits[0]);

  // compute one bit at a time, propagating borrow
  bit_combinator(deferred, 1, bits.length, borrow, function (i, borrow) {
    var xor = bits[i].icxor_bit(constant_bits[i]);
    var andNot = bits[i].inot().icmult(constant_bits[i]);

    // save and update borrow
    borrow = xor.inot().ismult(borrow, op_id + ':smult:' + (i - 1));
    return borrow.isadd(andNot);
  });

  return result.inot();
};

/**
 * Checks whether given secret shared bits are less than the given constant.
 * @method clt
 * @memberof jiff-instance.protocols.bits
 * @instance
 * @param {SecretShare[]} bits - an array of the secret shares of bits, starting from least to most significant bits.
 * @param {number} constant - the constant number.
 * @param {string} [op_id=<auto-generate-id>] - the base operation id to use when generating unique ids for multiplications.
 *                                              default value should suffice when the code of all parties executes all instructions
 *                                              in the same exact order, otherwise, a unique base name is needed here.
 * @returns {SecretShare|boolean} a secret share of 1 if bits are less than the constant, 0 otherwise, if result is known
 *                                (e.g. constant has greater non-zero bit than bits' most significant bit), the result is
 *                                returned immediately as a boolean.
 */
jiff.protocols.bits.clt = function (bits, constant, op_id) {
  if (!(bits[0].isConstant(constant))) {
    throw new Error('parameter should be a number (bits.clt)');
  }
  if (op_id == null) {
    op_id = jiff.counters.gen_op_id('bits.clt', bits[0].holders);
  }
  var result = jiff.protocols.bits.cgteq(bits, constant, op_id);
  if (result === true || result === false) {
    return !result;
  }
  return result.inot();
};

/**
 * Checks whether given secret shared bits are less or equal to the given constant.
 * @method clteq
 * @memberof jiff-instance.protocols.bits
 * @instance
 * @param {SecretShare[]} bits - an array of the secret shares of bits, starting from least to most significant bits.
 * @param {number} constant - the constant number.
 * @param {string} [op_id=<auto-generate-id>] - the base operation id to use when generating unique ids for multiplications.
 *                                              default value should suffice when the code of all parties executes all instructions
 *                                              in the same exact order, otherwise, a unique base name is needed here.
 * @returns {SecretShare|boolean} a secret share of 1 if bits are less or equal to constant, 0 otherwise, if result is known
 *                                (e.g. constant has greater non-zero bit than bits' most significant bit), the result is
 *                                returned immediately as a boolean.
 */
jiff.protocols.bits.clteq = function (bits, constant, op_id) {
  if (!(bits[0].isConstant(constant))) {
    throw new Error('parameter should be a number (bits.clteq)');
  }
  if (op_id == null) {
    op_id = jiff.counters.gen_op_id('bits.clteq', bits[0].holders);
  }
  var result = jiff.protocols.bits.cgt(bits, constant, op_id);
  if (result === true || result === false) {
    return !result;
  }
  return result.inot();
};

/**
 * Checks whether the two given bitwise secret shared numbers are equal.
 * @method seq
 * @memberof jiff-instance.protocols.bits
 * @instance
 * @param {SecretShare[]} bits1 - an array of secret shares of bits, starting from least to most significant bits.
 * @param {SecretShare[]} bits2 - the second bitwise shared number.
 * @param {string} [op_id=<auto-generate-id>] - the base operation id to use when generating unique ids for multiplications.
 *                                              default value should suffice when the code of all parties executes all instructions
 *                                              in the same exact order, otherwise, a unique base name is needed here.
 * @returns {SecretShare} a secret share of 1 if bits are equal, 0 otherwise.
 */
jiff.protocols.bits.seq = function (bits1, bits2, op_id) {
  if (op_id == null) {
    op_id = jiff.counters.gen_op_id('bits.seq', bits1[0].holders);
  }
  return jiff.protocols.bits.sneq(bits1, bits2, op_id).inot();
};

/**
 * Checks whether the two given bitwise secret shared numbers are not equal.
 * @method sneq
 * @memberof jiff-instance.protocols.bits
 * @instance
 * @param {SecretShare[]} bits1 - an array of secret shares of bits, starting from least to most significant bits.
 * @param {SecretShare[]} bits2 - the second bitwise shared number.
 * @param {string} [op_id=<auto-generate-id>] - the base operation id to use when generating unique ids for multiplications.
 *                                              default value should suffice when the code of all parties executes all instructions
 *                                              in the same exact order, otherwise, a unique base name is needed here.
 * @returns {SecretShare} a secret share of 1 if bits are not equal, 0 otherwise.
 */
jiff.protocols.bits.sneq = function (bits1, bits2, op_id) {
  if (op_id == null) {
    op_id = jiff.counters.gen_op_id('bits.sneq', bits1[0].holders);
  }

  var tmp = bits1.length > bits2.length ? bits1 : bits2;
  bits2 = bits1.length > bits2.length ? bits2 : bits1; // shortest array
  bits1 = tmp; // longest array

  // copy to avoid aliasing problems during execution
  bits1 = bits1.slice();
  bits2 = bits2.slice();

  // initialize result
  var deferred = new jiff.helpers.Deferred();
  var result = jiff.secret_share(jiff, false, deferred.promise, undefined, bits1[0].holders, Math.max(bits1[0].threshold, bits2[0].threshold), bits1[0].Zp);

  // big or of bitwise XORs
  var initial = bits1[0].isxor_bit(bits2[0], op_id + ':sxor_bit:initial');
  bit_combinator(deferred, 1, bits1.length, initial, function (i, prev) {
    var next;
    if (i < bits2.length) {
      var xor = bits1[i].isxor_bit(bits2[i], op_id + ':sxor_bit:' + (i - 1));
      next = prev.isor_bit(xor, op_id + ':sor_bit:' + (i - 1));
    } else {
      // xor is equal to bits1[i] since bits2[i] is zero
      next = prev.isor_bit(bits1[i], op_id + ':sor_bit:' + (i - 1));
    }
    return next;
  });

  return result;
};

/**
 * Checks whether the first given bitwise secret shared number is greater than the second bitwise secret shared number.
 * @method sgt
 * @memberof jiff-instance.protocols.bits
 * @instance
 * @param {SecretShare[]} bits1 - an array of secret shares of bits, starting from least to most significant bits.
 * @param {SecretShare[]} bits2 - the second bitwise shared number.
 * @param {string} [op_id=<auto-generate-id>] - the base operation id to use when generating unique ids for multiplications.
 *                                              default value should suffice when the code of all parties executes all instructions
 *                                              in the same exact order, otherwise, a unique base name is needed here.
 * @returns {SecretShare} a secret share of 1 if the first number is greater than the second, 0 otherwise.
 */
jiff.protocols.bits.sgt = function (bits1, bits2, op_id) {
  if (op_id == null) {
    op_id = jiff.counters.gen_op_id('bits.sgt', bits1[0].holders);
  }

  var gteq = jiff.protocols.bits.sgteq(bits1, bits2, op_id + ':bits.sgteq');
  var neq = jiff.protocols.bits.sneq(bits1, bits2, op_id + ':bits.sneq');
  return gteq.ismult(neq, op_id + ':smult');
};

/**
 * Checks whether the first given bitwise secret shared number is greater than or equal to the second bitwise secret shared number.
 * @method sgteq
 * @memberof jiff-instance.protocols.bits
 * @instance
 * @param {SecretShare[]} bits1 - an array of secret shares of bits, starting from least to most significant bits.
 * @param {SecretShare[]} bits2 - the second bitwise shared number.
 * @param {string} [op_id=<auto-generate-id>] - the base operation id to use when generating unique ids for multiplications.
 *                                              default value should suffice when the code of all parties executes all instructions
 *                                              in the same exact order, otherwise, a unique base name is needed here.
 * @returns {SecretShare} a secret share of 1 if the first number is greater or equal to the second, 0 otherwise.
 */
jiff.protocols.bits.sgteq = function (bits1, bits2, op_id) {
  if (op_id == null) {
    op_id = jiff.counters.gen_op_id('bits.sgteq', bits1[0].holders);
  }

  // copy to avoid aliasing problems during execution
  bits1 = bits1.slice();
  bits2 = bits2.slice();

  // initialize result
  var deferred = new jiff.helpers.Deferred();
  var result = jiff.secret_share(jiff, false, deferred.promise, undefined, bits1[0].holders, Math.max(bits1[0].threshold, bits2[0].threshold), bits1[0].Zp);

  // Subtract bits2 from bits1, only keeping track of borrow
  var borrow = bits1[0].inot().ismult(bits2[0], op_id + ':smult:initial');
  var n = Math.max(bits1.length, bits2.length);
  bit_combinator(deferred, 1, n, borrow, function (i, borrow) {
    if (i < bits1.length && i < bits2.length) {
      var xor = bits1[i].isxor_bit(bits2[i], op_id + ':sxor_bit1:' + (i - 1));
      var andNot = bits1[i].inot().ismult(bits2[i], op_id + ':smult1:' + (i - 1));

      // save and update borrow
      borrow = xor.inot().ismult(borrow, op_id + ':smult2:' + (i - 1));
      borrow = borrow.isadd(andNot);
    } else if (i < bits1.length) {
      // xor is equal to the value of bits1[i], andNot is equal to 0, since bits[2] is all zeros here
      borrow = bits1[i].inot().ismult(borrow, op_id + ':smult1:' + (i - 1));
    } else { // i < bits2.length
      // xor and andNot are equal to the value of bits2[i]
      borrow = bits2[i].inot().ismult(borrow, op_id + ':smult1:' + (i - 1));
      borrow = borrow.isadd(bits2[i]);
    }

    return borrow;
  });

  return result.inot();
};

/**
 * Checks whether the first given bitwise secret shared number is less than the second bitwise secret shared number.
 * @method slt
 * @memberof jiff-instance.protocols.bits
 * @instance
 * @param {SecretShare[]} bits1 - an array of secret shares of bits, starting from least to most significant bits.
 * @param {SecretShare[]} bits2 - the second bitwise shared number.
 * @param {string} [op_id=<auto-generate-id>] - the base operation id to use when generating unique ids for multiplications.
 *                                              default value should suffice when the code of all parties executes all instructions
 *                                              in the same exact order, otherwise, a unique base name is needed here.
 * @returns {SecretShare} a secret share of 1 if the first number is less than the second, 0 otherwise.
 */
jiff.protocols.bits.slt = function (bits1, bits2, op_id) {
  if (op_id == null) {
    op_id = jiff.counters.gen_op_id('bits.slt', bits1[0].holders);
  }
  var result = jiff.protocols.bits.sgteq(bits1, bits2, op_id);
  return result.inot();
};

/**
 * Checks whether the first given bitwise secret shared number is less or equal to the second bitwise secret shared number.
 * @method slteq
 * @memberof jiff-instance.protocols.bits
 * @instance
 * @param {SecretShare[]} bits1 - an array of secret shares of bits, starting from least to most significant bits.
 * @param {SecretShare[]} bits2 - the second bitwise shared number.
 * @param {string} [op_id=<auto-generate-id>] - the base operation id to use when generating unique ids for multiplications.
 *                                              default value should suffice when the code of all parties executes all instructions
 *                                              in the same exact order, otherwise, a unique base name is needed here.
 * @returns {SecretShare} a secret share of 1 if the first number is less than or equal to the second, 0 otherwise.
 */
jiff.protocols.bits.slteq = function (bits1, bits2, op_id) {
  if (op_id == null) {
    op_id = jiff.counters.gen_op_id('bits.slteq', bits1[0].holders);
  }
  var result = jiff.protocols.bits.sgt(bits1, bits2, op_id);
  return result.inot();
};