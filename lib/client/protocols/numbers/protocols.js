/**
 * Reshares/refreshes the sharing of this number, used before opening to keep the share secret.
 * @method refresh
 * @param {string} [op_id=auto_gen()] - the operation id with which to tag the messages sent by this refresh, by default
 *                         an automatic operation id is generated by increasing a local counter, default operation ids
 *                         suffice when all parties execute the instructions in the same order.
 * @returns {SecretShare} a new share of the same number.
 * @memberof SecretShare
 * @instance
 */
self.refresh = function (op_id) {
  if (op_id == null) {
    op_id = self.jiff.counters.gen_op_id('refresh', self.holders);
  }

  // final result
  var final_deferred = new self.jiff.helpers.Deferred;
  var final_promise = final_deferred.promise;
  var result = self.jiff.secret_share(self.jiff, false, final_promise, undefined, self.holders, self.threshold, self.Zp);

  // refresh
  var ready_number = function (zero) {
    self.isadd(zero).wThen(final_deferred.resolve);
  };

  // get shares of zero
  var zero = self.jiff.get_preprocessing(op_id);
  if (zero == null) {
    var promise = self.jiff.from_crypto_provider('numbers', self.holders, self.threshold, self.Zp, op_id, {number: 0, count: 1});
    promise.then(function (msg) {
      ready_number(msg['shares'][0]);
    });
  } else {
    ready_number(zero);
  }

  return result;
};

/**
 * Bit Decomposition: Transform existing share to an array of bit shares.
 * @method bit_decomposition
 * @memberof SecretShare
 * @instance
 * @param {string} [op_id=auto_gen()] - the operation id which is used to identify this operation.
 *                         This id must be unique, and must be passed by all parties to the same instruction, to
 *                         ensure that corresponding instructions across different parties are matched correctly.
 * @returns {SecretShare[]} an array of secret shares of bits of length [ceil(self.Zp)], where
 *   index 0 represents the least significant bit.
 */
self.bit_decomposition = function (op_id) {
  if (op_id == null) {
    op_id = self.jiff.counters.gen_op_id('bit_decomposition', self.holders);
  }

  var bitLength = self.Zp.toString(2).length;

  // Create deferred shares to resolve to later when the computation completes
  var many_shares = many_secret_shares(jiff, bitLength, self.holders, self.threshold, self.Zp);
  var deferreds = many_shares.deferreds;
  var result = many_shares.shares;

  // Execute protocol when randomly sampled bit-wise random number is ready
  var ready_sampling = function (bits) {
    var r = self.jiff.protocols.bits.bit_composition(bits);
    // add and reveal random number to self
    self.jiff.internal_open(r.isadd(self), self.holders, op_id + ':open').then(function (result) {
      // compute bits assuming r+self < Zp
      var noWrap = self.jiff.protocols.bits.csubr(result, bits, op_id + ':bits.csubr:1');
      var didWrap = noWrap.pop();

      // compute bits assuming r+self >= Zp
      var withWrap = self.jiff.protocols.bits.csubr(share_helpers['+'](result, self.Zp), bits, op_id + ':bits.csubr:2');
      withWrap.pop(); // withWrap cannot underflow!

      // choose noWrap if first subtraction does not overflow (sign bit is zero), otherwise choose withWrap.
      for (var i = 0; i < bitLength; i++) {
        withWrap[i] = didWrap.iif_else(withWrap[i], noWrap[i], op_id + ':if_else:' + i);
      }
      resolve_many_secrets(deferreds, withWrap);
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