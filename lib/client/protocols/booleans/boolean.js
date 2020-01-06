/**
 * bitwise-XOR with a constant (BOTH BITS).
 * @method cxor_bit
 * @param {number} cst - the constant bit to XOR with (0 or 1).
 * @return {SecretShare} this party's share of the result.
 * @memberof SecretShare
 * @instance
 */
self.cxor_bit = function (cst) {
  if (!(self.isConstant(cst))) {
    throw new Error('parameter should be a number (^)');
  }
  if (!share_helpers['binary'](cst)) {
    throw new Error('parameter should be binary (^)');
  }

  return self.icadd(cst).issub(self.icmult(cst).icmult(2));
};

/**
 * bitwise-OR with a constant (BOTH BITS).
 * @method cor_bit
 * @param {number} cst - the constant bit to OR with (0 or 1).
 * @return {SecretShare} this party's share of the result.
 * @memberof SecretShare
 * @instance
 */
self.cor_bit = function (cst) {
  if (!(self.isConstant(cst))) {
    throw new Error('parameter should be a number (|)');
  }
  if (!share_helpers['binary'](cst)) {
    throw new Error('parameter should be binary (|)');
  }

  return self.icadd(cst).issub(self.icmult(cst));
};

/**
 * bitwise-XOR of two secret shares OF BITS.
 * @method sxor_bit
 * @param {SecretShare} o - the share to XOR with.
 * @param {string} [op_id=auto_gen()] - the operation id which is used to identify this operation.
 *                         This id must be unique, and must be passed by all parties to the same instruction, to
 *                         ensure that corresponding instructions across different parties are matched correctly.
 * @return {SecretShare} this party's share of the result, the final result is 1 if this < o, and 0 otherwise.
 * @return {SecretShare} this party's share of the result.
 * @memberof SecretShare
 * @instance
 */
self.sxor_bit = function (o, op_id) {
  if (!(o.jiff === self.jiff)) {
    throw new Error('shares do not belong to the same instance (^)');
  }
  if (!self.jiff.helpers.Zp_equals(self, o)) {
    throw new Error('shares must belong to the same field (^)');
  }
  if (!self.jiff.helpers.array_equals(self.holders, o.holders)) {
    throw new Error('shares must be held by the same parties (^)');
  }
  if (op_id == null) {
    op_id = self.jiff.counters.gen_op_id('sxor_bit', self.holders);
  }

  return self.isadd(o).issub(self.ismult(o, op_id + ':smult1').icmult(2));
};

/**
 * OR of two secret shares OF BITS.
 * @method sor_bit
 * @param {SecretShare} o - the share to OR with.
 * @param {string} [op_id=auto_gen()] - the operation id which is used to identify this operation.
 *                         This id must be unique, and must be passed by all parties to the same instruction, to
 *                         ensure that corresponding instructions across different parties are matched correctly.
 * @return {SecretShare} this party's share of the result, the final result is 1 if this < o, and 0 otherwise.
 * @return {SecretShare} this party's share of the result.
 * @memberof SecretShare
 * @instance
 */
self.sor_bit = function (o, op_id) {
  if (!(o.jiff === self.jiff)) {
    throw new Error('shares do not belong to the same instance (|)');
  }
  if (!self.jiff.helpers.Zp_equals(self, o)) {
    throw new Error('shares must belong to the same field (|)');
  }
  if (!self.jiff.helpers.array_equals(self.holders, o.holders)) {
    throw new Error('shares must be held by the same parties (|)');
  }
  if (op_id == null) {
    op_id = self.jiff.counters.gen_op_id('sor_bit', self.holders);
  }

  return self.isadd(o).issub(self.ismult(o, op_id + ':smult1'));
};

/**
 * Negation of a bit.
 * This has to be a share of a BIT in order for this to work properly.
 * @method not
 * @return {SecretShare} this party's share of the result (negated bit).
 * @memberof SecretShare
 * @instance
 */
self.not = function () {
  return self.icmult(-1).icadd(1);
};

/**
 * Simulate an oblivious If-else statement with a single return value.
 * Should be called on a secret share of a bit: 0 representing false, and 1 representing true
 * If this is a share of 1, a new sharing of the element represented by the first parameter is returned,
 * otherwise, a new sharing of the second is returned.
 * @method if_else
 * @memberof SecretShare
 * @instance
 * @param {SecretShare|constant} trueVal - the value/share to return if this is a sharing of 1.
 * @param {SecretShare|constant} falseVal - the value/share to return if this is a sharing of 0.
 * @param {string} [op_id=auto_gen()] - the operation id which is used to identify this operation.
 *                         This id must be unique, and must be passed by all parties to the same instruction, to
 *                         ensure that corresponding instructions across different parties are matched correctly.
 * @return {SecretShare} a new sharing of the result of the if.
 *
 * @example
 * // a and b are secret shares
 * // cmp will be a secret share of either 1 or 0, depending on whether a or b is greater
 * var cmp = a.gt(b);
 *
 * // max is set to the greater value, without revealing the value or the result of the inequality
 * var max = cmp.if_else(a, b);
 */
self.if_else = function (trueVal, falseVal, op_id) {
  if (op_id == null) {
    op_id = self.jiff.counters.gen_op_id('if_else', self.holders);
  }

  var const1 = self.isConstant(trueVal);
  var const2 = self.isConstant(falseVal);
  if (const1 && const2) {
    return self.icmult(trueVal).isadd(self.inot().icmult(falseVal));
  } else if (const1) {
    return self.inot().ismult(falseVal.icsub(trueVal), op_id + ':smult').icadd(trueVal);
  } else if (const2) {
    return self.ismult(trueVal.icsub(falseVal), op_id + ':smult').icadd(falseVal);
  } else {
    return self.ismult(trueVal.issub(falseVal), op_id + ':smult').isadd(falseVal);
  }
};