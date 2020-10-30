/**
 * This defines a library extension for for bignumbers in JIFF.
 * This wraps and exposes the jiff-client-bignumber API. Exposed members can be accessed with jiff_bignumber.&lt;member-name&gt;
 * in browser JS, or by using require('<path>/lib/ext/jiff-client-bignumber').&lt;member-name&gt; as usual in nodejs.
 * @namespace jiff_bignumber
 * @version 1.0
 *
 * FEATURES: supports all of the regular JIFF API.
 *
 * EXTENSION DESIGN INSTRUCTIONS AND EXPLANATION:
 *     1) write a top-level function like the one here: [i.e. (function(exports, node) { .... })(typeof(exports) ....)]
 *        this function acts as the scope for the extension, which forbids name conflicts as well as forbid others from
 *        modifying or messing around with the functions and constants inside. Additionally, it makes the code useable
 *        from the browsers and nodejs.
 *
 *     2) In the very last line replace this.jiff_bignumber = {} with this.jiff_<extension_name> = {}. This is the defacto
 *        name space for this extension. Calling code on the user-side will use that name (jiff_<extension_name>) to access the
 *        functions you choose to expose. For nodejs the name space will be ignored and calling code can use the object
 *        returned by the require() call corresponding to this extension.
 *
 *     3) Inside the top-level function, create a function called make_jiff. The function should take two parameters:
 *            (a) base_instance, (b) options.
 *        base_instance: the base instance to wrap the extension around, it can be a basic jiff-client.js instance or
 *            an instance of another extension, you can use this instance to perform the basic operation that build
 *            your extensions (sharing of integers, simple operations on ints, etc)
 *        options: should be an object that provides your extension with whatever options it requires. The options for
 *            the base_instance will be passed to it prior to calling your extensions and may not be inside the options
 *            object, but you can access them using base_instance.
 *
 *     4) If your extension requires other extensions be applied to the base instance, you can force this by performing a
 *        a check, by calling <base_instance>.has_extension(<extension_name>).
 *
 *     5) Adding functionality: You have two options:
 *            (A) use hooks to modify the functionality of the base instance "in place"
 *                and then return the base instance.
 *            (B) Create a new object that contains the base_instance (perhaps as an attribute named "base"), you will
 *                need to recreate the JIFF API at the new object level. The implementation of this API can use functionality
 *                from base_instance. Return the new object.
 *
 *     6) If you need to override any feature in jiff (change how share work, or how open work, or how some primitive
 *        work etc), look at the hooks documentation to see if it is available as a hook. If it is, your best bet would
 *        be to use hooks on top of the base_instance. Another approach could be to override functions inside the base_instance
 *        or to create a new object with brand new functions (that may or may not refer to base_instance). These approaches
 *        can be mixed.
 *
 *     7) If you want to add additional feature that does not override any other feature in jiff, implement that in a
 *        function under a new appropriate name, make sure to document the function properly.
 *
 *     8) at the end of the top-level function and after make_jiff is done, make sure to have an
 *        if(node) { ... } else { ... } block, in which you expose the make_jiff function.
 *
 *     9) do not forget to export the name of the extension.
 *
 * Keep in mind that others may base extensions on your extension, or that clients may want to combine functionality from two extensions
 * together. If you have specific dependencies or if you know that the extension will be incompatible with other extensions, make sure
 * to enforce it by performing checks and throwing errors, as well as potentially overriding the can_apply_extension function
 * which will be called when future extensions are applied after your extension.
 */
