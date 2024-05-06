interface ExtendedCrypto extends Crypto {
  __randomBytesWrapper: (bytesNeeded: number) => Uint8Array;
}

let crypto_: ExtendedCrypto;

if (typeof window !== 'undefined') {
  // Browser environment
  const webCrypto = window.crypto || (window as any).msCrypto;
  crypto_ = {
    ...webCrypto,
    __randomBytesWrapper: (bytesNeeded: number) => {
      const randomBytes = new Uint8Array(bytesNeeded);
      webCrypto.getRandomValues(randomBytes);
      return randomBytes;
    }
  } as ExtendedCrypto;
} else {
  // Node environment
  const nodeCrypto = require('crypto');
  crypto_ = {
    ...nodeCrypto,
    __randomBytesWrapper: (bytesNeeded: number) => new Uint8Array(nodeCrypto.randomBytes(bytesNeeded))
  };
}

// Secure randomness via rejection sampling.
exports.random = function (max: number): number {
  // Use rejection sampling to get random value within bounds
  // Generate random Uint8 values of 1 byte larger than the max parameter
  // Reject if random is larger than quotient * max (remainder would cause biased distribution), then try again

  // Values up to 2^53 should be supported, but log2(2^49) === log2(2^49+1), so we lack the precision to easily
  // determine how many bytes are required
  if (max > 562949953421312) {
    throw new RangeError('Max value should be smaller than or equal to 2^49');
  }

  const bitsNeeded = Math.ceil(Math.log(max) / Math.log(2));
  const bytesNeeded = Math.ceil(bitsNeeded / 8);
  const maxValue = Math.pow(256, bytesNeeded);

  // Keep trying until we find a random value within bounds
  while (true) {
    let randomBytes;
    randomBytes = crypto_.__randomBytesWrapper(bytesNeeded);
    let randomValue = 0;

    for (let i = 0; i < bytesNeeded; i++) {
      randomValue = randomValue * 256 + randomBytes[i];
    }

    // randomValue should be smaller than largest multiple of max within maxBytes
    if (randomValue < maxValue - (maxValue % max)) {
      return randomValue % max;
    }
  }
};

// actual mode
exports.mod = function (x: number, y: number): number {
  if (x < 0) {
    return (x % y) + y;
  }
  return x % y;
};

// get the party number from the given party_id, the number is used to compute/open shares
exports.get_party_number = function (party_id: number | string): number {
  if (typeof party_id === 'number') {
    return party_id;
  }
  if (typeof party_id === 'string' && party_id.startsWith('s')) {
    return -1 * parseInt(party_id.substring(1), 10);
  }
  return parseInt(party_id, 10);
};

// transform number to bit array
exports.number_to_bits = function (number: number, length: number): number[] {
  let bits: number[] = [];
  const binaryString = number.toString(2);

  for (let i = 0; i < binaryString.length; i++) {
    bits[i] = parseInt(binaryString.charAt(binaryString.length - 1 - i), 10);
  }
  while (length != undefined && bits.length < length) {
    bits.push(0);
  }
  return bits;
};
