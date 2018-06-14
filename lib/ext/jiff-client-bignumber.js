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

    secret = jiff.helpers.BigNumber(secret);
    Zp = jiff.helpers.BigNumber(Zp);

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
      var power = jiff.helpers.BigNumber(jiff.helpers.get_party_number(p_id));

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
      shares[i].Zp = jiff.helpers.BigNumber(shares[i].Zp);
      shares[i].value = jiff.helpers.BigNumber(shares[i].value);

      var pi = jiff.helpers.get_party_number(shares[i].sender_id);
      lagrange_coeff[pi] = jiff.helpers.BigNumber(1);

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
    var recons_secret = jiff.helpers.BigNumber(0);
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

      if(op_id == null)
        op_id = self.jiff.counters.gen_op_id("*", self.holders);

      var final_deferred = $.Deferred();
      var final_promise = final_deferred.promise();
      var result = jiff.secret_share(self.jiff, false, final_promise, undefined, self.holders, max(self.threshold, o.threshold), self.Zp, op_id);

      // Get shares of triplets.
      var triplet = jiff.triplet(self.holders, max(self.threshold, o.threshold), self.Zp, op_id+":triplet");

      var a = triplet[0];
      var b = triplet[1];
      var c = triplet[2];

      // d = s - a. e = o - b.
      var d = self.sadd(a.cmult(-1));
      var e = o.sadd(b.cmult(-1));

      // Open d and e.
      // The only communication cost.
      var e_promise = self.jiff.open(e, e.holders, op_id+":open1");
      var d_promise = self.jiff.open(d, d.holders, op_id+":open2");
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

    self.cgt = function(cst, op_id) {
      if (!(self.isConstant(cst))) throw "parameter should be a number (<)";

      if(op_id == null)
        op_id = self.jiff.counters.gen_op_id("c<", self.holders);

      cst = self.jiff.helpers.BigNumber(cst);
      var w = cst.lt(self.Zp.div(2)) ? 1 : 0;
      var x = self.lt_halfprime(op_id+":halfprime:1");
      var y = self.cmult(-1).cadd(cst).lt_halfprime(op_id+":halfprime:2");

      var xy = y.smult(x, op_id+":smult1");
      return x.cmult(-1).cadd(1).ssub(y).sadd(xy).sadd(x.sadd(y).ssub(xy.cmult(2)).cmult(w));
    };
    self.clt = function(cst, op_id) {
      if (!(self.isConstant(cst))) throw "parameter should be a number (<)";

      if(op_id == null)
        op_id = self.jiff.counters.gen_op_id("c<", self.holders);

      cst = self.jiff.helpers.BigNumber(cst);
      var w = self.lt_halfprime(op_id+":halfprime:1");
      var x = cst.lt(self.Zp.div(2)) ? 1 : 0;
      var y = self.csub(cst).lt_halfprime(op_id+":halfprime:2");

      var xy = y.cmult(x);
      return y.cmult(-1).cadd(1-x).sadd(xy).sadd(w.smult(y.cadd(x).ssub(xy.cmult(2)), op_id+":smult1"));
    };

    self.sdiv = function(o, l, op_id) {
      if (!(o.jiff === self.jiff)) throw "shares do not belong to the same instance (!=)";
      if (!self.jiff.helpers.Zp_equals(self, o)) throw "shares must belong to the same field (!=)";
      if (!self.jiff.helpers.array_equals(self.holders, o.holders)) throw "shares must be held by the same parties (!=)";

      if(op_id == null)
        op_id = self.jiff.counters.gen_op_id("/", self.holders);

      if(l == null) l = Math.floor(self.jiff.helpers.bLog(self.Zp, 2));

      // Store the result
      var final_deferred = $.Deferred();
      var final_promise = final_deferred.promise();
      var result = self.jiff.secret_share(self.jiff, false, final_promise, undefined, self.holders, max(self.threshold, o.threshold), self.Zp, "share:"+op_id);

      var q = self.jiff.server_generate_and_share({"number": 0}, self.holders, max(self.threshold, o.threshold), self.Zp, op_id+":number");
      var a = self; // dividend

      (function one_bit(i) {
        if(i >= l) { 
          // we did this for all bits, q has the answer
          if(q.ready) final_deferred.resolve(q.value);
          else q.promise.then(function() { final_deferred.resolve(q.value); });
          return;
        }
        
        var power = self.jiff.helpers.BigNumber(2).pow((l-1)-i);
      
        // (2^i + 2^k + ...) * o <= self
        // 2^l * o <= self => q = 2^l, self = self - o * 2^l
        var tmp = o.cmult(power); // this may wrap around, in which case we must ignored it, since the answer MUST fit in the field.
        var tmpFits = o.clteq(o.Zp.div(power).floor(), op_id+":c<="+i);
        var tmpCmp = tmp.slteq(a, op_id+":<="+i);

        var and = tmpFits.smult(tmpCmp, op_id+":smult1:"+i);
        q = q.sadd(and.cmult(power));
        a = a.ssub(and.smult(tmp, op_id+":smult2:"+i)); // a - tmp > 0 if tmp > 0

        Promise.all([q.promise, a.promise]).then(function() {one_bit(i+1); });
      })(0);

      return result;
    };
    self.cdiv = function(cst, op_id) {
      if (!(self.isConstant(cst))) throw "parameter should be a number (/)";

      if(op_id == null)
        op_id = self.jiff.counters.gen_op_id("c/", self.holders);

      // Allocate share for result to which the answer will be resolved once available
      var final_deferred = $.Deferred();
      var final_promise = final_deferred.promise();
      var result = self.jiff.secret_share(self.jiff, false, final_promise, undefined, self.holders, self.threshold, self.Zp, "share:" + op_id);

      var ZpOVERc = self.Zp.div(cst).floor();

      // add uniform noise to self so we can open
      var nOVERc = self.jiff.server_generate_and_share({ "max":  ZpOVERc }, self.holders, self.threshold, self.Zp, op_id+":nOVERc");
      var nMODc = self.jiff.server_generate_and_share({ "max": cst }, self.holders, self.threshold, self.Zp, op_id+":nMODc");
      var noise = nOVERc.cmult(cst).sadd(nMODc);

      var noisyX = self.sadd(noise);
      self.jiff.open(noisyX, noisyX.holders, op_id+":open").then(function(noisyX) {
        var wrapped = self.cgt(noisyX, op_id+":wrap_cgt"); // 1 => x + noise wrapped around Zp, 0 otherwise

        // if we did not wrap
        var noWrapDiv = noisyX.div(cst).floor();
        var unCorrectedQuotient = nOVERc.cmult(-1).cadd(noWrapDiv).csub(1);
        var verify = self.ssub(unCorrectedQuotient.cmult(cst));
        var isNotCorrect = verify.cgteq(cst, op_id+":cor1");
        var noWrapAnswer = unCorrectedQuotient.sadd(isNotCorrect); // if incorrect => isNotCorrect = 1 => quotient = unCorrectedQuotient - 1

        // if we wrapped
        var wrapDiv = noisyX.plus(self.Zp).div(cst).floor();
        unCorrectedQuotient = nOVERc.cmult(-1).cadd(wrapDiv).csub(1);
        verify = self.ssub(unCorrectedQuotient.cmult(cst));
        isNotCorrect = verify.cgteq(cst, op_id+":cor2");
        var wrapAnswer = unCorrectedQuotient.sadd(isNotCorrect); // if incorrect => isNotCorrect = 1 => quotient = unCorrectedQuotient - 1

        var answer = noWrapAnswer.sadd(wrapped.smult(wrapAnswer.ssub(noWrapAnswer), op_id+":smult"));

        if(answer.ready) final_deferred.resolve(answer.value);
        else answer.promise.then(function() { final_deferred.resolve(answer.value); });
      });

      // special case, if result is zero, sometimes we will get to -1 due to how correction happens aboe (.csub(1) and then compare)
      var zeroIt = self.clt(cst, op_id+":zero_check").not();
      return result.smult(zeroIt, op_id+":zero_it");
    };

    return self;
  }

  // Take the jiff-client base instance and options for this module, and use them
  // to construct an instance for this module.
  function make_jiff(base_instance, options) {
    var jiff = base_instance;

    // Parse options
    if(options == null) options = {};
    if(options.Zp != null) jiff.Zp = options.Zp;
    jiff.Zp = new BigNumber(jiff.Zp);

    // Add module name
    jiff.modules.push('bignumber');

    // Turn thing into their BigNumber equivalent

    /* HELPERS */
    jiff.helpers.BigNumber = function(n) {
      return new BigNumber(n);
    };

    jiff.helpers.mod = function(x, y) {
      x = jiff.helpers.BigNumber(x); y = jiff.helpers.BigNumber(y);
      if (x.isNeg()) return x.mod(y).plus(y);
      return x.mod(y);
    };

    jiff.helpers.pow_mod = function(a, b, n) {
      b = jiff.helpers.BigNumber(b);
      a = jiff.helpers.mod(a, n);
      var x = a;
      var result = jiff.helpers.BigNumber(1);
      while(b.gt(0)) {
        var leastSignificantBit = jiff.helpers.mod(b, 2);
        b = b.div(2).floor();
        if (leastSignificantBit.eq(1)) {
          result = result.times(x);
          result = jiff.helpers.mod(result, n);
        }
        x = x.times(x);
        x = jiff.helpers.mod(x, n);
      }
      return result;
    };

    jiff.helpers.extended_gcd = function(a, b) {
      a = jiff.helpers.BigNumber(a); b = jiff.helpers.BigNumber(b);
      return (
        function recursive_helper(a, b) {
          if (b.isZero())
            return [jiff.helpers.BigNumber(1), jiff.helpers.BigNumber(0), a];

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
      var test = jiff.helpers.BigNumber(base).pow(blog);
      if(test.eq(value)) return blog;
      return blog - 0.5;
    };

    jiff.helpers.Zp_equals = function(s1, s2) {
      return s1.Zp.eq(s2.Zp);
    };

    jiff.helpers.random = function(max) {
      if(max == null) max = jiff.Zp;
      return BigNumber.random().times(max).floor();
    }

    /* SUB-PROTOCOLS */
    jiff.protocols.bit_composition = function(bits) {
      var result = bits[0];
      var pow = jiff.helpers.BigNumber(1);
      for(var i = 1; i < bits.length; i++) {
        pow = pow.times(2);
        result = result.sadd(bits[i].cmult(pow));
      }
      return result;
    };

    /* HOOKS */
    jiff.hooks.decryptSign = decrypt_and_sign;
    jiff.hooks.beforeShare.push(function(jiff, secret, threshold, receivers_list, senders_list, Zp) { return jiff.helpers.BigNumber(secret); });

    jiff.hooks.computeShares = jiff_compute_shares;
    jiff.hooks.reconstructShare = jiff_lagrange;

    jiff.hooks.createSecretShare.push(createSecretShare);
    jiff.hooks.receiveTriplet.push(function(jiff, triplet) { return { 'a': jiff.helpers.BigNumber(triplet['a']), 'b': jiff.helpers.BigNumber(triplet['b']), 'c': jiff.helpers.BigNumber(triplet['c']) }; });
    jiff.hooks.receiveNumber.push(function(jiff, number) { return jiff.helpers.BigNumber(number); });

    return jiff;
  }

  // Expose the functions that consitute the API for this module.
  exports.make_jiff = make_jiff;
  exports.utils = { 'decrypt_and_sign': decrypt_and_sign };
  exports.sharing_schemes = { 'shamir_share': jiff_compute_shares, 'shamir_reconstruct': jiff_lagrange };
}((typeof exports == 'undefined' ? this.jiff_bignumber = {} : exports), typeof exports != 'undefined'));
