global.crypto = require('crypto');
const client_bignumber = require('./jiff-client-bignumber.js');
const BigNumber = require('bignumber.js');

BigNumber.config({ CRYPTO: true });

function secureRandom(max) {
  const precision = max.toString().length;
  const magnitude = new BigNumber(10).pow(precision);
  const multiple = magnitude.div(max).decimalPlaces(0, 3).times(max);

  let rand;
  do {
    rand = BigNumber.random(precision).times(magnitude).decimalPlaces(0, 3);
  } while (rand.gte(multiple));

  return rand.mod(max);
}
function mod(x, y) {
  x = new BigNumber(x);
  y = new BigNumber(y);
  if (x.isNegative()) {
    return x.mod(y).plus(y);
  }
  return x.mod(y);
}

// Create a server instance that can be used to manage all the computations and run server side code.
exports.name = 'bignumber';
exports.make_jiff = function (base_instance, options) {
  const jiff = base_instance;

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
  const base_compute = jiff.compute;
  jiff.compute = function (computation_id, options) {
    const computation_instance = base_compute(computation_id, options);
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
      const a = jiff.helpers.random(Zp);
      const b = jiff.helpers.random(Zp);
      const c = a.times(b).mod(Zp);
      return { secrets: [a, b, c] };
    },
    quotient: function (jiff, computation_id, receivers_list, threshold, Zp, params) {
      const constant = jiff.helpers.BigNumber(params['constant']);
      const noise = jiff.helpers.random(Zp);
      const quotient = noise.div(constant).decimalPlaces(0, 3);
      return { secrets: [noise, quotient] };
    },
    numbers: function (jiff, computation_id, receivers_list, threshold, Zp, params) {
      const count = params['count'];
      const bit = params['bit'];
      let min = params['min'];
      let max = params['max'];
      let number = params['number'];
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

      min = jiff.helpers.BigNumber(min);
      max = jiff.helpers.BigNumber(max);
      if (number != null) {
        number = jiff.helpers.BigNumber(number);
      }

      let numbers = [];
      for (let c = 0; c < count; c++) {
        let n = number;
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
