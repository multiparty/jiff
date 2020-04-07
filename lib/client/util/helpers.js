var helpers = require('../../common/helpers.js');

/**
 * Contains helper functions: these may be overriden by extensions to customize behavior
 * @see {@link module:jiff-client~JIFFClient#helpers}
 * @name helpers
 * @alias helpers
 * @namespace
 */

module.exports = function (jiffClient) {
  /**
   * Polyfill for jQuery Deferred
   * From https://developer.mozilla.org/en-US/docs/Mozilla/JavaScript_code_modules/Promise.jsm/Deferred
   * @memberof helpers
   * @constructor Deferred
   */
  jiffClient.helpers.Deferred = function () {
    /**
     * A method to resolve the associate Promise with the value passed.
     * @method resolve
     * @memberof helpers.Deferred
     * @instance
     * @param {*} value - the value to resolve the promise with
     */
    this.resolve = null;

    /**
     * A method to reject the associated Promise with the value passed.
     * If the promise is already settled it does nothing.
     * @method reject
     * @memberof helpers.Deferred
     * @instance
     * @param {*} reason - The reason for the rejection of the Promise.
     * Generally its an Error object. If however a Promise is passed, then the Promise
     * itself will be the reason for rejection no matter the state of the Promise.
     */
    this.reject = null;

    /**
     * A newly created Promise object.
     * Initially in pending state.
     * @memberof helpers.Deferred
     * @member {Promise} promise
     * @instance
     */
    this.promise = new Promise(function (resolve, reject) {
      this.resolve = resolve;
      this.reject = reject;
    }.bind(this));

    Object.freeze(this);
  };

  /**
   * Correct Mod instead of javascript's remainder (%).
   * @memberof helpers
   * @method
   * @param {number} x - the number.
   * @param {number} y - the mod.
   * @return {number} x mod y.
   */
  jiffClient.helpers.mod = helpers.mod;

  /**
   * Ceil of a number.
   * @memberof helpers
   * @method
   * @param {number} x - the number to ceil.
   * @return {number} ceil of x.
   */
  jiffClient.helpers.ceil = Math.ceil;

  /**
   * Floor of a number
   * @memberof helpers
   * @method
   * @param {number} x - the number to floor.
   * @return {number} floor of x.
   */
  jiffClient.helpers.floor = Math.floor;

  /**
   * Fast Exponentiation Mod
   * @memberof helpers
   * @method
   * @param {number} a - the base number
   * @param {number} b - the power
   * @param {number} n - the mod
   * @return {number} (base^pow) mod m
   */
  jiffClient.helpers.pow_mod = function (a, b, n) {
    a = jiffClient.helpers.mod(a, n);
    var result = 1;
    var x = a;
    while (b > 0) {
      var leastSignificantBit = jiffClient.helpers.mod(b, 2);
      b = Math.floor(b / 2);
      if (leastSignificantBit === 1) {
        result = result * x;
        result = jiffClient.helpers.mod(result, n);
      }
      x = x * x;
      x = jiffClient.helpers.mod(x, n);
    }
    return result;
  };

  /**
   * Extended Euclidean for finding inverses.
   * @method
   * @memberof helpers
   * @param {number} a - the number to find inverse for.
   * @param {number} b - the mod.
   * @return {number[]} [inverse of a mod b, coefficient for a, coefficient for b].
   */
  jiffClient.helpers.extended_gcd = function (a, b) {
    if (b === 0) {
      return [1, 0, a];
    }

    var temp = jiffClient.helpers.extended_gcd(b, jiffClient.helpers.mod(a, b));
    var x = temp[0];
    var y = temp[1];
    var d = temp[2];
    return [y, x - y * Math.floor(a / b), d];
  };

  /**
   * Compute Log to a given base.
   * @method
   * @memberof helpers
   * @param {number} value - the number to find log for.
   * @param {number} [base=2] - the base (2 by default).
   * @return {number} log(value) with the given base.
   */
  jiffClient.helpers.bLog = function (value, base) {
    if (base == null) {
      base = 2;
    }
    return Math.log(value) / Math.log(base);
  };

  /**
   * Check that two sorted arrays are equal.
   * @method
   * @memberof helpers
   * @param {Array} arr1 - the first array.
   * @param {Array} arr2 - the second array.
   * @return {boolean} true if arr1 is equal to arr2, false otherwise.
   */
  jiffClient.helpers.array_equals = function (arr1, arr2) {
    if (arr1.length !== arr2.length) {
      return false;
    }

    for (var i = 0; i < arr1.length; i++) {
      if (arr1[i] !== arr2[i]) {
        return false;
      }
    }

    return true;
  };

  /**
   * Check that two Zps are equal. Used to determine if shares can be computed on or not.
   * @method
   * @memberof helpers
   * @param {SecretShare} s1 - the first share.
   * @param {SecretShare} s2 - the second share.
   * @return {boolean} true both shares have the same Zp, false otherwise.
   */
  jiffClient.helpers.Zp_equals = function (s1, s2) {
    return s1.Zp === s2.Zp;
  };

  /**
   * Generate a random integer between 0 and max-1 [inclusive].
   * Modify this to change the source of randomness and how it is generated.
   * @method
   * @memberof helpers
   * @param {number} max - the maximum number.
   * @return {number} the random number.
   */
  jiffClient.helpers.random = helpers.random;

  /**
   * Get the party number from the given party_id, the number is used to compute/open shares.
   * If party id was a number (regular party), that number is returned,
   * If party id refers to the ith server, then party_count + i is returned (i > 0).
   * @method
   * @memberof helpers
   * @param {number|string} party_id - the party id from which to compute the number.
   * @return {number} the party number (> 0).
   */
  jiffClient.helpers.get_party_number = helpers.get_party_number;

  /**
   * Transforms the given number to an array of bits (numbers).
   * Lower indices in the returned array corresponding to less significant bits.
   * @memberof helpers
   * @method
   * @param {number} number - the number to transform to binary
   * @param {length} [length=ceil(log2(number))] - if provided, then the given array will be padded with zeros to the length.
   * @return {number[]} the array of bits.
   */
  jiffClient.helpers.number_to_bits = helpers.number_to_bits;

  /**
   * Transforms the given array of bits to a number.
   * @memberof helpers
   * @method
   * @param {number[]} bits - the array of bits to compose as a number, starting from least to most significant bits.
   * @param {number} [length = bits.length] - if provided, only the first 'length' bits will be used
   * @return {number} the array of bits.
   */
  jiffClient.helpers.bits_to_number = function (bits, length) {
    if (length == null || length > bits.length) {
      length = bits.length;
    }
    return parseInt(bits.slice(0, length).reverse().join(''), 2);
  };

  /**
   * Checks if the given number is prime using AKS primality test
   * @method
   * @memberof helpers
   * @param {number} p - the number to check
   * @return {boolean} true if p is prime, false otherwise
   */
  jiffClient.helpers.is_prime = function (p) {
    // AKS Primality Test

    if (p === 2) {
      return true;
    } else if (p === 3) {
      return true;
    } else if (p % 2 === 0) {
      return false;
    } else if (p % 3 === 0) {
      return false;
    }

    var i = 5;
    var n = 2;
    while (i * i <= p) {
      if (p % i === 0) {
        return false;
      }
      i += n;
      n = 6 - n;
    }

    return true;
  };

  /**
   * sorts an array of ids (in place) according to a consistent ordering
   * @method
   * @memberof helpers
   * @param {array} ids - array of ids containing numbers or "s1"
   */
  jiffClient.helpers.sort_ids = function (ids) {
    if (ids.__jiff_sorted) {
      return;
    }

    ids.sort(function (e1, e2) {
      if (e1 === e2) {
        throw new Error('ids array has duplicated: ' + ids.toString());
      }
      if (e1 === 's1') {
        return 1;
      }
      if (e2 === 's1') {
        return -1;
      }
      return e1 - e2;
    });
    ids.__jiff_sorted = true;
  }
};