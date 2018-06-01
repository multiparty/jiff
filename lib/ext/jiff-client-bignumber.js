/**
 * This defines a library module for for bignumbers in JIFF.
 * This wraps and exposes the jiff-client-bignumber API. Exposed members can be accessed with jiff_bignumber.&lt;member-name&gt;
 * in browser JS, or by using require('./modules/jiff-client-bignumber').&lt;member-name&gt; as usual in nodejs.
 * @namespace jiff_bignumber
 * @version 1.0
 *
 * FEATURES: supports all of the regular JIFF API.
 *
 * MODULE DESIGN INSTRUCTIONS AND EXPLANATION:
 *     1) write a top-level function like the one here: [i.e. (function(exports, node) { .... })(typeof(exports) ....)]
 *        this function acts as the scope for the module, which forbids name conflicts as well as forbid others from
 *        modifying or messing around with the functions and constants inside. Additionally, it makes the code useable
 *        from the browsers and nodejs.
 *
 *     2) In the very last line replace this.jiff_bignumber = {} with this.jiff_<module_name> = {}. This is the defacto
 *        name space for this module. Calling code on the user-side will use that name (jiff_<module_name>) to access the
 *        functions you choose to expose. For nodejs the name space will be ignored and calling code can use the object
 *        returned by the require() call corresponding to this module.
 *
 *     3) Inside the top-level function, create a function called make_jiff. The function should take two parameters:
 *            (a) base_instance, (b) options.
 *        base_instance: the base instance to wrap the extension around, it can be a basic jiff-client.js instance or
 *            an instance of another extension, you can use this instance to perform the basic operation that build
 *            your modules (sharing of integers, simple operations on ints, etc)
 *        options: should be an object that provides your module with whatever options it requires. The options for
 *            the base_instance will be passed to it prior to calling your modules and may not be inside the options
 *            object, but you can access them using base_instance.
 *
 *     4) If your module requires other extensions be applied to the base instance, you can force this by performing a
 *        a check, by seeing if the required extension name exists in base_instance.modules array. You will need to
 *        add the name of this module to that array as well.
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
 * Keep in mind that others may base extensions on your extension, or that clients may want to combine functionality from two extensions
 * together. If you have specific dependencies or if you know that the extension will be incompatible with other extensions, make sure
 * to check inside the .modules array, and throw the appropriate errors.
 */
