// Possible fallback for when pre-processing elements are depleted, actual fallback is configurable by clients.

// constructor
function CryptoProviderHandlers(jiffServer) {
  // fill in hooks from options
  const optionHandlers = jiffServer.options.crypto_handlers || {};
  for (var handler in optionHandlers) {
    if (optionHandlers.hasOwnProperty(handler)) {
      this[handler] = optionHandlers[handler];
    }
  }
}

// Default Crypto Handlers
CryptoProviderHandlers.prototype.triplet = function (jiff, computation_id, receivers_list, threshold, Zp, params) {
  const a = jiff.helpers.random(Zp);
  const b = jiff.helpers.random(Zp);
  const c = (a * b) % Zp;
  return { secrets: [a, b, c] };
};

CryptoProviderHandlers.prototype.quotient = function (jiff, computation_id, receivers_list, threshold, Zp, params) {
  const constant = params['constant'];
  const noise = jiff.helpers.random(Zp);
  const quotient = Math.floor(noise / constant);
  return { secrets: [noise, quotient] };
};

CryptoProviderHandlers.prototype.numbers = function (jiff, computation_id, receivers_list, threshold, Zp, params) {
  const count = params['count'];
  const bit = params['bit'];
  let min = params['min'];
  let max = params['max'];
  const number = params['number'];
  const bitLength = params['bitLength'];

  if (min == null) {
    min = 0;
  }
  if (max == null) {
    max = Zp;
  }
  if (bit === true) {
    max = 2;
  }

  let numbers = [];
  for (var c = 0; c < count; c++) {
    let n = number;
    if (number == null) {
      n = jiff.helpers.random(max - min) + min;
    }

    if (bitLength == null) {
      numbers.push(n);
    } else {
      numbers = numbers.concat(jiff.helpers.number_to_bits(n, bitLength));
    }
  }

  return { secrets: numbers };
};

module.exports = CryptoProviderHandlers;
