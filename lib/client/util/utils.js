/**
 * Create an array of secret shares and associated deferred.
 * @param {jiff-instance} jiff - the jiff instance.
 * @param {number} count - number of secret shares.
 * @param {Array} holders - the parties that hold all the corresponding shares (must be sorted).
 * @param {number} threshold - the min number of parties needed to reconstruct the secret.
 * @param {number} Zp - the mod under which this share was created.
 * @return {object} the secret share object containing the give value.
 *
 */
function many_secret_shares(jiff, count, holders, threshold, Zp) {
  var deferreds = [];
  var shares = [];
  for (var i = 0; i < count; i++) {
    var deferred = new jiff.helpers.Deferred;
    shares.push(jiff.secret_share(jiff, false, deferred.promise, undefined, holders, threshold, Zp));
    deferreds.push(deferred);
  }

  return { shares: shares, deferreds: deferreds };
}

/**
 * Resolve the array of deferreds with the values of the given shares when ready, matched by index.
 * @param {Deferred[]} deferreds - the deferred to resolve.
 * @param {SecretShare[]} shares - the shares to resolve with.
 */
function resolve_many_secrets(deferreds, shares) {
  for (var i = 0; i < deferreds.length; i++) {
    shares[i].wThen(deferreds[i].resolve);
  }
}

/**
 * A high level combinator for iteration of bit arrays.
 * It executes a round of (func) starting from index 0 to the length.
 * Every round is blocked until the previous one finishes and the promise produced by it
 * is resolved.
 * The final value is used to resolve deferred.
 */
function bit_combinator(deferred, start, length, initial, func, promisify, valufy) {
  if (promisify == null) {
    promisify = function (share) {
      return { then: share.wThen };
    }
  }

  if (valufy == null) {
    valufy = function (share) {
      return share.value;
    }
  }

  var next = start <= length ? 1 : -1;
  var __bit_combinator = function (start, val) {
    if (start === length) {
      // done
      deferred.resolve(valufy(val));
      return;
    }

    // execute func once
    val = func(start, val);

    // when done, do next iteration
    promisify(val).then(function () {
      __bit_combinator(start + next, val);
    });
  };

  // start combinator
  if (initial == null) {
    __bit_combinator(start, initial);
  } else {
    promisify(initial).then(function () {
      __bit_combinator(start, initial);
    });
  }
}