(function(exports, node) {
  if(node) {
    // has to be global to make sure BigNumber library sees it.
    global.crypto = require('crypto');
    BigNumber = require('bignumber.js');
  } else {
    window.crypto = window.crypto || window.msCrypto;
  }

  BigNumber.config({ RANGE: 100000000, EXPONENTIAL_AT: 100000000, CRYPTO: true });

  /** Return the maximum of two numbers */
  function max(x, y) {
    return x > y ? x : y;
  }

  /* Decrypt and sign parsing numbers as BigNumbers */
  function decrypt_and_sign(cipher_text, decryption_secret_key, signing_public_key, operation_type) {
    var nonce = new Uint8Array(JSON.parse(cipher_text.nonce));
    cipher_text = new Uint8Array(JSON.parse(cipher_text.cipher));

    try {
      var decryption = sodium.crypto_box_open_easy(cipher_text, nonce, signing_public_key, decryption_secret_key, 'text');
      if(operation_type == 'share' || operation_type == 'open') return new BigNumber(decryption, 10);
      return decryption;
    } catch (_) {
      throw "Bad signature or Bad nonce";
    }
  }

  /* Equivalent Shamir Sharing for BigNumbers */
  function jiff_compute_shares(jiff, secret, parties_list, threshold, Zp) {
    var party_count = jiff.party_count;
    var shares = {}; // Keeps the shares

    secret = new BigNumber(secret);
    Zp = new BigNumber(Zp);

    // Each player's random polynomial f must have
    // degree threshold - 1, so that threshold many points are needed
    // to interpolate/reconstruct.
    var t = threshold - 1;
    var polynomial = Array(t+1); // stores the coefficients

    // Each players's random polynomial f must be constructed
    // such that f(0) = secret
    polynomial[0] = secret;

    // Compute the random polynomial f's coefficients
    for(var i = 1; i <= t; i++) polynomial[i] = jiff.helpers.random(Zp);

    // Compute each players share such that share[i] = f(i)
    for(var i = 0; i < parties_list.length; i++) {
      var p_id = parties_list[i];
      shares[p_id] = polynomial[0];
      var power = new BigNumber(jiff.helpers.get_party_number(p_id));

      for(var j = 1; j < polynomial.length; j++) {
        var tmp = jiff.helpers.mod(polynomial[j].times(power), Zp);
        shares[p_id] = jiff.helpers.mod(shares[p_id].plus(tmp), Zp);
        power = jiff.helpers.mod(power.times(jiff.helpers.get_party_number(p_id)), Zp);
      }
    }

    return shares;
  }

  /* Equivalent lagrange interpolation for BigNumbers */
  function jiff_lagrange(jiff, shares) {
    var party_count = jiff.party_count;
    var lagrange_coeff = []; // will contain shares.length many elements.

    // Compute the Langrange coefficients at 0.
    for(var i = 0; i < shares.length; i++) {
      shares[i].Zp = new BigNumber(shares[i].Zp);
      shares[i].value = new BigNumber(shares[i].value);

      var pi = jiff.helpers.get_party_number(shares[i].sender_id);
      lagrange_coeff[pi] = new BigNumber(1);

      for(var j = 0; j < shares.length; j++) {
        var pj = jiff.helpers.get_party_number(shares[j].sender_id);
        if(pj != pi) {
          var inv = jiff.helpers.extended_gcd(pi - pj, shares[i].Zp)[0];
          lagrange_coeff[pi] = jiff.helpers.mod(lagrange_coeff[pi].times(0 - pj), shares[i].Zp).times(inv);
          lagrange_coeff[pi] = jiff.helpers.mod(lagrange_coeff[pi], shares[i].Zp);
        }
      }
    }

    // Reconstruct the secret via Lagrange interpolation
    var recons_secret = new BigNumber(0);
    for(var i = 0; i < shares.length; i++) {
      var pi = jiff.helpers.get_party_number(shares[i].sender_id);
      var tmp = jiff.helpers.mod(shares[i].value.times(lagrange_coeff[pi]), shares[i].Zp);
      recons_secret = jiff.helpers.mod(recons_secret.plus(tmp), shares[i].Zp);
    }

    return recons_secret;
  }

  // modify secret share implementations to use BigNumber
  function createSecretShare(jiff, share) {
    var self = share;

    var oldIsConstant = self.isConstant;
    self.isConstant = function(o) {
      return oldIsConstant(o) || o.isBigNumber === true;
    }

    self.cadd = function(cst) {
      if (!(self.isConstant(cst))) throw "parameter should be a number (+)";

      if(self.ready) // if share is ready
        return jiff.secret_share(self.jiff, true, null, self.jiff.helpers.mod(self.value.plus(cst), self.Zp), self.holders, self.threshold, self.Zp);

      var promise = self.promise.then(function() { return self.jiff.helpers.mod(self.value.plus(cst), self.Zp); }, self.error);
      return jiff.secret_share(self.jiff, false, promise, undefined, self.holders, self.threshold, self.Zp);
    };
    self.csub = function(cst) {
      if (!(self.isConstant(cst))) throw "parameter should be a number (-)";

      if(self.ready) // if share is ready
        return jiff.secret_share(self.jiff, true, null, self.jiff.helpers.mod(self.value.minus(cst), self.Zp), self.holders, self.threshold, self.Zp);

      var promise = self.promise.then(function() { return self.jiff.helpers.mod(self.value.minus(cst), self.Zp); }, self.error);
      return jiff.secret_share(self.jiff, false, promise, undefined, self.holders, self.threshold, self.Zp);
    }
    self.cmult = function(cst) {
      if (!(self.isConstant(cst))) throw "parameter should be a number (*)";

      if(self.ready) // if share is ready
        return jiff.secret_share(self.jiff, true, null, self.jiff.helpers.mod(self.value.times(cst), self.Zp), self.holders, self.threshold, self.Zp);

      var promise = self.promise.then(function() { return self.jiff.helpers.mod(self.value.times(cst), self.Zp); }, self.error);
      return jiff.secret_share(self.jiff, false, promise, undefined, self.holders, self.threshold, self.Zp);
    };

    self.sadd = function(o) {
      if (!(o.jiff === self.jiff)) throw "shares do not belong to the same instance (+)";
      if (!self.jiff.helpers.Zp_equals(self, o)) throw "shares must belong to the same field (+)";
      if (!self.jiff.helpers.array_equals(self.holders, o.holders)) throw "shares must be held by the same parties (+)";

      // add the two shares when ready locally
      var ready_add = function() {
        return self.jiff.helpers.mod(self.value.plus(o.value), self.Zp);
      }

      if(self.ready && o.ready) // both shares are ready
        return jiff.secret_share(self.jiff, true, null, ready_add(), self.holders, max(self.threshold, o.threshold), self.Zp);

      // promise to execute ready_add when both are ready
      var promise = self.pick_promise(o).then(ready_add, self.error);
      return jiff.secret_share(self.jiff, false, promise, undefined, self.holders, max(self.threshold, o.threshold), self.Zp);
    };
    self.ssub = function(o) {
      if (!(o.jiff === self.jiff)) throw "shares do not belong to the same instance (-)";
      if (!self.jiff.helpers.Zp_equals(self, o)) throw "shares must belong to the same field (-)";
      if (!self.jiff.helpers.array_equals(self.holders, o.holders)) throw "shares must be held by the same parties (-)";

      // add the two shares when ready locally
      var ready_sub = function() {
        return self.jiff.helpers.mod(self.value.minus(o.value), self.Zp);
      }

      if(self.ready && o.ready) // both shares are ready
        return jiff.secret_share(self.jiff, true, null, ready_sub(), self.holders, max(self.threshold, o.threshold), self.Zp);

      // promise to execute ready_add when both are ready
      var promise = self.pick_promise(o).then(ready_sub, self.error);
      return jiff.secret_share(self.jiff, false, promise, undefined, self.holders, max(self.threshold, o.threshold), self.Zp);
    };
    self.smult = function(o, op_id) {
      if (!(o.jiff === self.jiff)) throw "shares do not belong to the same instance (*)";
      if (!self.jiff.helpers.Zp_equals(self, o)) throw "shares must belong to the same field (*)";
      if (!self.jiff.helpers.array_equals(self.holders, o.holders)) throw "shares must be held by the same parties (*)";

      var final_deferred = $.Deferred();
      var final_promise = final_deferred.promise();
      var result = jiff.secret_share(self.jiff, false, final_promise, undefined, self.holders, max(self.threshold, o.threshold), self.Zp, op_id);

      // Get shares of triplets.
      var triplet_id = op_id == null ? null : op_id + ":triplet";
      var triplet = jiff.triplet(self.holders, max(self.threshold, o.threshold), self.Zp, triplet_id);

      var a = triplet[0];
      var b = triplet[1];
      var c = triplet[2];

      // d = s - a. e = o - b.
      var d = self.sadd(a.cmult(-1));
      var e = o.sadd(b.cmult(-1));

      // Open d and e.
      // The only communication cost.
      var e_promise = self.jiff.open(e, e.holders, b.id + ":open");
      var d_promise = self.jiff.open(d, d.holders, a.id + ":open");
      Promise.all([e_promise, d_promise]).then(function(arr) {
        var e_open = arr[0];
        var d_open = arr[1];

        // result_share = d_open * e_open + d_open * b_share + e_open * a_share + c.
        var t1 = d_open.times(e_open);
        var t2 = b.cmult(d_open);
        var t3 = a.cmult(e_open);

        // All this happens locally.
        var final_result = t2.cadd(t1);
        final_result = final_result.sadd(t3);
        final_result = final_result.sadd(c);

        if(final_result.ready)
          final_deferred.resolve(final_result.value);
        else // Resolve the deferred when ready.
          final_result.promise.then(function () { final_deferred.resolve(final_result.value); });
      });

      return result;
    };

    self.sdiv = function(o, l, op_id) {
      if (!(o.jiff === self.jiff)) throw "shares do not belong to the same instance (!=)";
      if (!self.jiff.helpers.Zp_equals(self, o)) throw "shares must belong to the same field (!=)";
      if (!self.jiff.helpers.array_equals(self.holders, o.holders)) throw "shares must be held by the same parties (!=)";

      // default bit length is the max possible bit length without getting in trouble with javascript big numbers.
      if(l == null) l = Math.floor(self.jiff.helpers.bLog(self.Zp) / 2) - self.threshold + 1;

      // q_shr is this party's share of the quotient, initialy a share of zero.
      var number_id = op_id == null ? null : op_id+":number";
      var q_shr = self.jiff.server_generate_and_share({"number": 0}, self.holders, self.threshold, self.Zp, number_id);
      for (var i = 0; i < l; i++) {
        var power = new BigNumber(2).pow((l-1)-i).floor();

        var mask = q_shr.cadd(power);
        var cmp_id = op_id == null ? null : op_id+":slteq"+i;
        var tmp_m = (mask.smult(o)).slteq(self, 2*l, cmp_id);
        q_shr = q_shr.sadd(tmp_m.cmult(power));
      }
      if(op_id != null) q_shr.id = op_id;
      return q_shr;
    };

    self.sgteq = function(o, l, op_id) {
      if (!(o.jiff === self.jiff)) throw "shares do not belong to the same instance (>=)";
      if (!self.jiff.helpers.Zp_equals(self, o)) throw "shares must belong to the same field (>=)";
      if (!self.jiff.helpers.array_equals(self.holders, o.holders)) throw "shares must be held by the same parties (>=)";

      var final_deferred = $.Deferred();
      var final_promise = final_deferred.promise();
      var result = jiff.secret_share(self.jiff, false, final_promise, undefined, self.holders, max(self.threshold, o.threshold), self.Zp, op_id);

      var k = Math.max(self.threshold, o.threshold);
      if(l == null) l = Math.floor(self.jiff.helpers.bLog(self.Zp, 2) - k - 1);

      if(l <= 0) throw "field too small compared to threshold";
      var assert = new BigNumber(2).pow(l + 2).floor().plus(new BigNumber(2).pow(l + k).floor());
      if(!(self.Zp.gte(assert))) throw "field too small compared to security and bit length (" + assert + ")";

      function preprocess() {
        var r_bits = [];
        for(var i = 0; i < l + k; i++)
          r_bits[i] = self.jiff.server_generate_and_share({ "bit": true }, self.holders, max(self.threshold, o.threshold), self.Zp, op_id == null ? null : op_id + ":bit"+i);

        var r_modl = r_bits[0];
        for(var i = 1; i < l; i++)
          r_modl = r_modl.sadd(r_bits[i].cmult(new BigNumber(2).pow(i).floor()));

        var r_full = r_modl;
        for(var i = l; i < l + k; i++)
          r_full = r_full.sadd(r_bits[i].cmult(new BigNumber(2).pow(i).floor()));

        r_bits = r_bits.slice(0, l);

        var s_bit = self.jiff.server_generate_and_share({ "bit": true }, self.holders, max(self.threshold, o.threshold), self.Zp, op_id == null ? null : op_id + ":sbit");
        var s_sign = s_bit.cmult(-2).cadd(1);

        var mask = self.jiff.server_generate_and_share({ "nonzero": true }, self.holders, max(self.threshold, o.threshold), self.Zp, op_id == null ? null : op_id + ":mask");

        return { "s_bit": s_bit, "s_sign": s_sign, "mask": mask, "r_full": r_full, "r_modl": r_modl, "r_bits": r_bits };
      }

      function finish_compare(c, s_bit, s_sign, mask, r_modl, r_bits, z, nested_op_ids, nested_triplet_id) {
        var str_c = c.toString(2);
        var c_bits = []; // array of bignumbers

        for(var i = 0; i < l; i++)
          if(str_c.length - i - 1 < 0) c_bits[i] = new BigNumber(0);
          else c_bits[i] = new BigNumber(str_c.charAt(str_c.length - i - 1));

        var sumXORs = [];
        for(var i = 0; i < l; i++)
          sumXORs[i] = new BigNumber(0);

        sumXORs[l-2] = r_bits[l-1].cxor_bit(c_bits[l-1]).cadd(sumXORs[l-1]);
        for(var i = l-3; i > -1; i--)
          sumXORs[i] = r_bits[i+1].cxor_bit(c_bits[i+1]).sadd(sumXORs[i+1]);

        var E_tilde = [];
        for(var i = 0; i < r_bits.length; i++) {
          var e_i = r_bits[i].cadd(c_bits[i].times(-1)).sadd(s_sign);
          if(i != l-1)
            e_i = e_i.sadd(sumXORs[i].cmult(3));
          else
            e_i = e_i.cadd(sumXORs[i].times(3));

          E_tilde.push(e_i);
        }

        var product = mask;
        for(var i = 0; i < E_tilde.length; i++)
          product = product.smult(E_tilde[i], nested_triplet_id+":nested"+i);

        self.jiff.open(product, self.holders, nested_op_ids).then(function(product) {
          var non_zero = new BigNumber( !(product.eq(0)) ? 1 : 0);
          var UF = s_bit.cxor_bit(non_zero);
          var c_mod2l = self.jiff.helpers.mod(c, new BigNumber(2).pow(l).floor());
          var res = UF.cmult(new BigNumber(2).pow(l).floor()).ssub(r_modl.cadd(c_mod2l.times(-1)));

          var inverse = self.jiff.helpers.extended_gcd(new BigNumber(2).pow(l).floor(), self.Zp)[0];
          var final_result = z.ssub(res).cmult(inverse);
          if(final_result.ready)
            final_deferred.resolve(final_result.value);
          else
            final_result.promise.then(function () { final_deferred.resolve(final_result.value); });
        }, self.error);
      }

      function compare_online(preprocess) {
        var a = self.cmult(2).cadd(1);
        var b = o.cmult(2);

        var z = a.ssub(b).cadd(new BigNumber(2).pow(l).floor());
        var c = preprocess.r_full.sadd(z);

        // Unique and in order operation id for the nested open that is executed inside finish_compare.
        var nested_op_ids = {};
        var holders_label = self.holders.join(",");
        for(var i = 0; i < self.holders.length; i++)
          if(op_id == null) nested_op_ids[self.holders[i]] = self.jiff.counters.gen_open_id(self.holders[i], holders_label);
          else nested_op_ids[self.holders[i]] = op_id + ":" + receiver + ":" + holders_string;

        // Unique and in order single triplet id for the nest secret multiplication that is executed inside finish_compare.
        var nested_triplet_id = op_id == null ? self.jiff.counters.gen_triplet_id(self.holders) : op_id + ":triplet";

        self.jiff.open(c, self.holders).then(function(c) { finish_compare(c, preprocess.s_bit, preprocess.s_sign, preprocess.mask, preprocess.r_modl, preprocess.r_bits, z, nested_op_ids, nested_triplet_id); }, self.error);
      }

      var pre = preprocess();
      compare_online(pre);

      return result;
    };

    return self;
  }

  // Take the jiff-client base instance and options for this module, and use them
  // to construct an instance for this module.
  function make_jiff(base_instance, options) {
    var jiff = base_instance;

    // Parse options
    if(options == null) options = {};
    if(options.Zp != null) base_instance.Zp = options.Zp;
    base_instance.Zp = new BigNumber(base_instance.Zp);

    // Add module name
    jiff.modules.push('bignumber');

    // Turn thing into their BigNumber equivalent

    /* HELPERS */
    jiff.helpers.mod = function(x, y) {
      x = new BigNumber(x); y = new BigNumber(y);
      if (x.isNeg()) return x.mod(y).plus(y);
      return x.mod(y);
    };

    jiff.helpers.extended_gcd = function(a, b) {
      a = new BigNumber(a); b = new BigNumber(b);
      return (
        function recursive_helper(a, b) {
          if (b.isZero())
            return [new BigNumber(1), new BigNumber(0), a];

          temp = recursive_helper(b, jiff.helpers.mod(a, b));
          x = temp[0]; y = temp[1]; d = temp[2];
          return [y, x.minus(y.times(a.div(b).floor())), d];
        }
      )(a, b);
    };

    jiff.helpers.bLog = function(value, base) {
      // Not really log, but good enough since all we need is either floor or ceil of log.
      if(base == null) base = 2;
      var blog = value.toString(base).length;
      var test = new BigNumber(base).pow(blog);
      if(test.eq(value)) return blog;
      return blog + 0.5;
    };

    jiff.helpers.Zp_equals = function(s1, s2) {
      return s1.Zp.eq(s2.Zp);
    };

    jiff.helpers.random = function(max) {
      return BigNumber.random().times(max).floor();
    }

    /* ALTERNATE IMPLEMENTATION */
    var old_coerce = jiff.coerce_to_share;
    jiff.coerce_to_share = function(number, holders, Zp, share_id) { return old_coerce(new BigNumber(number), holders, Zp, share_id); };

    /* HOOKS */
    jiff.hooks.decryptSign = decrypt_and_sign;
    jiff.hooks.beforeShare.push(function(jiff, secret, threshold, receivers_list, senders_list, Zp) { return new BigNumber(secret); });

    jiff.hooks.computeShares = jiff_compute_shares;
    jiff.hooks.reconstructShare = jiff_lagrange;

    jiff.hooks.createSecretShare.push(createSecretShare);
    jiff.hooks.receiveTriplet.push(function(jiff, triplet) { return { 'a': new BigNumber(triplet['a']), 'b': new BigNumber(triplet['b']), 'c': new BigNumber(triplet['c']) }; });
    jiff.hooks.receiveNumber.push(function(jiff, number) { return new BigNumber(number); });

    return jiff;
  }

  // Expose the functions that consitute the API for this module.
  exports.make_jiff = make_jiff;
  exports.utils = { 'decrypt_and_sign': decrypt_and_sign };
  exports.sharing_schemes = { 'shamir_share': jiff_compute_shares, 'shamir_reconstruct': jiff_lagrange };
}((typeof exports == 'undefined' ? this.jiff_bignumber = {} : exports), typeof exports != 'undefined'));
