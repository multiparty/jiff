// Comparison operations on shares
module.exports = function (SecretShare) {
  /**
   * Greater than or equal with another share.
   * @method sgteq
   * @param {module:jiff-client~JIFFClient#SecretShare} o - the other share.
   * @param {string} [op_id=auto_gen()] - the operation id which is used to identify this operation.
   *                         This id must be unique, and must be passed by all parties to the same instruction, to
   *                         ensure that corresponding instructions across different parties are matched correctly.
   * @return {module:jiff-client~JIFFClient#SecretShare} this party's share of the result, the final result is 1 if this >= o, and 0 otherwise.
   * @memberof module:jiff-client~JIFFClient#SecretShare
   * @instance
   */
  SecretShare.prototype.sgteq = function (o, op_id) {
    if (!(o.jiff === this.jiff)) {
      throw new Error('shares do not belong to the same instance (>=)');
    }
    if (!this.jiff.helpers.Zp_equals(this, o)) {
      throw new Error('shares must belong to the same field (>=)');
    }
    if (!this.jiff.helpers.array_equals(this.holders, o.holders)) {
      throw new Error('shares must be held by the same parties (>=)');
    }

    if (op_id == null) {
      op_id = this.jiff.counters.gen_op_id('sgteq', this.holders);
    }

    return this.islt(o, op_id).inot();
  };

  /**
   * Greater than with another share.
   * @method sgt
   * @param {module:jiff-client~JIFFClient#SecretShare} o - the other share.
   * @param {string} [op_id=auto_gen()] - the operation id which is used to identify this operation.
   *                         This id must be unique, and must be passed by all parties to the same instruction, to
   *                         ensure that corresponding instructions across different parties are matched correctly.
   * @return {module:jiff-client~JIFFClient#SecretShare} this party's share of the result, the final result is 1 if this > o, and 0 otherwise.
   * @memberof module:jiff-client~JIFFClient#SecretShare
   * @instance
   */
  SecretShare.prototype.sgt = function (o, op_id) {
    if (!(o.jiff === this.jiff)) {
      throw new Error('shares do not belong to the same instance (>)');
    }
    if (!this.jiff.helpers.Zp_equals(this, o)) {
      throw new Error('shares must belong to the same field (>)');
    }
    if (!this.jiff.helpers.array_equals(this.holders, o.holders)) {
      throw new Error('shares must be held by the same parties (>)');
    }

    if (op_id == null) {
      op_id = this.jiff.counters.gen_op_id('sgt', this.holders);
    }

    return o.islt(this, op_id);
  };

  /**
   * Less than or equal with another share.
   * @method slteq
   * @param {module:jiff-client~JIFFClient#SecretShare} o - the other share.
   * @param {string} [op_id=auto_gen()] - the operation id which is used to identify this operation.
   *                         This id must be unique, and must be passed by all parties to the same instruction, to
   *                         ensure that corresponding instructions across different parties are matched correctly.
   * @return {module:jiff-client~JIFFClient#SecretShare} this party's share of the result, the final result is 1 if this <= o, and 0 otherwise.
   * @memberof module:jiff-client~JIFFClient#SecretShare
   * @instance
   */
  SecretShare.prototype.slteq = function (o, op_id) {
    if (!(o.jiff === this.jiff)) {
      throw new Error('shares do not belong to the same instance (<=)');
    }
    if (!this.jiff.helpers.Zp_equals(this, o)) {
      throw new Error('shares must belong to the same field (<=)');
    }
    if (!this.jiff.helpers.array_equals(this.holders, o.holders)) {
      throw new Error('shares must be held by the same parties (<=)');
    }

    if (op_id == null) {
      op_id = this.jiff.counters.gen_op_id('slteq', this.holders);
    }

    return o.islt(this, op_id).inot();
  };

  /**
   * Less than with another share.
   * @method slt
   * @param {module:jiff-client~JIFFClient#SecretShare} o - the other share.
   * @param {string} [op_id=auto_gen()] - the operation id which is used to identify this operation.
   *                         This id must be unique, and must be passed by all parties to the same instruction, to
   *                         ensure that corresponding instructions across different parties are matched correctly.
   * @return {module:jiff-client~JIFFClient#SecretShare} this party's share of the result, the final result is 1 if this < o, and 0 otherwise.
   * @memberof module:jiff-client~JIFFClient#SecretShare
   * @instance
   */
  SecretShare.prototype.slt = function (o, op_id) {
    if (!(o.jiff === this.jiff)) {
      throw new Error('shares do not belong to the same instance (<)');
    }
    if (!this.jiff.helpers.Zp_equals(this, o)) {
      throw new Error('shares must belong to the same field (<)');
    }
    if (!this.jiff.helpers.array_equals(this.holders, o.holders)) {
      throw new Error('shares must be held by the same parties (<)');
    }

    if (op_id == null) {
      op_id = this.jiff.counters.gen_op_id('slt', this.holders);
    }

    var final_deferred = new this.jiff.helpers.Deferred();
    var final_promise = final_deferred.promise;
    var result = new this.jiff.SecretShare(final_promise, this.holders, Math.max(this.threshold, o.threshold), this.Zp);

    var w = this.ilt_halfprime(op_id + ':halfprime:1');

    var self = this;
    w.wThen(function () {
      var x = o.ilt_halfprime(op_id + ':halfprime:2');
      x.wThen(function () {
        var y = self.issub(o).ilt_halfprime(op_id + ':halfprime:3');
        y.wThen(function () {
          var xy = x.ismult(y, op_id + ':smult1');
          var answer = x.icmult(-1).icadd(1).issub(y).isadd(xy).isadd(w.ismult(x.isadd(y).issub(xy.icmult(2)), op_id + ':smult2'));
          answer.wThen(final_deferred.resolve);
        });
      });
    });

    return result;
  };

  /**
   * Greater than or equal with a constant.
   * @method cgteqn
   * @param {number} cst - the constant to compare with.
   * @param {string} [op_id=auto_gen()] - the operation id which is used to identify this operation.
   *                         This id must be unique, and must be passed by all parties to the same instruction, to
   *                         ensure that corresponding instructions across different parties are matched correctly.
   * @return {module:jiff-client~JIFFClient#SecretShare} this party's share of the result, the final result is 1 if this >= cst, and 0 otherwise.
   * @memberof module:jiff-client~JIFFClient#SecretShare
   * @instance
   */
  SecretShare.prototype.cgteq = function (cst, op_id) {
    if (!(this.isConstant(cst))) {
      throw new Error('parameter should be a number (>=)');
    }

    if (op_id == null) {
      op_id = this.jiff.counters.gen_op_id('cgteq', this.holders);
    }

    return this.iclt(cst, op_id).inot();
  };

  /**
   * Greater than with a constant.
   * @method cgt
   * @param {number} cst - the constant to compare with.
   * @param {string} [op_id=auto_gen()] - the operation id which is used to identify this operation.
   *                         This id must be unique, and must be passed by all parties to the same instruction, to
   *                         ensure that corresponding instructions across different parties are matched correctly.default ids suffice when all parties execute the
   *                         instructions in the same order.
   * @return {module:jiff-client~JIFFClient#SecretShare} this party's share of the result, the final result is 1 if this > cst, and 0 otherwise.
   * @memberof module:jiff-client~JIFFClient#SecretShare
   * @instance
   */
  SecretShare.prototype.cgt = function (cst, op_id) {
    if (!(this.isConstant(cst))) {
      throw new Error('parameter should be a number (>)');
    }

    if (op_id == null) {
      op_id = this.jiff.counters.gen_op_id('cgt', this.holders);
    }

    var final_deferred = new this.jiff.helpers.Deferred();
    var final_promise = final_deferred.promise;
    var result = new this.jiff.SecretShare(final_promise, this.holders, this.threshold, this.Zp);

    var w = this.jiff.share_helpers['<'](cst, this.jiff.share_helpers['/'](this.Zp, 2)) ? 1 : 0;
    var x = this.ilt_halfprime(op_id + ':halfprime:1');

    var self = this;
    x.wThen(function () {
      var y = self.icmult(-1).icadd(cst).ilt_halfprime(op_id + ':halfprime:2');
      y.wThen(function () {
        var xy = y.ismult(x, op_id + ':smult1');
        var answer = x.icmult(-1).icadd(1).issub(y).isadd(xy).isadd(x.isadd(y).issub(xy.icmult(2)).icmult(w));
        answer.wThen(final_deferred.resolve);
      });
    });

    return result;
  };

  /**
   * Less than or equal with a constant.
   * @method clteq
   * @param {number} cst - the constant to compare with.
   * @param {string} [op_id=auto_gen()] - the operation id which is used to identify this operation.
   *                         This id must be unique, and must be passed by all parties to the same instruction, to
   *                         ensure that corresponding instructions across different parties are matched correctly.
   * @return {module:jiff-client~JIFFClient#SecretShare} this party's share of the result, the final result is 1 if this <= cst, and 0 otherwise.
   * @memberof module:jiff-client~JIFFClient#SecretShare
   * @instance
   */
  SecretShare.prototype.clteq = function (cst, op_id) {
    if (!(this.isConstant(cst))) {
      throw new Error('parameter should be a number (<=)');
    }

    if (op_id == null) {
      op_id = this.jiff.counters.gen_op_id('clteq', this.holders);
    }

    return this.icgt(cst, op_id).inot();
  };

  /**
   * Less than with a constant.
   * @method clt
   * @param {number} cst - the constant to compare with.
   * @param {string} [op_id=auto_gen()] - the operation id which is used to identify this operation.
   *                         This id must be unique, and must be passed by all parties to the same instruction, to
   *                         ensure that corresponding instructions across different parties are matched correctly.
   * @return {module:jiff-client~JIFFClient#SecretShare} this party's share of the result, the final result is 1 if this < cst, and 0 otherwise.
   * @memberof module:jiff-client~JIFFClient#SecretShare
   * @instance
   */
  SecretShare.prototype.clt = function (cst, op_id) {
    if (!(this.isConstant(cst))) {
      throw new Error('parameter should be a number (<)');
    }

    if (op_id == null) {
      op_id = this.jiff.counters.gen_op_id('clt', this.holders);
    }

    var final_deferred = new this.jiff.helpers.Deferred();
    var final_promise = final_deferred.promise;
    var result = new this.jiff.SecretShare(final_promise, this.holders, this.threshold, this.Zp);

    var w = this.ilt_halfprime(op_id + ':halfprime:1');

    var self = this;
    w.wThen(function () {
      var x = self.jiff.share_helpers['<'](cst, self.jiff.share_helpers['/'](self.Zp, 2)) ? 1 : 0;
      var y = self.icsub(cst).ilt_halfprime(op_id + ':halfprime:2');
      y.wThen(function () {
        var xy = y.icmult(x);
        var answer = y.icmult(-1).icadd(1 - x).isadd(xy).isadd(w.ismult(y.icadd(x).issub(xy.icmult(2)), op_id + ':smult1'));
        answer.wThen(final_deferred.resolve);
      });
    });

    return result;
  };

  /**
   * Equality test with two shares.
   * @method seq
   * @param {module:jiff-client~JIFFClient#SecretShare} o - the share to compare with.
   * @param {string} [op_id=auto_gen()] - the operation id which is used to identify this operation.
   *                         This id must be unique, and must be passed by all parties to the same instruction, to
   *                         ensure that corresponding instructions across different parties are matched correctly.
   * @return {module:jiff-client~JIFFClient#SecretShare} this party's share of the result, the final result is 1 if this = o, and 0 otherwise.
   * @memberof module:jiff-client~JIFFClient#SecretShare
   * @instance
   */
  SecretShare.prototype.seq = function (o, op_id) {
    if (!(o.jiff === this.jiff)) {
      throw new Error('shares do not belong to the same instance (==)');
    }
    if (!this.jiff.helpers.Zp_equals(this, o)) {
      throw new Error('shares must belong to the same field (==)');
    }
    if (!this.jiff.helpers.array_equals(this.holders, o.holders)) {
      throw new Error('shares must be held by the same parties (==)');
    }
    if (op_id == null) {
      op_id = this.jiff.counters.gen_op_id('seq', this.holders);
    }

    return this.isneq(o, op_id).inot();
  };

  /**
   * Unequality test with two shares.
   * @method sneq
   * @param {module:jiff-client~JIFFClient#SecretShare} o - the share to compare with.
   * @param {string} [op_id=auto_gen()] - the operation id which is used to identify this operation.
   *                         This id must be unique, and must be passed by all parties to the same instruction, to
   *                         ensure that corresponding instructions across different parties are matched correctly.
   * @return {module:jiff-client~JIFFClient#SecretShare} this party's share of the result, the final result is 0 if this = o, and 1 otherwise.
   * @memberof module:jiff-client~JIFFClient#SecretShare
   * @instance
   */
  SecretShare.prototype.sneq = function (o, op_id) {
    if (!(o.jiff === this.jiff)) {
      throw new Error('shares do not belong to the same instance (!=)');
    }
    if (!this.jiff.helpers.Zp_equals(this, o)) {
      throw new Error('shares must belong to the same field (!=)');
    }
    if (!this.jiff.helpers.array_equals(this.holders, o.holders)) {
      throw new Error('shares must be held by the same parties (!=)');
    }
    if (op_id == null) {
      op_id = this.jiff.counters.gen_op_id('sneq', this.holders);
    }

    return this.issub(o).icpow(this.jiff.share_helpers['-'](this.Zp, 1), op_id + ':cpow');
  };

  /**
   * Equality test with a constant.
   * @method ceq
   * @param {number} cst - the constant to compare with.
   * @param {string} [op_id=auto_gen()] - the operation id which is used to identify this operation.
   *                         This id must be unique, and must be passed by all parties to the same instruction, to
   *                         ensure that corresponding instructions across different parties are matched correctly.
   * @return {module:jiff-client~JIFFClient#SecretShare} this party's share of the result, the final result is 0 if this = o, and 1 otherwise.
   * @memberof module:jiff-client~JIFFClient#SecretShare
   * @instance
   */
  SecretShare.prototype.ceq = function (cst, op_id) {
    if (!(this.isConstant(cst))) {
      throw new Error('parameter should be a number (==)');
    }
    if (op_id == null) {
      op_id = this.jiff.counters.gen_op_id('ceq', this.holders);
    }

    return this.icneq(cst, op_id).inot();
  };

  /**
   * Unequality test with a constant.
   * @method cneq
   * @param {number} cst - the constant to compare with.
   * @param {string} [op_id=auto_gen()] - the operation id which is used to identify this operation.
   *                         This id must be unique, and must be passed by all parties to the same instruction, to
   *                         ensure that corresponding instructions across different parties are matched correctly.
   * @return {module:jiff-client~JIFFClient#SecretShare} this party's share of the result, the final result is 0 if this = o, and 1 otherwise.
   * @memberof module:jiff-client~JIFFClient#SecretShare
   * @instance
   */
  SecretShare.prototype.cneq = function (cst, op_id) {
    if (!(this.isConstant(cst))) {
      throw new Error('parameter should be a number (!=)');
    }
    if (op_id == null) {
      op_id = this.jiff.counters.gen_op_id('cneq', this.holders);
    }

    return this.icsub(cst).icpow(this.jiff.share_helpers['-'](this.Zp, 1), op_id + ':cpow');
  };

  /**
   * Checks whether the share is less than half the field size.
   * @method lt_halfprime
   * @memberof module:jiff-client~JIFFClient#SecretShare
   * @instance
   * @param {string} [op_id=auto_gen()] - the operation id which is used to identify this operation.
   *                         This id must be unique, and must be passed by all parties to the same instruction, to
   *                         ensure that corresponding instructions across different parties are matched correctly.
   * @return {module:jiff-client~JIFFClient#SecretShare} this party's share of the result.
   */
  SecretShare.prototype.lt_halfprime = function (op_id) {
    if (op_id == null) {
      op_id = this.jiff.counters.gen_op_id('lt_halfprime', this.holders);
    }

    // if share is even, then this is less than half the prime, otherwise, share is greater than half the prime
    var share = this.icmult(2);

    // to check if share is even, we will use pre-shared bits as some form of a bit mask
    var bitLength = this.jiff.share_helpers['ceil'](this.jiff.helpers.bLog(share.Zp, 2));

    // Create result share
    var final_deferred = new this.jiff.helpers.Deferred();
    var final_promise = final_deferred.promise;
    var result = new this.jiff.SecretShare(final_promise, this.holders, this.threshold, this.Zp);

    // Execute protocol when randomly sampled bit-wise random number is ready
    var self = this;
    var ready_sampling = function (bits) {
      // if 2*this is even, then this is less than half prime, otherwise this is greater or equal to half prime
      if (bits.length !== bitLength) {
        throw new Error('Preprocessed bits sequence has incorrect length, expected: ' + bitLength + ' actual: ' + bits.length);
      }

      // bit composition: r = (rl ... r1 r0)_10
      var r = self.jiff.protocols.bits.bit_composition(bits);
      // open share + noise, and utilize opened value with shared bit representation of noise to check the least significant digit of share.
      share.jiff.internal_open(r.isadd(share), share.holders, op_id + ':open').then(function (result) {
        var wrapped = self.jiff.protocols.bits.cgt(bits, result, op_id + ':bits.cgt');
        var isOdd = self.jiff.helpers.mod(result, 2);
        isOdd = bits[0].icxor_bit(isOdd);
        isOdd = isOdd.isxor_bit(wrapped, op_id + ':sxor_bit');

        var answer = isOdd.inot();
        answer.wThen(final_deferred.resolve);
      });
    };

    // generate the bits of a random number less than our prime
    var bits = this.jiff.get_preprocessing(op_id + ':sampling');
    if (bits == null) {
      var promise = this.jiff.from_crypto_provider('numbers', this.holders, this.threshold, this.Zp, op_id + ':sampling', {
        bitLength: bitLength,
        count: 1,
        max: this.Zp
      });
      promise.then(function (msg) {
        ready_sampling(msg['shares']);
      });
    } else {
      ready_sampling(bits);
    }

    return result;
  };
};