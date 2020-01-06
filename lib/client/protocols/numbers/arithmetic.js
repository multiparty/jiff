/**
 * Addition with a constant.
 * @method cadd
 * @param {number} cst - the constant to add.
 * @return {SecretShare} this party's share of the result.
 * @memberof SecretShare
 * @instance
 */
self.cadd = function (cst) {
  if (!(self.isConstant(cst))) {
    throw new Error('parameter should be a number (+)');
  }

  if (self.ready) {
    // if share is ready
    return self.jiff.secret_share(self.jiff, true, null, self.jiff.helpers.mod(share_helpers['+'](self.value, cst), self.Zp), self.holders, self.threshold, self.Zp);
  }

  var promise = self.promise.then(function () {
    return self.jiff.helpers.mod(share_helpers['+'](self.value, cst), self.Zp);
  }, self.error);
  return self.jiff.secret_share(self.jiff, false, promise, undefined, self.holders, self.threshold, self.Zp);
};

/**
 * Subtraction with a constant.
 * @method csub
 * @param {number} cst - the constant to subtract from this share.
 * @return {SecretShare} this party's share of the result.
 * @memberof SecretShare
 * @instance
 */
self.csub = function (cst) {
  if (!(self.isConstant(cst))) {
    throw new Error('parameter should be a number (-)');
  }

  if (self.ready) {
    // if share is ready
    return self.jiff.secret_share(self.jiff, true, null, self.jiff.helpers.mod(share_helpers['-'](self.value, cst), self.Zp), self.holders, self.threshold, self.Zp);
  }

  var promise = self.promise.then(function () {
    return self.jiff.helpers.mod(share_helpers['-'](self.value, cst), self.Zp);
  }, self.error);
  return self.jiff.secret_share(self.jiff, false, promise, undefined, self.holders, self.threshold, self.Zp);
};

/**
 * Multiplication by a constant.
 * @method cmult
 * @param {number} cst - the constant to multiply to this share.
 * @return {SecretShare} this party's share of the result.
 * @memberof SecretShare
 * @instance
 */
self.cmult = function (cst) {
  if (!(self.isConstant(cst))) {
    throw new Error('parameter should be a number (*)');
  }

  if (self.ready) {
    // if share is ready
    return self.jiff.secret_share(self.jiff, true, null, self.jiff.helpers.mod(share_helpers['*'](self.value, cst), self.Zp), self.holders, self.threshold, self.Zp);
  }

  var promise = self.promise.then(function () {
    return self.jiff.helpers.mod(share_helpers['*'](self.value, cst), self.Zp);
  }, self.error);
  return self.jiff.secret_share(self.jiff, false, promise, undefined, self.holders, self.threshold, self.Zp);
};

/**
 * Division by a constant factor of the number represented by the share.
 * @method cdivfac
 * @param {number} cst - the constant by which to divide the share.
 * @return {SecretShare} this party's share of the result.
 * @memberof SecretShare
 * @instance
 */
self.cdivfac = function (cst) {
  if (!(self.isConstant(cst))) {
    throw new Error('Parameter should be a number (cdivfac)');
  }

  var inv = self.jiff.helpers.extended_gcd(cst, self.Zp)[0];

  if (self.ready) {
    // If share is ready.
    return self.jiff.secret_share(self.jiff, true, null, self.jiff.helpers.mod(share_helpers['*'](self.value, inv), self.Zp), self.holders, self.threshold, self.Zp);
  }

  var promise = self.promise.then(function () {
    return self.jiff.helpers.mod(share_helpers['*'](self.value, inv), self.Zp);
  }, self.error);
  return self.jiff.secret_share(self.jiff, false, promise, undefined, self.holders, self.threshold, self.Zp);
};

/**
 * Addition of two secret shares.
 * @method sadd
 * @param {SecretShare} o - the share to add to this share.
 * @return {SecretShare} this party's share of the result.
 * @memberof SecretShare
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
self.sadd = function (o) {
  if (!(o.jiff === self.jiff)) {
    throw new Error('shares do not belong to the same instance (+)');
  }
  if (!self.jiff.helpers.Zp_equals(self, o)) {
    throw new Error('shares must belong to the same field (+)');
  }
  if (!self.jiff.helpers.array_equals(self.holders, o.holders)) {
    throw new Error('shares must be held by the same parties (+)');
  }

  // add the two shares when ready locally
  var ready_add = function () {
    return self.jiff.helpers.mod(share_helpers['+'](self.value, o.value), self.Zp);
  };

  if (self.ready && o.ready) {
    // both shares are ready
    return self.jiff.secret_share(self.jiff, true, null, ready_add(), self.holders, Math.max(self.threshold, o.threshold), self.Zp);
  }

  // promise to execute ready_add when both are ready
  var promise = self.pick_promise(o).then(ready_add, self.error);
  return self.jiff.secret_share(self.jiff, false, promise, undefined, self.holders, Math.max(self.threshold, o.threshold), self.Zp);
};

/**
 * Subtraction of two secret shares.
 * @method ssub
 * @param {SecretShare} o - the share to subtract from this share.
 * @return {SecretShare} this party's share of the result.
 * @memberof SecretShare
 * @instance
 */