(function (exports, node) {
  /**
   * The name of this extension: 'bignumber'
   * @type {string}
   * @memberOf jiff_bignumber
   */
  exports.name = 'bignumber';

  var BigNumber_;
  if (node) {
    // has to be global to make sure BigNumber library sees it.
    global.crypto = require('crypto');
    BigNumber_ = require('bignumber.js');
  } else {
    window.crypto = window.crypto || window.msCrypto;
    BigNumber_ = window.BigNumber;
  }

  // dependencies = { 'BigNumber': <BigNumber.js> }
  exports.dependencies = function (dependencies) {
    BigNumber_ = dependencies['BigNumber'] != null ? dependencies['BigNumber'] : BigNumber_;
  };

  /**
   * Check that an integer is prime. Used to safely set the modulus Zp.
   * @memberof jiff_bignumber.utils
   * @param {number} p - the prime number candidate.
   * @returns {boolean} true if p is prime, false otherwise.
   */
  function is_prime(p) {
    // AKS Primality Test
    p = new BigNumber_(p);

    if (p.eq(2)) {
      return true;
    } else if (p.eq(3)) {
      return true;
    } else if (p.mod(2).eq(0)) {
      return false;
    } else if (p.mod(3).eq(0)) {
      return false;
    }

    var i = new BigNumber_(5);
    var n = new BigNumber_(2);
    var six6 = new BigNumber_(6);
    while (i.times(i).lte(p)) {
      if (p.mod(i).eq(0)) {
        return false;
      }
      i = i.plus(n);
      n = six6.minus(n);
    }

    return true;
  }

  /* Equivalent Shamir Sharing for BigNumbers */
  function jiff_compute_shares(jiff, secret, parties_list, threshold, Zp) {
    var shares = {}; // Keeps the shares
    var i;

    secret = secret != null ? secret : 0;  // allow asymmetric receiving even self-receiving
    secret = jiff.helpers.BigNumber(secret);
    Zp = jiff.helpers.BigNumber(Zp);

    // Each player's random polynomial f must have
    // degree threshold - 1, so that threshold many points are needed
    // to interpolate/reconstruct.
    var t = threshold - 1;
    var polynomial = Array(t + 1); // stores the coefficients

    // Each players's random polynomial f must be constructed
    // such that f(0) = secret
    polynomial[0] = secret;

    // Compute the random polynomial f's coefficients
    for (i = 1; i <= t; i++) {
      polynomial[i] = jiff.helpers.random(Zp);
    }

    // Compute each players share such that share[i] = f(i)
    for (i = 0; i < parties_list.length; i++) {
      var p_id = parties_list[i];
      shares[p_id] = polynomial[0];
      var power = jiff.helpers.BigNumber(jiff.helpers.get_party_number(p_id));

      for (var j = 1; j < polynomial.length; j++) {
        var tmp = jiff.helpers.mod(polynomial[j].times(power), Zp);
        shares[p_id] = jiff.helpers.mod(shares[p_id].plus(tmp), Zp);
        power = jiff.helpers.mod(power.times(jiff.helpers.get_party_number(p_id)), Zp);
      }
    }

    return shares;
  }

  /* Equivalent lagrange interpolation for BigNumbers */
  function jiff_lagrange(jiff, shares) {
    var lagrange_coeff = []; // will contain shares.length many elements.
    var i, pi;

    // Compute the Lagrange coefficients at 0.
    for (i = 0; i < shares.length; i++) {
      shares[i].Zp = jiff.helpers.BigNumber(shares[i].Zp);

      pi = jiff.helpers.get_party_number(shares[i].sender_id);
      lagrange_coeff[pi] = jiff.helpers.BigNumber(1);

      for (var j = 0; j < shares.length; j++) {
        var pj = jiff.helpers.get_party_number(shares[j].sender_id);
        if (pj !== pi) {
          var inv = jiff.helpers.extended_gcd(pi - pj, shares[i].Zp)[0];
          lagrange_coeff[pi] = jiff.helpers.mod(lagrange_coeff[pi].times(0 - pj), shares[i].Zp).times(inv);
          lagrange_coeff[pi] = jiff.helpers.mod(lagrange_coeff[pi], shares[i].Zp);
        }
      }
    }

    // Reconstruct the secret via Lagrange interpolation
    var recons_secret = jiff.helpers.BigNumber(0);
    for (i = 0; i < shares.length; i++) {
      pi = jiff.helpers.get_party_number(shares[i].sender_id);
      var tmp = jiff.helpers.mod(shares[i].value.times(lagrange_coeff[pi]), shares[i].Zp);
      recons_secret = jiff.helpers.mod(recons_secret.plus(tmp), shares[i].Zp);
    }

    return recons_secret;
  }

  // modify secret share implementations to use BigNumber
  function createSecretShare(jiff, share) {
    var self = share;

    var oldIsConstant = self.isConstant;
    self.isConstant = function (o) {
      return oldIsConstant(o) || o.isBigNumber === true;
    };

    return self;
  }

  function customizeShareHelpers(jiff) {
    jiff.share_helpers['+'] = function (v1, v2) {
      return v1.plus(v2);
    };
    jiff.share_helpers['-'] = function (v1, v2) {
      return v1.minus(v2);
    };
    jiff.share_helpers['*'] = function (v1, v2) {
      return v1.times(v2);
    };
    jiff.share_helpers['/'] = function (v1, v2) {
      return v1.div(v2);
    };
    jiff.share_helpers['<'] = function (v1, v2) {
      return jiff.helpers.BigNumber(v1).lt(v2);
    };
    jiff.share_helpers['<='] = function (v1, v2) {
      return jiff.helpers.BigNumber(v1).lte(v2);
    };
    jiff.share_helpers['=='] = function (v1, v2) {
      return jiff.helpers.BigNumber(v1).eq(v2);
    };
    jiff.share_helpers['floor/'] = function (v1, v2) {
      return v1.div(v2).floor();
    };
    jiff.share_helpers['pow'] = function (v1, v2) {
      return self.jiff.helpers.BigNumber(v1).pow(v2);
    };
    jiff.share_helpers['binary'] = function (v) {
      return v.toString() === '1' || v.toString() === '0';
    };
    jiff.share_helpers['floor'] = function (v) {
      if (typeof(v) === 'number') {
        return Math.floor(v);
      }
      return v.floor();
    };
    jiff.share_helpers['ceil'] = function (v) {
      if (typeof(v) === 'number') {
        return Math.ceil(v);
      }
      return v.ceil();
    };
    jiff.share_helpers['abs'] = function (v) {
      return v.abs();
    };
    jiff.share_helpers['even'] = function (v) {
      return v.mod(2).eq(0);
    };
  }

  // Take the jiff-client base instance and options for this extension, and use them
  // to construct an instance for this extension.
  function make_jiff(base_instance, options) {
    var jiff = base_instance;

    customizeShareHelpers(jiff);

    // Parse options
    if (options == null) {
      options = {};
    }
    if (options.Zp != null) {
      jiff.Zp = options.Zp;
      if (options.safemod !== false && !is_prime(options.Zp)) {
        throw new Error('Zp = ' + options.Zp.toString() + ' is not prime.  Please use a prime number for the modulus or set safemod to false.');
      }
    }

    if (jiff.has_extension('negativenumber')) {
      throw new Error('Please apply bignumber before negative number extensions');
    }
    if (jiff.has_extension('fixedpoint')) {
      throw new Error('Please apply bignumber before negative number extensions');
    }

    // Turn things into their BigNumber equivalent

    /* HELPERS */
    jiff.helpers._BigNumber = BigNumber_;
    jiff.helpers._BigNumber.config({CRYPTO: true});
    jiff.helpers.BigNumber = function (n) {
      // eslint-disable-next-line no-undef
      return new jiff.helpers._BigNumber(n);
    };

    jiff.helpers.mod = function (x, y) {
      x = jiff.helpers.BigNumber(x);
      y = jiff.helpers.BigNumber(y);
      if (x.isNeg()) {
        return x.mod(y).plus(y);
      }
      return x.mod(y);
    };

    jiff.helpers.pow_mod = function (a, b, n) {
      a = jiff.helpers.BigNumber(a);
      return a.pow(b, n);
    };

    jiff.helpers.extended_gcd = function (a, b) {
      a = jiff.helpers.BigNumber(a);
      b = jiff.helpers.BigNumber(b);
      return (
        function recursive_helper(a, b) {
          if (b.isZero()) {
            return [jiff.helpers.BigNumber(1), jiff.helpers.BigNumber(0), a];
          }

          var temp = recursive_helper(b, jiff.helpers.mod(a, b));
          var x = temp[0];
          var y = temp[1];
          var d = temp[2];
          return [y, x.minus(y.times(a.div(b).floor())), d];
        }
      )(a, b);
    };

    jiff.helpers.bLog = function (value, base) {
      // Not really log, but good enough since all we need is either floor or ceil of log.
      if (base == null) {
        base = 2;
      }
      var blog = value.toString(base).length;
      var test = jiff.helpers.BigNumber(base).pow(blog - 1);
      if (test.eq(value)) {
        return blog - 1;
      }
      return blog - 0.5;
    };

    jiff.helpers.Zp_equals = function (s1, s2) {
      return s1.Zp.eq(s2.Zp);
    };

    jiff.helpers.random = function (max) {
      if (max == null) {
        max = jiff.Zp;
      }

      var precision = max.toString().length;
      // eslint-disable-next-line no-undef
      var magnitude = jiff.helpers.BigNumber(10).pow(precision);
      var multiple = magnitude.div(max).floor().times(max);

      var rand;
      do {
        // eslint-disable-next-line no-undef
        rand = jiff.helpers._BigNumber.random(precision).times(magnitude).floor();
      } while (rand.gte(multiple));

      return rand.mod(max);
    };

    // eslint-disable-next-line no-undef
    jiff.Zp = jiff.helpers.BigNumber(jiff.Zp);

    /* SUB-PROTOCOLS */
    jiff.protocols.bits.bit_composition = function (bits) {
      var result = bits[0];
      var pow = jiff.helpers.BigNumber(1);
      for (var i = 1; i < bits.length; i++) {
        pow = pow.times(2);
        result = result.isadd(bits[i].icmult(pow));
      }
      return result;
    };

    jiff.protocols.bits.cgt = function (bits, constant, op_id) {
      if (!(bits[0].isConstant(constant))) {
        throw new Error('parameter should be a number (bits.cgt)');
      }
      if (op_id == null) {
        op_id = jiff.counters.gen_op_id('bits.cgt', bits[0].holders);
      }
      constant = jiff.helpers.BigNumber(constant);
      return jiff.protocols.bits.cgteq(bits, constant.plus(1), op_id);
    };

    /* SHARE CHECKS */
    jiff.share = function (secret, threshold, receivers_list, senders_list, Zp, share_id) {
      secret = secret != null ? jiff.helpers.BigNumber(secret) : secret;
      if (secret != null && (!secret.floor().eq(secret) || secret.lt(0))) {
        throw new Error('secret \'' + secret + '\' must be a non-negative whole number');
      }
      if (secret != null && (secret.gte(Zp == null ? jiff.Zp : Zp))) {
        throw new Error('secret \'' + secret + '\' must fit inside Zp');
      }
      return jiff.internal_share(secret, threshold, receivers_list, senders_list, Zp, share_id);
    };

    /* PREPROCESSING IS THE SAME */
    jiff.preprocessing_function_map[exports.name] = {};

    /* HOOKS */
    jiff.hooks.computeShares = jiff_compute_shares;
    jiff.hooks.reconstructShare = jiff_lagrange;

    jiff.hooks.createSecretShare.push(createSecretShare);
    // parse content of share/open messages to be bigNumbers (instead of strings due to encryption/decryption)
    jiff.hooks.afterOperation[0] = function (jiff, label, msg) {
      if (label === 'share' || label === 'open') {
        msg['share'] = jiff.helpers.BigNumber(msg['share']);
      } else if (label === 'crypto_provider' && msg['shares'] != null) {
        msg['Zp'] = jiff.helpers.BigNumber(msg['Zp']);
        for (var i = 0; i < msg['shares'].length; i++) {
          msg['shares'][i] = jiff.helpers.BigNumber(msg['shares'][i]);
        }
      }
      return msg;
    };

    return jiff;
  }

  // Expose the API for this extension.
  exports.make_jiff = make_jiff;
  exports.sharing_schemes = {shamir_share: jiff_compute_shares, shamir_reconstruct: jiff_lagrange};
  exports.utils = {is_prime: is_prime};
}((typeof exports === 'undefined' ? this.jiff_bignumber = {} : exports), typeof exports !== 'undefined'));
