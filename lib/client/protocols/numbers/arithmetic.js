// Arithmetic operations on shares
module.exports = function (SecretShare) {
  /**
   * Addition with a constant.
   * @method cadd
   * @param {number} cst - the constant to add.
   * @return {module:jiff-client~JIFFClient#SecretShare} this party's share of the result.
   * @memberof module:jiff-client~JIFFClient#SecretShare
   * @instance
   */
  SecretShare.prototype.cadd = function (cst) {
    if (!(this.isConstant(cst))) {
      throw new Error('parameter should be a number (+)');
    }

    var self = this;
    var ready = function () {
      return self.jiff.helpers.mod(self.jiff.share_helpers['+'](self.value, cst), self.Zp);
    };

    return new this.jiff.SecretShare(this.wThen(ready), this.holders, this.threshold, this.Zp);
  };

  /**
   * Subtraction with a constant.
   * @method csub
   * @param {number} cst - the constant to subtract from this share.
   * @return {module:jiff-client~JIFFClient#SecretShare} this party's share of the result.
   * @memberof module:jiff-client~JIFFClient#SecretShare
   * @instance
   */
  SecretShare.prototype.csub = function (cst) {
    if (!(this.isConstant(cst))) {
      throw new Error('parameter should be a number (-)');
    }

    var self = this;
    var ready = function () {
      return self.jiff.helpers.mod(self.jiff.share_helpers['-'](self.value, cst), self.Zp);
    };

    return new this.jiff.SecretShare(this.wThen(ready), this.holders, this.threshold, this.Zp);
  };

  /**
   * Multiplication by a constant.
   * @method cmult
   * @param {number} cst - the constant to multiply to this share.
   * @return {module:jiff-client~JIFFClient#SecretShare} this party's share of the result.
   * @memberof module:jiff-client~JIFFClient#SecretShare
   * @instance
   */
  SecretShare.prototype.cmult = function (cst) {
    if (!(this.isConstant(cst))) {
      throw new Error('parameter should be a number (*)');
    }

    var self = this;
    var ready = function () {
      return self.jiff.helpers.mod(self.jiff.share_helpers['*'](self.value, cst), self.Zp);
    };

    return new this.jiff.SecretShare(this.wThen(ready), this.holders, this.threshold, this.Zp);
  };

  /**
   * Division by a constant factor of the number represented by the share.
   * @method cdivfac
   * @param {number} cst - the constant by which to divide the share.
   * @return {module:jiff-client~JIFFClient#SecretShare} this party's share of the result.
   * @memberof module:jiff-client~JIFFClient#SecretShare
   * @instance
   */
  SecretShare.prototype.cdivfac = function (cst) {
    if (!(this.isConstant(cst))) {
      throw new Error('Parameter should be a number (cdivfac)');
    }

    var inv = this.jiff.helpers.extended_gcd(cst, this.Zp)[0];

    var self = this;
    var ready = function () {
      return self.jiff.helpers.mod(self.jiff.share_helpers['*'](self.value, inv), self.Zp);
    };

    return new this.jiff.SecretShare(this.wThen(ready), this.holders, this.threshold, this.Zp);
  };

  /**
   * Addition of two secret shares.
   * @method sadd
   * @param {module:jiff-client~JIFFClient#SecretShare} o - the share to add to this share.
   * @return {module:jiff-client~JIFFClient#SecretShare} this party's share of the result.
   * @memberof module:jiff-client~JIFFClient#SecretShare
   * @instance
   *
   * @example
   * // share a value with all parties, and sum the values of all shares
   * var shares = jiff_instance.share(x);
   * var sum = shares[1];
   * for (var i = 2; i <= jiff_instance.party_count; i++) {
   *  sum = sum.sadd(shares[i]);
   * }
   *
   */
  SecretShare.prototype.sadd = function (o) {
    if (!(o.jiff === this.jiff)) {
      throw new Error('shares do not belong to the same instance (+)');
    }
    if (!this.jiff.helpers.Zp_equals(this, o)) {
      throw new Error('shares must belong to the same field (+)');
    }
    if (!this.jiff.helpers.array_equals(this.holders, o.holders)) {
      throw new Error('shares must be held by the same parties (+)');
    }

    // add the two shares when ready locally
    var self = this;
    var ready = function () {
      return self.jiff.helpers.mod(self.jiff.share_helpers['+'](self.value, o.value), self.Zp);
    };

    // promise to execute ready_add when both are ready
    return new this.jiff.SecretShare(this.when_both_ready(o, ready), this.holders, Math.max(this.threshold, o.threshold), this.Zp);
  };

  /**
   * Subtraction of two secret shares.
   * @method ssub
   * @param {module:jiff-client~JIFFClient#SecretShare} o - the share to subtract from this share.
   * @return {module:jiff-client~JIFFClient#SecretShare} this party's share of the result.
   * @memberof module:jiff-client~JIFFClient#SecretShare
   * @instance
   */
  SecretShare.prototype.ssub = function (o) {
    if (!(o.jiff === this.jiff)) {
      throw new Error('shares do not belong to the same instance (-)');
    }
    if (!this.jiff.helpers.Zp_equals(this, o)) {
      throw new Error('shares must belong to the same field (-)');
    }
    if (!this.jiff.helpers.array_equals(this.holders, o.holders)) {
      throw new Error('shares must be held by the same parties (-)');
    }

    // subtract the two shares when ready locally
    var self = this;
    var ready = function () {
      return self.jiff.helpers.mod(self.jiff.share_helpers['-'](self.value, o.value), self.Zp);
    };

    // promise to execute ready_add when both are ready
    return new this.jiff.SecretShare(this.when_both_ready(o, ready), this.holders, Math.max(this.threshold, o.threshold), this.Zp);
  };

  /**
   * Multiplication of two secret shares through Beaver Triplets.
   * @method smult
   * @param {module:jiff-client~JIFFClient#SecretShare} o - the share to multiply with.
   * @param {string} [op_id=auto_gen()] - the operation id which is used to identify this multiplication (and internally, the corresponding beaver triplet).
   *                         This id must be unique, and must be passed by all parties to the same instruction.
   *                         this ensures that every party gets a share from the same triplet for every matching instruction. An automatic id
   *                         is generated by increasing a local counter, default ids suffice when all parties execute the
   *                         instructions in the same order.
   * @return {module:jiff-client~JIFFClient#SecretShare} this party's share of the result.
   * @memberof module:jiff-client~JIFFClient#SecretShare
   * @instance
   */
  SecretShare.prototype.smult = function (o, op_id) {
    if (!(o.jiff === this.jiff)) {
      throw new Error('shares do not belong to the same instance (*)');
    }
    if (!this.jiff.helpers.Zp_equals(this, o)) {
      throw new Error('shares must belong to the same field (*)');
    }
    if (!this.jiff.helpers.array_equals(this.holders, o.holders)) {
      throw new Error('shares must be held by the same parties (*)');
    }

    if (op_id == null) {
      op_id = this.jiff.counters.gen_op_id('smult', this.holders);
    }

    // final result
    var final_deferred = new this.jiff.helpers.Deferred();
    var final_promise = final_deferred.promise;
    var result = new this.jiff.SecretShare(final_promise, this.holders, Math.max(this.threshold, o.threshold), this.Zp);

    // called when triplet is ready
    var self = this;
    var ready_triplet = function (triplet) {
      var a = triplet[0];
      var b = triplet[1];
      var c = triplet[2];

      // d = s - a. e = o - b.
      var d = self.isadd(a.icmult(-1));
      var e = o.isadd(b.icmult(-1));

      // Open d and e.
      // The only communication cost.
      var e_promise = self.jiff.internal_open(e, e.holders, op_id + ':open1');
      var d_promise = self.jiff.internal_open(d, d.holders, op_id + ':open2');
      Promise.all([e_promise, d_promise]).then(function (arr) {
        var e_open = arr[0];
        var d_open = arr[1];

        // result_share = d_open * e_open + d_open * b_share + e_open * a_share + c.
        var t1 = self.jiff.helpers.mod(self.jiff.share_helpers['*'](d_open, e_open), self.Zp);
        var t2 = b.icmult(d_open);
        var t3 = a.icmult(e_open);

        // All this happens locally.
        var final_result = t2.icadd(t1);
        final_result = final_result.isadd(t3);
        final_result = final_result.isadd(c);

        final_result.wThen(final_deferred.resolve);
      });
    };

    // Get shares of triplets.
    var triplet = this.jiff.get_preprocessing(op_id + ':triplet');
    if (triplet == null) {
      var promise = this.jiff.from_crypto_provider('triplet', this.holders, Math.max(this.threshold, o.threshold), this.Zp, op_id + ':triplet');
      promise.then(function (msg) {
        ready_triplet(msg['shares']);
      });
    } else {
      ready_triplet(triplet);
    }

    return result;
  };

  /**
   * Multiplication of two secret shares through BGW protocol.
   * @method smult_bgw
   * @param {module:jiff-client~JIFFClient#SecretShare} o - the share to multiply with.
   * @param {string} [op_id=auto_gen()] - the operation id which is used to identify this multiplication (and internally, the corresponding beaver triplet).
   *                         This id must be unique, and must be passed by all parties to the same instruction.
   *                         this ensures that every party gets a share from the same triplet for every matching instruction. An automatic id
   *                         is generated by increasing a local counter, default ids suffice when all parties execute the
   *                         instructions in the same order.
   * @return {module:jiff-client~JIFFClient#SecretShare} this party's share of the result.
   * @memberof module:jiff-client~JIFFClient#SecretShare
   * @instance
   */
  SecretShare.prototype.smult_bgw = function (o, op_id) {
    if (!(o.jiff === this.jiff)) {
      throw new Error('shares do not belong to the same instance (bgw*)');
    }
    if (!this.jiff.helpers.Zp_equals(this, o)) {
      throw new Error('shares must belong to the same field (bgw*)');
    }
    if (!this.jiff.helpers.array_equals(this.holders, o.holders)) {
      throw new Error('shares must be held by the same parties (bgw*)');
    }
    if ((this.threshold - 1) + (o.threshold - 1) > this.holders.length - 1) {
      throw new Error('threshold too high for BGW (*)');
    }

    if (op_id == null) {
      op_id = this.jiff.counters.gen_op_id('smult_bgw', this.holders);
    }

    // ensure thresholds are fine
    var new_threshold = (this.threshold - 1) + (o.threshold - 1) + 1;
    if (new_threshold > this.holders) {
      var errorMsg = 'Threshold too large for smult_bgw: ' + new_threshold;
      errorMsg += '. Shares: ' + this.toString() + ', ' + o.toString();
      throw new Error(errorMsg);
    }

    // multiply via the BGW protocol
    var self = this;
    var ready = function () {
      return self.jiff.helpers.mod(self.jiff.share_helpers['*'](self.value, o.value), self.Zp);
    };

    // reshare to reduce threshold and return when ready
    var result = new this.jiff.SecretShare(this.when_both_ready(o, ready), this.holders, new_threshold, this.Zp);
    return this.jiff.reshare(result, Math.max(this.threshold, o.threshold), result.holders, result.holders, result.Zp, op_id + ':threshold');
  };

  /**
   * Integer divison with two shares (this / o)
   * @method sdiv
   * @param {module:jiff-client~JIFFClient#SecretShare} o - the share to divide by.
   * @param {number} [l=ceil(log_2(this.Zp))] - the maximum bit length of either operands.
   * @param {string} [op_id=auto_gen()] - the operation id which is used to identify this operation.
   *                         This id must be unique, and must be passed by all parties to the same instruction, to
   *                         ensure that corresponding instructions across different parties are matched correctly.
   * @return {module:jiff-client~JIFFClient#SecretShare} this party's share of the result.
   * @memberof module:jiff-client~JIFFClient#SecretShare
   * @instance
   */
  SecretShare.prototype.sdiv = function (o, l, op_id) {
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
      op_id = this.jiff.counters.gen_op_id('sdiv', this.holders);
    }

    // figure out maximum output bit length
    var lZp = this.jiff.share_helpers['ceil'](this.jiff.helpers.bLog(this.Zp, 2));
    l = (l != null && l < lZp) ? l : lZp;

    // Convert to bits
    var dividend_bits = this.bit_decomposition(op_id + ':decomposition1').slice(0, l);
    var divisor_bits = o.bit_decomposition(op_id + ':decomposition2').slice(0, l);

    // Compute by long division
    var quotient_bits = this.jiff.protocols.bits.sdiv(dividend_bits, divisor_bits, op_id + ':bits.sdiv').quotient;

    // Convert to number and return
    return this.jiff.protocols.bits.bit_composition(quotient_bits);
  };

  /**
   * Integer divison with a share and a constant (this / cst).
   * @method cdiv
   * @param {module:jiff-client~JIFFClient#SecretShare} cst - the constant to divide by.
   * @param {string} [op_id=auto_gen()] - the operation id which is used to identify this operation.
   *                         This id must be unique, and must be passed by all parties to the same instruction, to
   *                         ensure that corresponding instructions across different parties are matched correctly.
   * @return {module:jiff-client~JIFFClient#SecretShare} this party's share of the result.
   * @memberof module:jiff-client~JIFFClient#SecretShare
   * @instance
   */
  SecretShare.prototype.cdiv = function (cst, op_id) {
    if (!(this.isConstant(cst))) {
      throw new Error('parameter should be a number (/)');
    }

    if (this.jiff.share_helpers['<='](cst, 0)) {
      throw new Error('divisor must be > 0 (cst/): ' + cst);
    }

    if (this.jiff.share_helpers['<='](this.Zp, cst)) {
      throw new Error('divisor must be < share.Zp (' + this.Zp + ') in (cst/): ' + cst);
    }

    if (op_id == null) {
      op_id = this.jiff.counters.gen_op_id('cdiv', this.holders);
    }

    // Allocate share for result to which the answer will be resolved once available
    var final_deferred = new this.jiff.helpers.Deferred();
    var final_promise = final_deferred.promise;
    var result = new this.jiff.SecretShare(final_promise, this.holders, this.threshold, this.Zp);

    // Execute protocol when random in noise in [0, Zp) and quotient floor(noise/constant) is ready!
    var self = this;
    var ready_quotient = function (noise, nOVERc) {
      // Use noise
      var noisyX = self.isadd(noise);
      self.jiff.internal_open(noisyX, noisyX.holders, op_id + ':open').then(function (noisyX) {
        var wrapped = self.icgt(noisyX, op_id + ':wrap_cgt'); // 1 => x + noise wrapped around Zp, 0 otherwise

        // if we did not wrap
        var noWrapDiv = self.jiff.share_helpers['floor/'](noisyX, cst);
        var unCorrectedQuotient = nOVERc.icmult(-1).icadd(noWrapDiv).icsub(1);
        var verify = self.issub(unCorrectedQuotient.icmult(cst));
        var isNotCorrect = verify.icgteq(cst, op_id + ':cor1');
        var noWrapAnswer = unCorrectedQuotient.isadd(isNotCorrect); // if incorrect => isNotCorrect = 1 => quotient = unCorrectedQuotient - 1

        // if we wrapped
        var wrapDiv = self.jiff.share_helpers['floor/'](self.jiff.share_helpers['+'](noisyX, self.Zp), cst);
        unCorrectedQuotient = nOVERc.icmult(-1).icadd(wrapDiv).icsub(1);
        verify = self.issub(unCorrectedQuotient.icmult(cst));
        isNotCorrect = verify.icgteq(cst, op_id + ':cor2');
        var wrapAnswer = unCorrectedQuotient.isadd(isNotCorrect); // if incorrect => isNotCorrect = 1 => quotient = unCorrectedQuotient - 1

        var answer = noWrapAnswer.isadd(wrapped.ismult(wrapAnswer.issub(noWrapAnswer), op_id + ':smult'));
        answer.wThen(final_deferred.resolve);
      });
    };

    // Preprocessing cases
    var quotient = this.jiff.get_preprocessing(op_id + ':quotient');
    if (quotient == null) { // case 1: no preprocessing with crypto provider!
      var promise = this.jiff.from_crypto_provider('quotient', this.holders, this.threshold, this.Zp, op_id + ':quotient', {constant: cst});
      promise.then(function (msg) {
        ready_quotient(msg['shares'][0], msg['shares'][1]);
      });
    } else if (quotient.ondemand === true) { // case 2: constant was not available at preprocessing time, must do it now!
      this.jiff.preprocessing('quotient', 1, null, this.threshold, this.holders, this.holders, this.Zp, [op_id + ':quotient'], {constant: cst, namespace: 'base'});
      this.jiff.executePreprocessing(function () {
        var quotient = self.jiff.get_preprocessing(op_id + ':quotient');
        ready_quotient(quotient.r, quotient.q);
      });
    } else { // case 3: preprocessing is completed!
      ready_quotient(quotient.r, quotient.q);
    }

    // special case, if result is zero, sometimes we will get to -1 due to how correction happens above (.csub(1) and then compare)
    var zeroIt = this.iclt(cst, op_id + ':zero_check').inot();
    return result.ismult(zeroIt, op_id + ':zero_it');
  };

  /**
   * Remainder with two shares (this % o)
   * @method smod
   * @param {module:jiff-client~JIFFClient#SecretShare} o - the modulus to apply
   * @param {number} [l=ceil(log_2(this.Zp))] - the maximum bit length of either operands.
   * @param {string} [op_id=auto_gen()] - the operation id which is used to identify this operation.
   *                         This id must be unique, and must be passed by all parties to the same instruction, to
   *                         ensure that corresponding instructions across different parties are matched correctly.
   * @return {module:jiff-client~JIFFClient#SecretShare} this party's share of the result.
   * @memberof module:jiff-client~JIFFClient#SecretShare
   * @instance
   */
  SecretShare.prototype.smod = function (o, l, op_id) {
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
      op_id = this.jiff.counters.gen_op_id('smod', this.holders);
    }

    // figure out maximum output bit length
    var lZp = this.jiff.share_helpers['ceil'](this.jiff.helpers.bLog(this.Zp, 2));
    l = (l != null && l < lZp) ? l : lZp;

    // Convert to bits
    var dividend_bits = this.bit_decomposition(op_id + ':decomposition1').slice(0, l);
    var divisor_bits = o.bit_decomposition(op_id + ':decomposition2').slice(0, l);

    // Compute by long division
    var remainder_bits = this.jiff.protocols.bits.sdiv(dividend_bits, divisor_bits, op_id + ':bits.sdiv').remainder;

    // Convert to number and return
    return this.jiff.protocols.bits.bit_composition(remainder_bits);
  };

  /**
   * Fast (modular) exponentiation with constant exponent via repeated squaring.
   * @method cpow
   * @param {number} cst - the constant to multiply to this share.
   * @param {string} [op_id=auto_gen()] - the operation id which is used to identify this operation.
   *                         This id must be unique, and must be passed by all parties to the same instruction, to
   *                         ensure that corresponding instructions across different parties are matched correctly.
   * @return {module:jiff-client~JIFFClient#SecretShare} this party's share of the result.
   * @memberof module:jiff-client~JIFFClient#SecretShare
   * @instance
   */
  SecretShare.prototype.cpow = function (cst, op_id) {
    if (!(this.isConstant(cst))) {
      throw new Error('parameter should be a number (*)');
    }

    if (op_id == null) {
      op_id = this.jiff.counters.gen_op_id('cpow', this.holders);
    }

    // handle big numbers
    var one = 1;
    if (this.jiff.has_extension('bignumber')) {
      one = this.jiff.helpers.BigNumber(1);
      cst = this.jiff.helpers.BigNumber(cst);
    }

    // ensure exponent is non-negative
    if (this.jiff.share_helpers['<'](cst, 0)) {
      throw new Error('cpow supports non-negative exponents only, given ' + cst.toString());
    }

    // begin protocol
    var evens = this;
    var odds = new this.jiff.SecretShare(one, this.holders, this.threshold, this.Zp);

    // special case
    if (cst.toString() === '0') {
      return odds;
    }

    for (var i = 0; this.jiff.share_helpers['<'](1, cst); i++) {
      if (this.jiff.share_helpers['even'](cst)) {
        evens = evens.ismult(evens, op_id + ':smult0:'+i);
        cst = this.jiff.share_helpers['/'](cst, 2);
      } else {
        odds = evens.ismult(odds, op_id + ':smult0:'+i);
        evens = evens.ismult(evens, op_id + ':smult1:'+i);
        cst = this.jiff.share_helpers['/'](this.jiff.share_helpers['-'](cst, 1), 2);
      }
    }

    return evens.ismult(odds, op_id + ':smult0:' + i);
  };
};