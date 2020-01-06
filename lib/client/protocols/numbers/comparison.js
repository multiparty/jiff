/**
 * Greater than or equal with another share.
 * @method sgteq
 * @param {SecretShare} o - the other share.
 * @param {string} [op_id=auto_gen()] - the operation id which is used to identify this operation.
 *                         This id must be unique, and must be passed by all parties to the same instruction, to
 *                         ensure that corresponding instructions across different parties are matched correctly.
 * @return {SecretShare} this party's share of the result, the final result is 1 if this >= o, and 0 otherwise.
 * @memberof SecretShare
 * @instance
 */
self.sgteq = function (o, op_id) {
  if (!(o.jiff === self.jiff)) {
    throw new Error('shares do not belong to the same instance (>=)');
  }
  if (!self.jiff.helpers.Zp_equals(self, o)) {
    throw new Error('shares must belong to the same field (>=)');
  }
  if (!self.jiff.helpers.array_equals(self.holders, o.holders)) {
    throw new Error('shares must be held by the same parties (>=)');
  }

  if (op_id == null) {
    op_id = self.jiff.counters.gen_op_id('sgteq',self.holders);
  }

  return self.islt(o, op_id).inot();
};

/**
 * Greater than with another share.
 * @method sgt
 * @param {SecretShare} o - the other share.
 * @param {string} [op_id=auto_gen()] - the operation id which is used to identify this operation.
 *                         This id must be unique, and must be passed by all parties to the same instruction, to
 *                         ensure that corresponding instructions across different parties are matched correctly.
 * @return {SecretShare} this party's share of the result, the final result is 1 if this > o, and 0 otherwise.
 * @memberof SecretShare
 * @instance
 */
self.sgt = function (o, op_id) {
  if (!(o.jiff === self.jiff)) {
    throw new Error('shares do not belong to the same instance (>)');
  }
  if (!self.jiff.helpers.Zp_equals(self, o)) {
    throw new Error('shares must belong to the same field (>)');
  }
  if (!self.jiff.helpers.array_equals(self.holders, o.holders)) {
    throw new Error('shares must be held by the same parties (>)');
  }

  if (op_id == null) {
    op_id = self.jiff.counters.gen_op_id('sgt', self.holders);
  }

  return o.islt(self, op_id);
};

/**
 * Less than or equal with another share.
 * @method slteq
 * @param {SecretShare} o - the other share.
 * @param {string} [op_id=auto_gen()] - the operation id which is used to identify this operation.
 *                         This id must be unique, and must be passed by all parties to the same instruction, to
 *                         ensure that corresponding instructions across different parties are matched correctly.
 * @return {SecretShare} this party's share of the result, the final result is 1 if this <= o, and 0 otherwise.
 * @memberof SecretShare
 * @instance
 */
self.slteq = function (o, op_id) {
  if (!(o.jiff === self.jiff)) {
    throw new Error('shares do not belong to the same instance (<=)');
  }
  if (!self.jiff.helpers.Zp_equals(self, o)) {
    throw new Error('shares must belong to the same field (<=)');
  }
  if (!self.jiff.helpers.array_equals(self.holders, o.holders)) {
    throw new Error('shares must be held by the same parties (<=)');
  }

  if (op_id == null) {
    op_id = self.jiff.counters.gen_op_id('slteq', self.holders);
  }

  return o.islt(self, op_id).inot();
};

/**
 * Less than with another share.
 * @method slt
 * @param {SecretShare} o - the other share.
 * @param {string} [op_id=auto_gen()] - the operation id which is used to identify this operation.
 *                         This id must be unique, and must be passed by all parties to the same instruction, to
 *                         ensure that corresponding instructions across different parties are matched correctly.
 * @return {SecretShare} this party's share of the result, the final result is 1 if this < o, and 0 otherwise.
 * @memberof SecretShare
 * @instance
 */
