global.crypto = require('crypto');
var client_bignumber = require('./jiff-client-bignumber');
var BigNumber = require('bignumber.js');

BigNumber.config({ RANGE: 100000000, EXPONENTIAL_AT: 100000000, CRYPTO: true });

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

  // Make sure computation instances are extended properly.
  var base_compute = jiff.compute;
  jiff.compute = function (computation_id, options) {
    var computation_instance = base_compute(computation_id, options);
    computation_instance.apply_extension(client_bignumber, options);
    return computation_instance;
  };

  default_preprocessing(jiff);
  return jiff;
};

function initialize_hooks(jiff, options) {
  if (options.hooks == null) {
    options.hooks = {};
  }

  // crypto hooks
  if (options.hooks.decryptSign == null) {
    if (options.sodium !== false) {
      jiff.hooks.decryptSign = client_bignumber.utils.decrypt_and_sign;
    } else {
      jiff.hooks.decryptSign = function decrypt_and_sign(jiff, cipher_text, decryption_secret_key, signing_public_key, operation_type) {
        if (operation_type === 'share' || operation_type === 'open') {
          return new BigNumber(cipher_text);
        }
        return cipher_text;
      }
    }
  } else {
    jiff.hooks.decryptSign = options.hooks.decryptSign;
  }

  // sharing hooks
  if (options.hooks.computeShares == null) {
    jiff.hooks.computeShares = client_bignumber.sharing_schemes.shamir_share;
  } else {
    jiff.hooks.computeShares = options.hooks.computeShares;
  }

  // other default hooks
  function generateTriplet(jiff, computation_id, Zp) {
    var a = jiff.helpers.random(Zp);
    var b = jiff.helpers.random(Zp);
    var c = a.times(b).mod(Zp);
    return { a: a, b: b, c: c };
  }

  function generateNumber(jiff, computation_id, params) {
    var bit = params.bit;
    var nonzero = params.nonzero;
    var max = params.max;
    if (max == null) {
      max = params.Zp;
    }
    max = new BigNumber(max);

    var number = jiff.helpers.random(max);
    if (params.number != null) {
      number = new BigNumber(params.number);
    } else if (bit === true && nonzero === true) {
      number = new BigNumber(1);
    } else if (bit === true) {
      number = number.mod(2);
    } else if (nonzero === true && number === 0) {
      number = jiff.helpers.random(max.minus(1)).plus(1);
    }

    return number;
  }

  if (options.hooks.generateTriplet == null) {
    jiff.hooks.generateTriplet = generateTriplet;
  } else {
    jiff.hooks.generateTriplet = options.hooks.generateTriplet;
  }
  if (options.hooks.generateNumber == null) {
    jiff.hooks.generateNumber = generateNumber;
  } else {
    jiff.hooks.generateNumber = options.hooks.generateNumber;
  }
}


// possible fallback for when pre-processing elements are depleted, actual fallback
// is configurable by clients.
function default_preprocessing(jiff) {
  // For use inside share
  jiff.create_jiff_imitation = function (party_count) {
    return {
      helpers: {
        random: jiff.helpers.random,
        mod: jiff.helpers.mod,
        get_party_number: function (party_id) {
          return jiff.helpers.get_party_number(party_id, party_count);
        },
        BigNumber: function (n) {
          return new BigNumber(n);
        }
      }
    };
  };
}