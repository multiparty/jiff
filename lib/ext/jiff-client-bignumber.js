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
 *     6) If you need to override any feature in jiff (change how share work, or how open work, or how beaver_triplets
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

  if (node) {
    // has to be global to make sure BigNumber library sees it.
    global.crypto = require('crypto');
    // eslint-disable-next-line no-undef
    BigNumber = require('bignumber.js');
    // eslint-disable-next-line no-undef
    sodium = require('libsodium-wrappers');
  } else {
    window.crypto = window.crypto || window.msCrypto;
  }

  // eslint-disable-next-line no-undef
  BigNumber.config({RANGE: 100000000, EXPONENTIAL_AT: 100000000, CRYPTO: true});

  /* Decrypt and sign parsing numbers as BigNumbers */
  function decrypt_and_sign(cipher_text, decryption_secret_key, signing_public_key, operation_type) {
    var nonce = new Uint8Array(JSON.parse(cipher_text.nonce));
    cipher_text = new Uint8Array(JSON.parse(cipher_text.cipher));

    try {
      // eslint-disable-next-line no-undef
      var decryption = sodium.crypto_box_open_easy(cipher_text, nonce, signing_public_key, decryption_secret_key, 'text');
      if (operation_type === 'share' || operation_type === 'open') {
        // eslint-disable-next-line no-undef
        return new BigNumber(decryption, 10);
      }
      return decryption;
    } catch (_) {
      throw new Error('Bad signature or Bad nonce: Cipher: ' + cipher_text + '.  DecSKey: ' + decryption_secret_key + '.  SignPKey: ' + signing_public_key);
    }
  }

  /* Equivalent Shamir Sharing for BigNumbers */
  function jiff_compute_shares(jiff, secret, parties_list, threshold, Zp) {
    var shares = {}; // Keeps the shares
    var i;

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

    // Compute the Langrange coefficients at 0.
    for (i = 0; i < shares.length; i++) {
      shares[i].Zp = jiff.helpers.BigNumber(shares[i].Zp);
      shares[i].value = jiff.helpers.BigNumber(shares[i].value);

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
  function createSecretShare(jiff, share, share_helpers) {
    var self = share;

    var oldIsConstant = self.isConstant;
    self.isConstant = function (o) {
      return oldIsConstant(o) || o.isBigNumber === true;
    };

    // Avoid having to rewrite all the primitives: just override the helpers with bignumber equivalent!
    share_helpers['+'] = function (v1, v2) {
      return v1.plus(v2);
    };
    share_helpers['-'] = function (v1, v2) {
      return v1.minus(v2);
    };
    share_helpers['*'] = function (v1, v2) {
      return v1.times(v2);
    };
    share_helpers['/'] = function (v1, v2) {
      return v1.div(v2);
    };
    share_helpers['<'] = function (v1, v2) {
      return jiff.helpers.BigNumber(v1).lt(v2);
    };
    share_helpers['<='] = function (v1, v2) {
      return jiff.helpers.BigNumber(v1).lte(v2);
    };
    share_helpers['=='] = function (v1, v2) {
      return jiff.helpers.BigNumber(v1).eq(v2);
    }
    share_helpers['floor/'] = function (v1, v2) {
      return v1.div(v2).floor();
    };
    share_helpers['pow'] = function (v1, v2) {
      return self.jiff.helpers.BigNumber(v1).pow(v2);
    };
    share_helpers['binary'] = function (v) {
      return v.toString() === '1' || v.toString() === '0';
    };
    share_helpers['floor'] = function (v) {
      if (typeof(v) === 'number') {
        return Math.floor(v);
      }
      return v.floor();
    };
    share_helpers['ceil'] = function (v) {
      if (typeof(v) === 'number') {
        return Math.ceil(v);
      }
      return v.ceil();
    };
    share_helpers['abs'] = function (v) {
      return v.abs();
    };

    return self;
  }

  // Take the jiff-client base instance and options for this extension, and use them
  // to construct an instance for this extension.
  function make_jiff(base_instance, options) {
    var jiff = base_instance;

    // Parse options
    if (options == null) {
      options = {};
    }
    if (options.Zp != null) {
      jiff.Zp = options.Zp;
    }

    if (jiff.has_extension('negativenumber')) {
      throw new Error('Please apply bignumber before negative number extensions');
    }
    if (jiff.has_extension('fixedpoint')) {
      throw new Error('Please apply bignumber before negative number extensions');
    }

    // Turn thing into their BigNumber equivalent

    /* HELPERS */
    // eslint-disable-next-line no-undef
    jiff.helpers._BigNumber = BigNumber;
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
      var test = jiff.helpers.BigNumber(base).pow(blog);
      if (test.eq(value)) {
        return blog;
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
      var magnitude = new BigNumber(10).pow(precision);
      var multiple = magnitude.div(max).floor().times(max);

      var rand;
      do {
        // eslint-disable-next-line no-undef
        rand = BigNumber.random(precision).times(magnitude).floor();
      } while (rand.gte(multiple));

      return rand.mod(max);
    };

    // eslint-disable-next-line no-undef
    jiff.Zp = jiff.helpers.BigNumber(jiff.Zp);

    /* SUB-PROTOCOLS */
    jiff.protocols.bit_composition = function (bits) {
      var result = bits[0];
      var pow = jiff.helpers.BigNumber(1);
      for (var i = 1; i < bits.length; i++) {
        pow = pow.times(2);
        result = result.isadd(bits[i].icmult(pow));
      }
      return result;
    };

    /* SHARE CHECKS */
    jiff.share = function (secret, threshold, receivers_list, senders_list, Zp, share_id) {
      secret = secret != null ? jiff.helpers.BigNumber(secret) : secret;
      if (secret != null && (!secret.floor().eq(secret) || secret.lt(0))) {
        throw new Error('secret must be a non-negative whole number');
      }
      if (secret != null && (secret.gte(Zp == null ? jiff.Zp : Zp))) {
        throw new Error('secret must fit inside Zp');
      }
      return jiff.internal_share(secret, threshold, receivers_list, senders_list, Zp, share_id);
    };

    /* HOOKS */
    jiff.hooks.decryptSign = decrypt_and_sign;

    jiff.hooks.computeShares = jiff_compute_shares;
    jiff.hooks.reconstructShare = jiff_lagrange;

    jiff.hooks.createSecretShare.push(createSecretShare);
    jiff.hooks.receiveTriplet.push(function (jiff, triplet) {
      return {
        a: jiff.helpers.BigNumber(triplet['a']),
        b: jiff.helpers.BigNumber(triplet['b']),
        c: jiff.helpers.BigNumber(triplet['c'])
      };
    });
    jiff.hooks.receiveNumbers.push(function (jiff, numbers) {
      for (var i = 0; i < numbers.length; i++) {
        numbers[i]['number'] = jiff.helpers.BigNumber(numbers[i]['number']);
      }
      return numbers;
    });

    return jiff;
  }

  // Expose the API for this extension.
  exports.make_jiff = make_jiff;
  exports.utils = {decrypt_and_sign: decrypt_and_sign};
  exports.sharing_schemes = {shamir_share: jiff_compute_shares, shamir_reconstruct: jiff_lagrange};
}((typeof exports === 'undefined' ? this.jiff_bignumber = {} : exports), typeof exports !== 'undefined'));
