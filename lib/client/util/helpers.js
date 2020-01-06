var sampling = require('../../common/sampling.js');

/**
 * Polyfill for jQuery Deferred
 * From https://developer.mozilla.org/en-US/docs/Mozilla/JavaScript_code_modules/Promise.jsm/Deferred
 * @memberof jiff-instance.helpers
 * @constructor Deferred
 * @instance
 * @return {Deferred} a new Deferred.
 */
jiff.helpers.Deferred = function () {
  // Polyfill for jQuery Deferred
  // From https://developer.mozilla.org/en-US/docs/Mozilla/JavaScript_code_modules/Promise.jsm/Deferred
  this.resolve = null;

  /* A method to reject the associated Promise with the value passed.
   * If the promise is already settled it does nothing.
   *
   * @param {anything} reason: The reason for the rejection of the Promise.
   * Generally its an Error object. If however a Promise is passed, then the Promise
   * itself will be the reason for rejection no matter the state of the Promise.
   */
  this.reject = null;

  /* A newly created Promise object.
   * Initially in pending state.
   */
  this.promise = new Promise(function (resolve, reject) {
    this.resolve = resolve;
    this.reject = reject;
  }.bind(this));
  Object.freeze(this);
};

/**
 * Correct Mod instead of javascript's remainder (%).
 * @memberof jiff-instance.helpers
 * @function mod
 * @instance
 * @param {number} x - the number.
 * @param {number} y - the mod.
 * @return {number} x mod y.
 */
jiff.helpers.mod = function (x, y) {
  if (x < 0) {
    return (x % y) + y;
  }
  return x % y;
};

/**
 * Ceil of a number.
 * @memberof jiff-instance.helpers
 * @function ceil
 * @instance
 * @param {number} x - the number to ceil.
 * @return {number} ceil of x.
 */
jiff.helpers.ceil = Math.ceil;

/**
 * Floor of a number
 * @memberof jiff-instance.helpers
 * @function floor
 * @instance
 * @param {number} x - the number to floor.
 * @return {number} floor of x.
 */
jiff.helpers.floor = Math.floor;

/**
 * Fast Exponentiation Mod.
 * @memberof jiff-instance.helpers
 * @function pow_mod
 * @instance
 * @param {number} a - the base number.
 * @param {number} b - the power.
 * @param {number} n - the mod.
 * @return {number} (base^pow) mod m.
 */
jiff.helpers.pow_mod = function (a, b, n) {
  a = jiff.helpers.mod(a, n);
  var result = 1;
  var x = a;
  while (b > 0) {
    var leastSignificantBit = jiff.helpers.mod(b, 2);
    b = Math.floor(b / 2);
    if (leastSignificantBit === 1) {
      result = result * x;
      result = jiff.helpers.mod(result, n);
    }
    x = x * x;
    x = jiff.helpers.mod(x, n);
  }
  return result;
};

/**
 * Extended Euclidean for finding inverses.
 * @method extended_gcd
 * @memberof jiff-instance.helpers
 * @instance
 * @param {number} a - the number to find inverse for.
 * @param {number} b - the mod.
 * @return {number[]} [inverse of a mod b, coefficient for a, coefficient for b].
 */
jiff.helpers.extended_gcd = function (a, b) {
  if (b === 0) {
    return [1, 0, a];
  }

  var temp = jiff.helpers.extended_gcd(b, jiff.helpers.mod(a, b));
  var x = temp[0];
  var y = temp[1];
  var d = temp[2];
  return [y, x - y * Math.floor(a / b), d];
};

/**
 * Compute Log to a given base.
 * @method bLog
 * @memberof jiff-instance.helpers
 * @instance
 * @param {number} value - the number to find log for.
 * @param {number} [base=2] - the base (2 by default).
 * @return {number} log(value) with the given base.
 */
jiff.helpers.bLog = function (value, base) {
  if (base == null) {
    base = 2;
  }
  return Math.log(value) / Math.log(base);
};

/**
 * Check that two sorted arrays are equal.
 * @method array_equals
 * @memberof jiff-instance.helpers
 * @instance
 * @param {Array} arr1 - the first array.
 * @param {Array} arr2 - the second array.
 * @return {boolean} true if arr1 is equal to arr2, false otherwise.
 */
jiff.helpers.array_equals = function (arr1, arr2) {
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
 * @method Zp_equals
 * @memberof jiff-instance.helpers
 * @instance
 * @param {SecretShare} s1 - the first share.
 * @param {SecretShare} s2 - the second share.
 * @return {boolean} true both shares have the same Zp, false otherwise.
 */
jiff.helpers.Zp_equals = function (s1, s2) {
  return s1.Zp === s2.Zp;
};

/**
 * Generate a random integer between 0 and max-1 [inclusive].
 * Modify this to change the source of randomness and how it is generated.
 * @method random
 * @memberof jiff-instance.helpers
 * @instance
 * @param {number} max - the maximum number.
 * @return {number} the random number.
 */
jiff.helpers.random = sampling.random;

/**
 * Get the party number from the given party_id, the number is used to compute/open shares.
 * If party id was a number (regular party), that number is returned,
 * If party id refers to the ith server, then party_count + i is returned (i > 0).
 * @memberof jiff-instance.helpers
 * @instance
 * @param {number/string} party_id - the party id from which to compute the number.
 * @return {number} the party number (> 0).
 */
jiff.helpers.get_party_number = function (party_id) {
  if (typeof(party_id) === 'number') {
    return party_id;
  }
  if (party_id.startsWith('s')) {
    return -1 * parseInt(party_id.substring(1), 10);
  }
  return parseInt(party_id, 10);
};

/**
 * Transforms the given number to an array of bits (numbers).
 * Lower indices in the returned array corresponding to less significant bits.
 * @memberof jiff-instance.helpers
 * @instance
 * @param {number} number - the number to transform to binary
 * @param {length} [length=ceil(log2(number))] - if provided, then the given array will be padded with zeros to the length.
 * @return {number[]} the array of bits.
 */
jiff.helpers.number_to_bits = function (number, length) {
  number = number.toString(2);
  var bits = [];
  for (var i = 0; i < number.length; i++) {
    bits[i] = parseInt(number.charAt(number.length - 1 - i));
  }
  while (length != null && bits.length < length) {
    bits.push(0);
  }
  return bits;
};

/**
 * Transforms the given array of bits to a number.
 * @memberof jiff-instance.helpers
 * @instance
 * @param {bits} number[] - the array of bits to compose as a number, starting from least to most significant bits.
 * @param {length} [length = bits.length] - if provided, only the first 'length' bits will be used
 * @return {number} the array of bits.
 */
jiff.helpers.bits_to_number = function (bits, length) {
  if (length == null || length > bits.length) {
    length = bits.length;
  }
  return parseInt(bits.slice(0, length).reverse().join(''), 2);
};