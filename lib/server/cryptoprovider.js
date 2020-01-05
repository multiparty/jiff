// Possible fallback for when pre-processing elements are depleted, actual fallback is configurable by clients.

// constructor
function CryptoProviderHandlers(jiffServer) {
  // fill in hooks from options
  var optionHandlers = jiffServer.options.crypto_handlers || {};
  for (var handler in optionHandlers) {
    if (optionHandlers.hasOwnProperty(handler)) {
      this[handler] = optionHandlers[handler];
    }
  }
}

// Default Crypto Handlers
CryptoProviderHandlers.prototype.triplet = function (jiff, computation_id, receivers_list, threshold, Zp, params) {
  var a = jiff.helpers.random(Zp);
  var b = jiff.helpers.random(Zp);
  var c = (a * b) % Zp;
  return {secrets: [a, b, c]};
};

CryptoProviderHandlers.prototype.quotient = function (jiff, computation_id, receivers_list, threshold, Zp, params) {
  var constant = params['constant'];
  var noise = jiff.helpers.random(Zp);
  var quotient = Math.floor(noise / constant);
  return {secrets: [noise, quotient]};
};

CryptoProviderHandlers.prototype.numbers = function (jiff, computation_id, receivers_list, threshold, Zp, params) {
  var count = params['count'];
  var bit = params['bit'];
  var min = params['min'];
  var max = params['max'];
  var number = params['number'];
  var bitLength = params['bitLength'];

  if (min == null) {
    min = 0;
  }
  if (max == null) {
    max = Zp;
  }
  if (bit === true) {
    max = 2;
  }

  var numbers = [];
  for (var c = 0; c < count; c++) {
    var n = number;
    if (number == null) {
      n = jiff.helpers.random(max - min) + min;
    }

    if (bitLength == null) {
      numbers.push(n);
    } else {
      numbers = numbers.concat(jiff.helpers.number_to_bits(n, bitLength));
    }
  }

  return {secrets: numbers};
};

module.exports = CryptoProviderHandlers;