self.ssub = function (o) {
  if (!(o.jiff === self.jiff)) {
    throw new Error('shares do not belong to the same instance (-)');
  }
  if (!self.jiff.helpers.Zp_equals(self, o)) {
    throw new Error('shares must belong to the same field (-)');
  }
  if (!self.jiff.helpers.array_equals(self.holders, o.holders)) {
    throw new Error('shares must be held by the same parties (-)');
  }

  // add the two shares when ready locally
  var ready_sub = function () {
    return self.jiff.helpers.mod(share_helpers['-'](self.value, o.value), self.Zp);
  };

  if (self.ready && o.ready) {
    // both shares are ready
    return self.jiff.secret_share(self.jiff, true, null, ready_sub(), self.holders, Math.max(self.threshold, o.threshold), self.Zp);
  }

  // promise to execute ready_add when both are ready
  var promise = self.pick_promise(o).then(ready_sub, self.error);
  return self.jiff.secret_share(self.jiff, false, promise, undefined, self.holders, Math.max(self.threshold, o.threshold), self.Zp);
};

/**
 * Multiplication of two secret shares through Beaver Triplets.
 * @method smult
 * @param {SecretShare} o - the share to multiply with.
 * @param {string} [op_id=auto_gen()] - the operation id which is used to identify this multiplication (and internally, the corresponding beaver triplet).
 *                         This id must be unique, and must be passed by all parties to the same instruction.
 *                         this ensures that every party gets a share from the same triplet for every matching instruction. An automatic id
 *                         is generated by increasing a local counter, default ids suffice when all parties execute the
 *                         instructions in the same order.
 * @return {SecretShare} this party's share of the result.
 * @memberof SecretShare
 * @instance
 */
