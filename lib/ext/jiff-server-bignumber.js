global.crypto = require('crypto');
var client_bignumber = require('./jiff-client-bignumber.js');
var BigNumber = require('bignumber.js');

BigNumber.config({CRYPTO: true});

function secureRandom(max) {
  var precision = max.toString().length;
  var magnitude = new BigNumber(10).pow(precision);
  var multiple = magnitude.div(max).floor().times(max);

  var rand;
  do {
    rand = BigNumber.random(precision).times(magnitude).floor();
  } while (rand.gte(multiple));

  return rand.mod(max);
}
function mod(x, y) {
  x = new BigNumber(x);
  y = new BigNumber(y);
  if (x.isNeg()) {
    return x.mod(y).plus(y);
  }
  return x.mod(y);
}

// Create a server instance that can be used to manage all the computations and run server side code.
exports.name = 'bignumber';
exports.make_jiff = function (base_instance, options) {
  var jiff = base_instance;

  initialize_hooks(jiff, options);

  // helpers
  jiff.helpers.random = secureRandom;
  jiff.helpers.mod = mod;
  jiff.helpers.BigNumber = function (n) {
    return new BigNumber(n);
  };

  // Override crypto provider functionality
  jiff.cryptoProviderHandlers = Object.assign({}, default_preprocessing(), options.crypto_handlers);

  // Make sure computation instances are extended properly.
  var base_compute = jiff.compute;
  jiff.compute = function (computation_id, options) {
    var computation_instance = base_compute(computation_id, options);
    computation_instance.apply_extension(client_bignumber, options);
    return computation_instance;
  };

  return jiff;
};

function initialize_hooks(jiff, options) {
  if (options.hooks == null) {
    options.hooks = {};
  }

  // sharing hooks
  if (options.hooks.computeShares == null) {
    jiff.hooks.computeShares = client_bignumber.sharing_schemes.shamir_share;
  } else {
    jiff.hooks.computeShares = options.hooks.computeShares;
  }
}

function default_preprocessing() {
  return {
    // other default hooks
    triplet: function (jiff, computation_id, receivers_list, threshold, Zp, params) {
      var a = jiff.helpers.random(Zp);
      var b = jiff.helpers.random(Zp);
      var c = a.times(b).mod(Zp);
      return { secrets: [a, b, c] };
    },
    quotient: function (jiff, computation_id, receivers_list, threshold, Zp, params) {
      var constant = jiff.helpers.BigNumber(params['constant']);
      var noise = jiff.helpers.random(Zp);
      var quotient = noise.div(constant).floor();
      return { secrets: [noise, quotient] };
    },
    numbers: function (jiff, computation_id, receivers_list, threshold, Zp, params) {
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

      min = jiff.helpers.BigNumber(min);
      max = jiff.helpers.BigNumber(max);
      if (number != null) {
        number = jiff.helpers.BigNumber(number);
      }

      var numbers = [];
      for (var c = 0; c < count; c++) {
        var n = number;
        if (number == null) {
          n = jiff.helpers.random(max.minus(min)).plus(min);
        }

        if (bitLength == null) {
          numbers.push(n);
        } else {
          numbers = numbers.concat(jiff.helpers.number_to_bits(n, bitLength));
        }
      }

      return { secrets: numbers };
    }
  };
}