self.slt = function (o, op_id) {
  if (!(o.jiff === self.jiff)) {
    throw new Error('shares do not belong to the same instance (<)');
  }
  if (!self.jiff.helpers.Zp_equals(self, o)) {
    throw new Error('shares must belong to the same field (<)');
  }
  if (!self.jiff.helpers.array_equals(self.holders, o.holders)) {
    throw new Error('shares must be held by the same parties (<)');
  }

  if (op_id == null) {
    op_id = self.jiff.counters.gen_op_id('slt', self.holders);
  }

  var final_deferred = new self.jiff.helpers.Deferred;
  var final_promise = final_deferred.promise;
  var result = self.jiff.secret_share(self.jiff, false, final_promise, undefined, self.holders, Math.max(self.threshold, o.threshold), self.Zp);

  var w = self.ilt_halfprime(op_id + ':halfprime:1');
  Promise.all([w.promise]).then(function () {
    var x = o.ilt_halfprime(op_id + ':halfprime:2');
    Promise.all([x.promise]).then(function () {
      var y = self.issub(o).ilt_halfprime(op_id + ':halfprime:3');
      Promise.all([y.promise]).then(function () {
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
 * @return {SecretShare} this party's share of the result, the final result is 1 if this >= cst, and 0 otherwise.
 * @memberof SecretShare
 * @instance
 */
self.cgteq = function (cst, op_id) {
  if (!(self.isConstant(cst))) {
    throw new Error('parameter should be a number (>=)');
  }

  if (op_id == null) {
    op_id = self.jiff.counters.gen_op_id('cgteq', self.holders);
  }

  return self.iclt(cst, op_id).inot();
};

/**
 * Greater than with a constant.
 * @method cgt
 * @param {number} cst - the constant to compare with.
 * @param {string} [op_id=auto_gen()] - the operation id which is used to identify this operation.
 *                         This id must be unique, and must be passed by all parties to the same instruction, to
 *                         ensure that corresponding instructions across different parties are matched correctly.default ids suffice when all parties execute the
 *                         instructions in the same order.
 * @return {SecretShare} this party's share of the result, the final result is 1 if this > cst, and 0 otherwise.
 * @memberof SecretShare
 * @instance
 */
self.cgt = function (cst, op_id) {
  if (!(self.isConstant(cst))) {
    throw new Error('parameter should be a number (>)');
  }

  if (op_id == null) {
    op_id = self.jiff.counters.gen_op_id('cgt', self.holders);
  }

  var final_deferred = new self.jiff.helpers.Deferred;
  var final_promise = final_deferred.promise;
  var result = self.jiff.secret_share(self.jiff, false, final_promise, undefined, self.holders, self.threshold, self.Zp);

  var w = share_helpers['<'](cst, share_helpers['/'](self.Zp, 2)) ? 1 : 0;
  var x = self.ilt_halfprime(op_id + ':halfprime:1');
  Promise.all([x.promise]).then(function () {
    var y = self.icmult(-1).icadd(cst).ilt_halfprime(op_id + ':halfprime:2');
    Promise.all([y.promise]).then(function () {
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
 * @return {SecretShare} this party's share of the result, the final result is 1 if this <= cst, and 0 otherwise.
 * @memberof SecretShare
 * @instance
 */
self.clteq = function (cst, op_id) {
  if (!(self.isConstant(cst))) {
    throw new Error('parameter should be a number (<=)');
  }

  if (op_id == null) {
    op_id = self.jiff.counters.gen_op_id('clteq', self.holders);
  }

  return self.icgt(cst, op_id).inot();
};

/**
 * Less than with a constant.
 * @method clt
 * @param {number} cst - the constant to compare with.
 * @param {string} [op_id=auto_gen()] - the operation id which is used to identify this operation.
 *                         This id must be unique, and must be passed by all parties to the same instruction, to
 *                         ensure that corresponding instructions across different parties are matched correctly.
 * @return {SecretShare} this party's share of the result, the final result is 1 if this < cst, and 0 otherwise.
 * @memberof SecretShare
 * @instance
 */
self.clt = function (cst, op_id) {
  if (!(self.isConstant(cst))) {
    throw new Error('parameter should be a number (<)');
  }

  if (op_id == null) {
    op_id = self.jiff.counters.gen_op_id('clt', self.holders);
  }

  var final_deferred = new self.jiff.helpers.Deferred;
  var final_promise = final_deferred.promise;
  var result = self.jiff.secret_share(self.jiff, false, final_promise, undefined, self.holders, self.threshold, self.Zp);

  var w = self.ilt_halfprime(op_id + ':halfprime:1');
  Promise.all([w.promise]).then(function () {
    var x = share_helpers['<'](cst, share_helpers['/'](self.Zp, 2)) ? 1 : 0;
    var y = self.icsub(cst).ilt_halfprime(op_id + ':halfprime:2');
    Promise.all([y.promise]).then(function () {
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
 * @param {SecretShare} o - the share to compare with.
 * @param {string} [op_id=auto_gen()] - the operation id which is used to identify this operation.
 *                         This id must be unique, and must be passed by all parties to the same instruction, to
 *                         ensure that corresponding instructions across different parties are matched correctly.
 * @return {SecretShare} this party's share of the result, the final result is 1 if this = o, and 0 otherwise.
 * @memberof SecretShare
 * @instance
 */
self.seq = function (o, op_id) {
  if (!(o.jiff === self.jiff)) {
    throw new Error('shares do not belong to the same instance (==)');
  }
  if (!self.jiff.helpers.Zp_equals(self, o)) {
    throw new Error('shares must belong to the same field (==)');
  }
  if (!self.jiff.helpers.array_equals(self.holders, o.holders)) {
    throw new Error('shares must be held by the same parties (==)');
  }

  if (op_id == null) {
    op_id = self.jiff.counters.gen_op_id('seq', self.holders);
  }

  return self.issub(o).iclteq(0, op_id);
};

/**
 * Unequality test with two shares.
 * @method sneq
 * @param {SecretShare} o - the share to compare with.
 * @param {string} [op_id=auto_gen()] - the operation id which is used to identify this operation.
 *                         This id must be unique, and must be passed by all parties to the same instruction, to
 *                         ensure that corresponding instructions across different parties are matched correctly.
 * @return {SecretShare} this party's share of the result, the final result is 0 if this = o, and 1 otherwise.
 * @memberof SecretShare
 * @instance
 */
self.sneq = function (o, op_id) {
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
    op_id = self.jiff.counters.gen_op_id('sneq', self.holders);
  }
  return self.iseq(o, op_id).inot();
};

/**
 * Equality test with a constant.
 * @method ceq
 * @param {number} cst - the constant to compare with.
 * @param {string} [op_id=auto_gen()] - the operation id which is used to identify this operation.
 *                         This id must be unique, and must be passed by all parties to the same instruction, to
 *                         ensure that corresponding instructions across different parties are matched correctly.
 * @return {SecretShare} this party's share of the result, the final result is 0 if this = o, and 1 otherwise.
 * @memberof SecretShare
 * @instance
 */
self.ceq = function (cst, op_id) {
  if (!(self.isConstant(cst))) {
    throw new Error('parameter should be a number (==)');
  }

  if (op_id == null) {
    op_id = self.jiff.counters.gen_op_id('ceq', self.holders);
  }

  return self.icsub(cst).iclteq(0, op_id);
};

/**
 * Unequality test with a constant.
 * @method cneq
 * @param {number} cst - the constant to compare with.
 * @param {string} [op_id=auto_gen()] - the operation id which is used to identify this operation.
 *                         This id must be unique, and must be passed by all parties to the same instruction, to
 *                         ensure that corresponding instructions across different parties are matched correctly.
 * @return {SecretShare} this party's share of the result, the final result is 0 if this = o, and 1 otherwise.
 * @memberof SecretShare
 * @instance
 */
self.cneq = function (cst, op_id) {
  if (!(self.isConstant(cst))) {
    throw new Error('parameter should be a number (!=)');
  }
  if (op_id == null) {
    op_id = self.jiff.counters.gen_op_id('cneq', self.holders);
  }
  return self.iceq(cst, op_id).inot();
};

/**
 * Checks whether the share is less than half the field size.
 * @method lt_halfprime
 * @memberof SecretShare
 * @instance
 * @param {string} [op_id=auto_gen()] - the operation id which is used to identify this operation.
 *                         This id must be unique, and must be passed by all parties to the same instruction, to
 *                         ensure that corresponding instructions across different parties are matched correctly.
 * @return {SecretShare} this party's share of the result.
 */
self.lt_halfprime = function (op_id) {
  if (op_id == null) {
    op_id = self.jiff.counters.gen_op_id('lt_halfprime', self.holders);
  }

  // if share is even, then self is less than half the prime, otherwise, share is greater than half the prime
  var share = self.icmult(2);

  // to check if share is even, we will use pre-shared bits as some form of a bit mask
  var bitLength = share_helpers['ceil'](self.jiff.helpers.bLog(share.Zp, 2));

  // Create result share
  var final_deferred = new self.jiff.helpers.Deferred;
  var final_promise = final_deferred.promise;
  var result = self.jiff.secret_share(self.jiff, false, final_promise, undefined, self.holders, self.threshold, self.Zp);

  // Execute protocol when randomly sampled bit-wise random number is ready
  var ready_sampling = function (bits) {
    // if 2*self is even, then self is less than half prime, otherwise self is greater or equal to half prime
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
  var bits = self.jiff.get_preprocessing(op_id + ':sampling');
  if (bits == null) {
    var promise = self.jiff.from_crypto_provider('numbers', self.holders, self.threshold, self.Zp, op_id + ':sampling', {bitLength: bitLength, count: 1, max: self.Zp});
    promise.then(function (msg) {
      ready_sampling(msg['shares']);
    });
  } else {
    ready_sampling(bits);
  }

  return result;
};