self.smult = function (o, op_id) {
  if (!(o.jiff === self.jiff)) {
    throw new Error('shares do not belong to the same instance (*)');
  }
  if (!self.jiff.helpers.Zp_equals(self, o)) {
    throw new Error('shares must belong to the same field (*)');
  }
  if (!self.jiff.helpers.array_equals(self.holders, o.holders)) {
    throw new Error('shares must be held by the same parties (*)');
  }

  if (op_id == null) {
    op_id = self.jiff.counters.gen_op_id('smult', self.holders);
  }

  // final result
  var final_deferred = new self.jiff.helpers.Deferred;
  var final_promise = final_deferred.promise;
  var result = self.jiff.secret_share(self.jiff, false, final_promise, undefined, self.holders, Math.max(self.threshold, o.threshold), self.Zp);

  // called when triplet is ready
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
      var t1 = self.jiff.helpers.mod(share_helpers['*'](d_open, e_open), self.Zp);
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
  var triplet = self.jiff.get_preprocessing(op_id + ':triplet');
  if (triplet == null) {
    var promise = jiff.from_crypto_provider('triplet', self.holders, Math.max(self.threshold, o.threshold), self.Zp, op_id + ':triplet');
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
 * @param {SecretShare} o - the share to multiply with.
 * @param {string} [op_id=auto_gen()] - the operation id which is used to identify this multiplication (and internally, the corresponding beaver triplet).
 *                         This id must be unique, and must be passed by all parties to the same instruction.
 *                         this ensures that every party gets a share from the same triplet for every matching instruction. An automatic id
 *                         is generated by increasing a local counter, default ids suffice when all parties execute the
 *                         instructions in the same order.
 * @return {SecretShare} this party's share of the result.
 * @memberof SecretShare
 * @instance
 */
self.smult_bgw = function (o, op_id) {
  if (!(o.jiff === self.jiff)) {
    throw new Error('shares do not belong to the same instance (bgw*)');
  }
  if (!self.jiff.helpers.Zp_equals(self, o)) {
    throw new Error('shares must belong to the same field (bgw*)');
  }
  if (!self.jiff.helpers.array_equals(self.holders, o.holders)) {
    throw new Error('shares must be held by the same parties (bgw*)');
  }
  if ((self.threshold - 1) + (o.threshold - 1) > self.holders.length - 1) {
    throw new Error('threshold too high for BGW (*)');
  }

  if (op_id == null) {
    op_id = self.jiff.counters.gen_op_id('smult_bgw', self.holders);
  }

  var new_threshold = (self.threshold - 1) + (o.threshold - 1) + 1;
  if (new_threshold > self.holders) {
    var errorMsg = 'Threshold too large for smult_bgw: ' + new_threshold;
    errorMsg += '. Shares: ' + self.toString() + ', ' + o.toString();
    throw new Error(errorMsg);
  }

  var final_deferred = new self.jiff.helpers.Deferred;
  var final_promise = final_deferred.promise;
  var result = self.jiff.secret_share(self.jiff, false, final_promise, undefined, self.holders, new_threshold, self.Zp);

  Promise.all([self.promise, o.promise]).then(
    function () {
      // Get Shares  of z
      var zi = self.jiff.helpers.mod(share_helpers['*'](self.value, o.value), self.Zp);
      final_deferred.resolve(zi);
    });

  return self.jiff.protocols.reshare(result, Math.max(self.threshold, o.threshold), result.holders, result.holders, result.Zp, op_id + ':threshold');
};

/**
 * Integer divison with two shares (self / o)
 * @method sdiv
 * @param {SecretShare} o - the share to divide by.
 * @param {number} [l=log_2(self.Zp)] - the maximum bit length of the answer.
 * @param {string} [op_id=auto_gen()] - the operation id which is used to identify this operation.
 *                         This id must be unique, and must be passed by all parties to the same instruction, to
 *                         ensure that corresponding instructions across different parties are matched correctly.
 * @return {SecretShare} this party's share of the result.
 * @memberof SecretShare
 * @instance
 */
self.sdiv = function (o, l, op_id) {
  if (!(o.jiff === self.jiff)) {
    throw new Error('shares do not belong to the same instance (!=)');
  }
  if (!self.jiff.helpers.Zp_equals(self, o)) {
    throw new Error('shares must belong to the same field (!=)');
  }
  if (!self.jiff.helpers.array_equals(self.holders, o.holders)) {
    throw new Error('shares must be held by the same parties (!=)');
  }

  if (op_id == null) {
    op_id = self.jiff.counters.gen_op_id('sdiv', self.holders);
  }

  var lZp = share_helpers['ceil'](self.jiff.helpers.bLog(self.Zp, 2));
  if (l == null) {
    l = lZp;
  } else {
    l = l < lZp ? l : lZp;
  }

  // Convert to bits
  var dividend_bits = self.bit_decomposition(op_id + ':decomposition1').slice(0, l);
  var divisor_bits = o.bit_decomposition(op_id + ':decomposition2').slice(0, l);

  // Compute by long division
  var quotient_bits = self.jiff.protocols.bits.sdiv(dividend_bits, divisor_bits, op_id + ':bits.sdiv').quotient;
  var quotient = self.jiff.protocols.bits.bit_composition(quotient_bits);
  return quotient;
};

/**
 * Integer divison with a share and a constant (self / cst).
 * @method cdiv
 * @param {SecretShare} cst - the constant to divide by.
 * @param {string} [op_id=auto_gen()] - the operation id which is used to identify this operation.
 *                         This id must be unique, and must be passed by all parties to the same instruction, to
 *                         ensure that corresponding instructions across different parties are matched correctly.
 * @return {SecretShare} this party's share of the result.
 * @memberof SecretShare
 * @instance
 */
self.cdiv = function (cst, op_id) {
  if (!(self.isConstant(cst))) {
    throw new Error('parameter should be a number (/)');
  }

  if (share_helpers['<='](cst, 0)) {
    throw new Error('divisor must be > 0 (cst/): ' + cst);
  }

  if (share_helpers['<='](self.Zp, cst)) {
    throw new Error('divisor must be < share.Zp (' + self.Zp + ') in (cst/): ' + cst);
  }

  if (op_id == null) {
    op_id = self.jiff.counters.gen_op_id('cdiv', self.holders);
  }

  // Allocate share for result to which the answer will be resolved once available
  var final_deferred = new self.jiff.helpers.Deferred;
  var final_promise = final_deferred.promise;
  var result = self.jiff.secret_share(self.jiff, false, final_promise, undefined, self.holders, self.threshold, self.Zp);

  // Execute protocol when random in noise in [0, Zp) and quotient floor(noise/constant) is ready!
  var ready_quotient = function (noise, nOVERc) {
    // Use noise
    var noisyX = self.isadd(noise);
    self.jiff.internal_open(noisyX, noisyX.holders, op_id + ':open').then(function (noisyX) {
      var wrapped = self.icgt(noisyX, op_id + ':wrap_cgt'); // 1 => x + noise wrapped around Zp, 0 otherwise

      // if we did not wrap
      var noWrapDiv = share_helpers['floor/'](noisyX, cst);
      var unCorrectedQuotient = nOVERc.icmult(-1).icadd(noWrapDiv).icsub(1);
      var verify = self.issub(unCorrectedQuotient.icmult(cst));
      var isNotCorrect = verify.icgteq(cst, op_id + ':cor1');
      var noWrapAnswer = unCorrectedQuotient.isadd(isNotCorrect); // if incorrect => isNotCorrect = 1 => quotient = unCorrectedQuotient - 1

      // if we wrapped
      var wrapDiv = share_helpers['floor/'](share_helpers['+'](noisyX, self.Zp), cst);
      unCorrectedQuotient = nOVERc.icmult(-1).icadd(wrapDiv).icsub(1);
      verify = self.issub(unCorrectedQuotient.icmult(cst));
      isNotCorrect = verify.icgteq(cst, op_id + ':cor2');
      var wrapAnswer = unCorrectedQuotient.isadd(isNotCorrect); // if incorrect => isNotCorrect = 1 => quotient = unCorrectedQuotient - 1

      var answer = noWrapAnswer.isadd(wrapped.ismult(wrapAnswer.issub(noWrapAnswer), op_id + ':smult'));
      answer.wThen(final_deferred.resolve);
    });
  };

  // Preprocessing cases
  var quotient = self.jiff.get_preprocessing(op_id + ':quotient');
  if (quotient == null) { // case 1: no preprocessing with crypto provider!
    var promise = self.jiff.from_crypto_provider('quotient', self.holders, self.threshold, self.Zp, op_id + ':quotient', {constant: cst});
    promise.then(function (msg) {
      ready_quotient(msg['shares'][0], msg['shares'][1]);
    });
  } else if (quotient.ondemand === true) { // case 2: constant was not available at preprocessing time, must do it now!
    var ondemand = self.jiff.protocols.generate_random_and_quotient(threshold, self.holders, self.holders, self.Zp, {
      op_id: op_id + ':quotient',
      constant: cst,
      ondemand: true
    });
    ondemand.promise.then(function () {
      ready_quotient(ondemand.share.r, ondemand.share.q);
    });
  } else { // case 3: preprocessing is completed!
    ready_quotient(quotient.r, quotient.q);
  }

  // special case, if result is zero, sometimes we will get to -1 due to how correction happens above (.csub(1) and then compare)
  var zeroIt = self.iclt(cst, op_id + ':zero_check').inot();
  return result.ismult(zeroIt, op_id + ':zero_it');
};

/**
 * Remainder with two shares (self % o)
 * @method smod
 * @param {SecretShare} o - the modulus to apply
 * @param {number} [l=log_2(self.Zp)] - the maximum bit length of the answer.
 * @param {string} [op_id=auto_gen()] - the operation id which is used to identify this operation.
 *                         This id must be unique, and must be passed by all parties to the same instruction, to
 *                         ensure that corresponding instructions across different parties are matched correctly.
 * @return {SecretShare} this party's share of the result.
 * @memberof SecretShare
 * @instance
 */
self.smod = function (o, l, op_id) {
  if (!(o.jiff === self.jiff)) {
    throw new Error('shares do not belong to the same instance (!=)');
  }
  if (!self.jiff.helpers.Zp_equals(self, o)) {
    throw new Error('shares must belong to the same field (!=)');
  }
  if (!self.jiff.helpers.array_equals(self.holders, o.holders)) {
    throw new Error('shares must be held by the same parties (!=)');
  }

  if (op_id == null) {
    op_id = self.jiff.counters.gen_op_id('smod', self.holders);
  }

  var lZp = share_helpers['ceil'](self.jiff.helpers.bLog(self.Zp, 2));
  if (l == null) {
    l = lZp;
  } else {
    l = l < lZp ? l : lZp;
  }

  // Convert to bits
  var dividend_bits = self.bit_decomposition(op_id + ':decomposition1').slice(0, l);
  var divisor_bits = o.bit_decomposition(op_id + ':decomposition2').slice(0, l);

  // Compute by long division
  var remainder_bits = self.jiff.protocols.bits.sdiv(dividend_bits, divisor_bits, op_id + ':bits.sdiv').remainder;
  var remainder = self.jiff.protocols.bits.bit_composition(remainder_bits);
  return remainder;
};