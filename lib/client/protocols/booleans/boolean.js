// Generic version of operations
module.exports = function (SecretShare) {
  /**
   * bitwise-XOR with a constant (BOTH BITS).
   * @method cxor_bit
   * @param {number} cst - the constant bit to XOR with (0 or 1).
   * @return {module:jiff-client~JIFFClient#SecretShare} this party's share of the result.
   * @memberof module:jiff-client~JIFFClient#SecretShare
   * @instance
   */
  SecretShare.prototype.cxor_bit = function (cst) {
    if (!(this.isConstant(cst))) {
      throw new Error('parameter should be a number (^)');
    }
    if (!this.jiff.share_helpers['binary'](cst)) {
      throw new Error('parameter should be binary (^)');
    }

    return this.icadd(cst).issub(this.icmult(cst).icmult(2));
  };

  /**
   * bitwise-OR with a constant (BOTH BITS).
   * @method cor_bit
   * @param {number} cst - the constant bit to OR with (0 or 1).
   * @return {module:jiff-client~JIFFClient#SecretShare} this party's share of the result.
   * @memberof module:jiff-client~JIFFClient#SecretShare
   * @instance
   */
  SecretShare.prototype.cor_bit = function (cst) {
    if (!(this.isConstant(cst))) {
      throw new Error('parameter should be a number (|)');
    }
    if (!this.jiff.share_helpers['binary'](cst)) {
      throw new Error('parameter should be binary (|)');
    }

    return this.icadd(cst).issub(this.icmult(cst));
  };

  /**
   * bitwise-XOR of two secret shares OF BITS.
   * @method sxor_bit
   * @param {module:jiff-client~JIFFClient#SecretShare} o - the share to XOR with.
   * @param {string} [op_id=auto_gen()] - the operation id which is used to identify this operation.
   *                         This id must be unique, and must be passed by all parties to the same instruction, to
   *                         ensure that corresponding instructions across different parties are matched correctly.
   * @return {module:jiff-client~JIFFClient#SecretShare} this party's share of the result, the final result is 1 if this < o, and 0 otherwise.
   * @return {module:jiff-client~JIFFClient#SecretShare} this party's share of the result.
   * @memberof module:jiff-client~JIFFClient#SecretShare
   * @instance
   */
  SecretShare.prototype.sxor_bit = function (o, op_id) {
    if (!(o.jiff === this.jiff)) {
      throw new Error('shares do not belong to the same instance (^)');
    }
    if (!this.jiff.helpers.Zp_equals(this, o)) {
      throw new Error('shares must belong to the same field (^)');
    }
    if (!this.jiff.helpers.array_equals(this.holders, o.holders)) {
      throw new Error('shares must be held by the same parties (^)');
    }
    if (op_id == null) {
      op_id = this.jiff.counters.gen_op_id('sxor_bit', this.holders);
    }

    return this.isadd(o).issub(this.ismult(o, op_id + ':smult1').icmult(2));
  };

  /**
   * OR of two secret shares OF BITS.
   * @method sor_bit
   * @param {module:jiff-client~JIFFClient#SecretShare} o - the share to OR with.
   * @param {string} [op_id=auto_gen()] - the operation id which is used to identify this operation.
   *                         This id must be unique, and must be passed by all parties to the same instruction, to
   *                         ensure that corresponding instructions across different parties are matched correctly.
   * @return {module:jiff-client~JIFFClient#SecretShare} this party's share of the result, the final result is 1 if this < o, and 0 otherwise.
   * @return {module:jiff-client~JIFFClient#SecretShare} this party's share of the result.
   * @memberof module:jiff-client~JIFFClient#SecretShare
   * @instance
   */
  SecretShare.prototype.sor_bit = function (o, op_id) {
    if (!(o.jiff === this.jiff)) {
      throw new Error('shares do not belong to the same instance (|)');
    }
    if (!this.jiff.helpers.Zp_equals(this, o)) {
      throw new Error('shares must belong to the same field (|)');
    }
    if (!this.jiff.helpers.array_equals(this.holders, o.holders)) {
      throw new Error('shares must be held by the same parties (|)');
    }
    if (op_id == null) {
      op_id = this.jiff.counters.gen_op_id('sor_bit', this.holders);
    }

    return this.isadd(o).issub(this.ismult(o, op_id + ':smult1'));
  };

  /**
   * Negation of a bit.
   * This has to be a share of a BIT in order for this to work properly.
   * @method not
   * @return {module:jiff-client~JIFFClient#SecretShare} this party's share of the result (negated bit).
   * @memberof module:jiff-client~JIFFClient#SecretShare
   * @instance
   */
  SecretShare.prototype.not = function () {
    return this.icmult(-1).icadd(1);
  };

  /**
   * Simulate an oblivious If-else statement with a single return value.
   * Should be called on a secret share of a bit: 0 representing false, and 1 representing true
   * If this is a share of 1, a new sharing of the element represented by the first parameter is returned,
   * otherwise, a new sharing of the second is returned.
   * @method if_else
   * @memberof module:jiff-client~JIFFClient#SecretShare
   * @instance
   * @param {module:jiff-client~JIFFClient#SecretShare | number} trueVal - the value/share to return if this is a sharing of 1.
   * @param {module:jiff-client~JIFFClient#SecretShare | number} falseVal - the value/share to return if this is a sharing of 0.
   * @param {string} [op_id=auto_gen()] - the operation id which is used to identify this operation.
   *                         This id must be unique, and must be passed by all parties to the same instruction, to
   *                         ensure that corresponding instructions across different parties are matched correctly.
   * @return {module:jiff-client~JIFFClient#SecretShare} a new sharing of the result of the if.
   *
   * @example
   * // a and b are secret shares
   * // cmp will be a secret share of either 1 or 0, depending on whether a or b is greater
   * var cmp = a.gt(b);
   *
   * // max is set to the greater value, without revealing the value or the result of the inequality
   * var max = cmp.if_else(a, b);
   */
  SecretShare.prototype.if_else = function (trueVal, falseVal, op_id) {
    if (op_id == null) {
      op_id = this.jiff.counters.gen_op_id('if_else', this.holders);
    }

    var const1 = this.isConstant(trueVal);
    var const2 = this.isConstant(falseVal);
    if (const1 && const2) {
      return this.icmult(trueVal).isadd(this.inot().icmult(falseVal));
    } else if (const1) {
      return this.inot().ismult(falseVal.icsub(trueVal), op_id + ':smult').icadd(trueVal);
    } else if (const2) {
      return this.ismult(trueVal.icsub(falseVal), op_id + ':smult').icadd(falseVal);
    } else {
      return this.ismult(trueVal.issub(falseVal), op_id + ':smult').isadd(falseVal);
    }
  };
};