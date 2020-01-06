/**
 * Secret share objects: provides API to perform operations on shares securly, wrap promises
 * and communication primitives to ensure operations are executed when shares are available (asynchronously)
 * without requiring the user to perform promise management/synchronization.
 * @namespace SecretShare
 */

/**
 * Create a new share.
 * A share is a value wrapper with a share object, it has a unique id
 * (per computation instance), and a pointer to the instance it belongs to.
 * A share also has methods for performing operations.
 * @param {jiff-instance} jiff - the jiff instance.
 * @param {boolean} ready - whether the value of the share is ready or deferred.
 * @param {promise} promise - a promise to the value of the share.
 * @param {number} value - the value of the share (null if not ready).
 * @param {Array} holders - the parties that hold all the corresponding shares (must be sorted).
 * @param {number} threshold - the min number of parties needed to reconstruct the secret.
 * @param {number} Zp - the mod under which this share was created.
 * @return {SecretShare} the secret share object containing the give value.
 *
 */
function secret_share(jiff, ready, promise, value, holders, threshold, Zp) {
  var self = {};

  /**
   * @member {jiff-instance} jiff
   * @memberof SecretShare
   * @instance
   */
  self.jiff = jiff;

  /**
   * @member {boolean} ready
   * @memberof SecretShare
   * @instance
   */
  self.ready = ready;

  /**
   * @member {promise} promise
   * @memberof SecretShare
   * @instance
   */
  self.promise = promise;
  /**
   * @member {number} value
   * @memberof SecretShare
   * @instance
   */
  self.value = value;
  /**
   * @member {Array} holders
   * @memberof SecretShare
   * @instance
   */
  self.holders = holders;
  /**
   * @member {Array} threshold
   * @memberof SecretShare
   * @instance
   */
  self.threshold = threshold;
  /**
   * @member {number} Zp
   * @memberof SecretShare
   * @instance
   */
  self.Zp = Zp;

  /**
   * Gets the value of this share.
   * @method valueOf
   * @returns {number} the value (undefined if not ready yet).
   * @memberof SecretShare
   * @instance
   */
  self.valueOf = function () {
    if (ready) {
      return self.value;
    } else {
      return undefined;
    }
  };

  /**
   * Gets a string representation of this share.
   * @method toString
   * @returns {string} the id and value of the share as a string.
   * @memberof SecretShare
   * @instance
   */
  self.toString = function () {
    var val = self.ready ? self.value : '<deferred>';
    return 'share: ' + val + '. Holders: ' + JSON.stringify(self.holders) + '. Threshold: ' + self.threshold + '. Zp: ' + self.Zp.toString() + '.';
  };

  /**
   * Logs an error.
   * @method error
   * @memberof SecretShare
   * @instance
   */
  self.error = self.jiff.error.bind(null, 'secret-share');

  /**
   * Logs the value represented by this share to the console.
   * WARNING: THIS LEAKS INFORMATION AND MUST BE USED ONLY TO DEBUG ON FAKE DATA.
   * @method logLEAK
   * @memberof SecretShare
   * @instance
   * @param {string} tag - accompanying tag to display in the console.
   * @param {Array<number|string>} [parties=[holders[0]] - the parties which will display the log.
   * @return {promise} a promise to the value represented by this share after logging it, null if party is not in parties.
   */
  self.logLEAK = function (tag, parties) {
    if (parties == null) {
      parties = [self.holders[0]];
    }
    var promise = self.open(parties, tag);
    if (promise != null) {
      promise = promise.then(function (result) {
        console.log(tag, result.toString());
        return result;
      });
    }
    return promise;
  };

  /**
   * Receives the value of this share when ready.
   * @method receive_share
   * @param {number} value - the value of the share.
   * @memberof SecretShare
   * @instance
   */
  self.receive_share = function (value) {
    self.value = value;
    self.ready = true;
    self.promise = null;
  };

  /**
   * Joins the pending promises of this share and the given share.
   * @method pick_promise
   * @param {SecretShare} o - the other share object.
   * @returns {promise} the joined promise for both shares (or whichever is pending).
   * @memberof SecretShare
   * @instance
   */
  self.pick_promise = function (o) {
    if (self.ready && o.ready) {
      return null;
    }

    if (self.ready) {
      return o.promise;
    } else if (o.ready) {
      return self.promise;
    } else {
      return Promise.all([self.promise, o.promise]);
    }
  };

  /**
   * Checks if the given parameter is a constant, used to determine whether constant or secret
   * operations should be executed.
   * @param {number/object} o - the parameter to determine.
   * @return {boolean} true if o is a valid constant, false otherwise.
   */
  self.isConstant = function (o) {
    return typeof(o) === 'number';
  };

  /**
   * Shortcut for opening/revealing the value of this share. Alias for open in jiff-instance.
   * @see jiff-instance#open
   * @method open
   * @memberof SecretShare
   * @instance
   * @param {Array} [parties=all_parties] - an array with party ids (1 to n) of receiving parties.
   * @param {string|number|object} [op_id=auto_gen()] - same as jiff_instance.open
   * @returns {promise|null} a (JQuery) promise to the open value of the secret, null if the party is not specified in the parties array as a receiver.
   */
  self.open = function (parties, op_id) {
    return self.jiff.open(self, parties, op_id);
  };

  /**
   * Generic Addition.
   * Uses either the constant or secret version of this operator depending on type of paramter.
   * @method add
   * @param {number|SecretShare} o - the other operand (can be either number or share).
   * @return {SecretShare} this party's share of the result.
   * @memberof SecretShare
   * @instance
   * @example
   * var shares = jiff_instance.share(input);
   * // this will add two secret shared values together
   * var result = shares[1].add(shares[2]);
   * // this will add 3 to the secret input from party 1
   * var constant_sum = shares[1].add(3);
   */
  self.add = function (o) {
    if (self.isConstant(o)) {
      return self.cadd(o);
    }
    return self.sadd(o);
  };


  /**
   * Generic Subtraction.
   * Uses either the constant or secret version of this operator depending on type of paramter.
   * @method sub
   * @param {number|SecretShare} o - the other operand (can be either number or share).
   * @return {SecretShare} this party's share of the result.
   * @memberof SecretShare
   * @instance
   */
  self.sub = function (o) {
    if (self.isConstant(o)) {
      return self.csub(o);
    }
    return self.ssub(o);
  };


  /**
   * Generic Multiplication.
   * Uses either the constant or secret version of this operator depending on type of paramter.
   * @method mult
   * @param {number|SecretShare} o - the other operand (can be either number or share).
   * @param {string} [op_id=auto_gen()] - the operation id which is used to identify this multiplication (and internally, the corresponding beaver triplet).
   *                         This id must be unique, and must be passed by all parties to the same instruction.
   *                         this ensures that every party gets a share from the same triplet for every matching instruction. An automatic id
   *                         is generated by increasing a local counter, default ids suffice when all parties execute the
   *                         instructions in the same order. Only used if secret multiplication is used.
   * @return {SecretShare} this party's share of the result.
   * @memberof SecretShare
   * @instance
   */
  self.mult = function (o, op_id) {
    if (self.isConstant(o)) {
      return self.cmult(o);
    }
    return self.smult(o, op_id);
  };


  /**
   * Generic XOR for bits (both this and o have to be bits to work correctly).
   * Uses either the constant or secret version of this operator depending on type of paramter.
   * @method xor_bit
   * @param {number|SecretShare} o - the other operand (can be either number or share).
   * @param {string} [op_id=auto_gen()] - the operation id which is used to identify this operation.
   *                         This id must be unique, and must be passed by all parties to the same instruction, to
   *                         ensure that corresponding instructions across different parties are matched correctly.
   *                         Only used if secret xor is used..
   * @return {SecretShare} this party's share of the result, the final result is 1 if this < o, and 0 otherwise.
   * @return {SecretShare} this party's share of the result.
   * @memberof SecretShare
   * @instance
   */
  self.xor_bit = function (o, op_id) {
    if (self.isConstant(o)) {
      return self.cxor_bit(o);
    }
    return self.sxor_bit(o, op_id);
  };

  /**
   * Generic OR for bits (both this and o have to be bits to work correctly).
   * Uses either the constant or secret version of this operator depending on type of paramter.
   * @method or_bit
   * @param {number|SecretShare} o - the other operand (can be either number or share).
   * @param {string} [op_id=auto_gen()] - the operation id which is used to identify this operation.
   *                         This id must be unique, and must be passed by all parties to the same instruction, to
   *                         ensure that corresponding instructions across different parties are matched correctly.
   *                         Only used if secret or is used..
   * @return {SecretShare} this party's share of the result.
   * @memberof SecretShare
   * @instance
   */
  self.or_bit = function (o, op_id) {
    if (self.isConstant(o)) {
      return self.cor_bit(o);
    }
    return self.sor_bit(o, op_id);
  };

  /**
   * Generic Greater or equal.
   * Uses either the constant or secret version of this operator depending on type of paramter.
   * @method gteq
   * @param {number|SecretShare} o - the other operand (can be either number or share).
   * @param {string} [op_id=auto_gen()] - the operation id which is used to identify this operation.
   *                         This id must be unique, and must be passed by all parties to the same instruction, to
   *                         ensure that corresponding instructions across different parties are matched correctly.
   * @return {SecretShare} this party's share of the result.
   * @memberof SecretShare
   * @instance
   */
  self.gteq = function (o, op_id) {
    if (self.isConstant(o)) {
      return self.cgteq(o, op_id);
    }
    return self.sgteq(o);
  };


  /**
   * Generic Greater than.
   * Uses either the constant or secret version of this operator depending on type of paramter.
   * @method gt
   * @param {number|SecretShare} o - the other operand (can be either number or share).
   * @param {string} [op_id=auto_gen()] - the operation id which is used to identify this operation.
   *                         This id must be unique, and must be passed by all parties to the same instruction, to
   *                         ensure that corresponding instructions across different parties are matched correctly.
   * @return {SecretShare} this party's share of the result.
   * @memberof SecretShare
   * @instance
   */
  self.gt = function (o, op_id) {
    if (self.isConstant(o)) {
      return self.cgt(o, op_id);
    }
    return self.sgt(o, op_id);
  };


  /**
   * Generic Less or equal.
   * Uses either the constant or secret version of this operator depending on type of paramter.
   * @method lteq
   * @param {number|SecretShare} o - the other operand (can be either number or share).
   * @param {string} [op_id=auto_gen()] - the operation id which is used to identify this operation.
   *                         This id must be unique, and must be passed by all parties to the same instruction, to
   *                         ensure that corresponding instructions across different parties are matched correctly.
   * @return {SecretShare} this party's share of the result.
   * @memberof SecretShare
   * @instance
   */
  self.lteq = function (o, op_id) {
    if (self.isConstant(o)) {
      return self.clteq(o, op_id);
    }
    return self.slteq(o, op_id);
  };


  /**
   * Generic Less than.
   * Uses either the constant or secret version of this operator depending on type of paramter.
   * @method lt
   * @param {number|SecretShare} o - the other operand (can be either number or share).
   * @param {string} [op_id=auto_gen()] - the operation id which is used to identify this operation.
   *                         This id must be unique, and must be passed by all parties to the same instruction, to
   *                         ensure that corresponding instructions across different parties are matched correctly.
   * @return {SecretShare} this party's share of the result.
   * @memberof SecretShare
   * @instance
   */
  self.lt = function (o, op_id) {
    if (self.isConstant(o)) {
      return self.clt(o, op_id);
    }
    return self.slt(o, op_id);
  };


  /**
   * Generic Equals.
   * Uses either the constant or secret version of this operator depending on type of paramter.
   * @method eq
   * @param {number|SecretShare} o - the other operand (can be either number or share).
   * @param {string} [op_id=auto_gen()] - the operation id which is used to identify this operation.
   *                         This id must be unique, and must be passed by all parties to the same instruction, to
   *                         ensure that corresponding instructions across different parties are matched correctly.
   * @return {SecretShare} this party's share of the result.
   * @memberof SecretShare
   * @instance
   */
  self.eq = function (o, op_id) {
    if (self.isConstant(o)) {
      return self.ceq(o, op_id);
    }
    return self.seq(o, op_id);
  };


  /**
   * Generic Not Equals.
   * Uses either the constant or secret version of this operator depending on type of paramter.
   * @method neq
   * @param {number|SecretShare} o - the other operand (can be either number or share).
   * @param {string} [op_id=auto_gen()] - the operation id which is used to identify this operation.
   *                         This id must be unique, and must be passed by all parties to the same instruction, to
   *                         ensure that corresponding instructions across different parties are matched correctly.
   * @return {SecretShare} this party's share of the result.
   * @memberof SecretShare
   * @instance
   */
  self.neq = function (o, op_id) {
    if (self.isConstant(o)) {
      return self.cneq(o, op_id);
    }
    return self.sneq(o, op_id);
  };


  /**
   * Generic Integer Divison.
   * Uses either the constant or secret version of this operator depending on type of paramter.
   * @method div
   * @param {number|SecretShare} o - the other operand (can be either number or share).
   * @param {number} l - the maximum bit length of the two shares.
   * @param {string} [op_id=auto_gen()] - the operation id which is used to identify this operation.
   *                         This id must be unique, and must be passed by all parties to the same instruction, to
   *                         ensure that corresponding instructions across different parties are matched correctly.
   * @return {SecretShare} this party's share of the result.
   * @memberof SecretShare
   * @instance
   */
  self.div = function (o, l, op_id) {
    if (self.isConstant(o)) {
      return self.cdiv(o, l, op_id);
    }
    return self.sdiv(o, l, op_id);
  };

  // when the promise is resolved, acquire the value of the share and set ready to true
  if (!ready) {
    self.promise.then(self.receive_share, self.error);
    self.jiff.add_to_barriers(self.promise);
  }

  /**
   * Wrapper around share.promise.then
   * In case share is ready (its promise is resolved and cleared)
   * The callback is executed immediately.
   * Does not support chaining.
   * @method wThen
   * @memberof SecretShare
   * @instance
   * @param {function} onFulfilled - callback for success, called with self.value as parameter.
   * @param {function} [onRejected] - callback for errors.
   */
  self.wThen = function (onFulfilled, onRejected) {
    if (self.value != null) {
      onFulfilled(self.value);
    } else {
      if (onRejected == null) {
        onRejected = self.error;
      }
      self.promise.then(onFulfilled, onRejected);
    }
  };

  // internal variant of primitives, to use internally by other primitives
  var internals = ['cadd', 'csub', 'cmult', 'sadd', 'ssub', 'smult', 'smult_bgw',
    'cxor_bit', 'sxor_bit', 'cor_bit', 'sor_bit',
    'slt', 'slteq', 'sgt', 'sgteq', 'seq', 'sneq',
    'clt', 'clteq', 'cgt', 'cgteq', 'ceq', 'cneq',
    'sdiv', 'cdiv', 'not', 'lt_halfprime', 'if_else'];
  for (var i = 0; i < internals.length; i++) {
    var key = internals[i];
    self['i' + key] = self[key];
  }

  // return the share
  return jiff.execute_array_hooks('createSecretShare', [jiff, self, share_helpers], 1);
}