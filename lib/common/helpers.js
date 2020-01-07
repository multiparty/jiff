var crypto_;
if (typeof(window) === 'undefined') {
  crypto_ = require('crypto');
  crypto_.__randomBytesWrapper = crypto_.randomBytes;
} else {
  crypto_ = window.crypto || window.msCrypto;
  crypto_.__randomBytesWrapper = function (bytesNeeded) {
    var randomBytes = new Uint8Array(bytesNeeded);
    crypto_.getRandomValues(randomBytes);
    return randomBytes;
  };
}

// Secure randomness via rejection sampling.
exports.random = function (max) {
  // Use rejection sampling to get random value within bounds
  // Generate random Uint8 values of 1 byte larger than the max parameter
  // Reject if random is larger than quotient * max (remainder would cause biased distribution), then try again

  // Values up to 2^53 should be supported, but log2(2^49) === log2(2^49+1), so we lack the precision to easily
  // determine how many bytes are required
  if (max > 562949953421312) {
    throw new RangeError('Max value should be smaller than or equal to 2^49');
  }

  var bitsNeeded = Math.ceil(Math.log(max)/Math.log(2));
  var bytesNeeded = Math.ceil(bitsNeeded / 8);
  var maxValue = Math.pow(256, bytesNeeded);

  // Keep trying until we find a random value within bounds
  while (true) { // eslint-disable-line
    var randomBytes = crypto_.__randomBytesWrapper(bytesNeeded);
    var randomValue = 0;

    for (var i = 0; i < bytesNeeded; i++) {
      randomValue = randomValue * 256 + (randomBytes.readUInt8 ? randomBytes.readUInt8(i) : randomBytes[i]);
    }

    // randomValue should be smaller than largest multiple of max within maxBytes
    if (randomValue < maxValue - maxValue % max) {
      return randomValue % max;
    }
  }
};

// actual mode
exports.mod = function (x, y) {
  if (x < 0) {
    return (x % y) + y;
  }
  return x % y;
};

// get the party number from the given party_id, the number is used to compute/open shares
exports.get_party_number = function (party_id) {
  if (typeof(party_id) === 'number') {
    return party_id;
  }
  if (party_id.startsWith('s')) {
    return -1 * parseInt(party_id.substring(1), 10);
  }
  return parseInt(party_id, 10);
};

// transform number to bit array
exports.number_to_bits = function (number, length) {
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