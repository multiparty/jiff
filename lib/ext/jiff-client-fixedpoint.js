
/**
 * This defines a library module for for fixed point arithmetic in JIFF.
 * This wraps and exposes the jiff_fixedpoint API. Exposed members can be accessed with jiff_fixedpoint.&lt;member-name&gt;
 * in browser JS, or by using require('./modules/jiff-client-fixedpoint').&lt;member-name&gt; as usual in nodejs.
 *
 * @namespace jiff
 * @version 1.0
 */
(function(exports, node) {
  function min(x, y) {
    return x < y ? x : y;
  }

  function max(x, y) {
    return x > y ? x : y;
  }

  // int_part, fraction_part should both be secert shares.
  function createFixedpointSecretShare(jiff_instance, share, share_helpers) {
    share.legacy = {};
    var internals = [ "cadd", "csub", "cmult", "sadd", "ssub", "smult",
                      "cxor_bit", "sxor_bit", "cor_bit", "sor_bit",
                      "slt", "slteq", "sgt", "sgteq", "seq", "sneq",
                      "clt", "clteq", "cgt", "cgteq", "ceq", "cneq",
                      "sdiv", "cdiv", "lt_halfprime" ];
    for(var i = 0; i < internals.length; i++) {
      var key = internals[i];
      share.legacy[key] = share[key];
    }

    share.cadd = function(cst) {
      if (!(share.isConstant(cst))) throw "Fixedpoint: parameter should be a number (+)";

      var magnitude = share.jiff.helpers.magnitude(share.jiff.decimal_digits);
      cst = share_helpers['floor'](share_helpers['*'](cst, magnitude));
      return share.legacy.cadd(cst);
    };
    share.csub = function(cst) {
      if (!(share.isConstant(cst))) throw "Fixedpoint: parameter should be a number (-)";

      var magnitude = share.jiff.helpers.magnitude(share.jiff.decimal_digits);
      cst = share_helpers['floor'](share_helpers['*'](cst, magnitude));
      return share.legacy.csub(cst);
    };
    share.cmult = function(cst, op_id) {
    try {
      if (!(share.isConstant(cst))) throw "Fixedpoint: parameter should be a number (-)";
      if(cst.toString().indexOf(".") == -1)
        return share.legacy.cmult(cst);

      var magnitude = share.jiff.helpers.magnitude(share.jiff.decimal_digits);
      cst = share_helpers['floor'](share_helpers['*'](cst, magnitude));

      var result = share.legacy.cmult(cst); // TODO op_id must be sent from generic mult to cmult
      return result.cdiv(magnitude, op_id);
      } catch(err) { console.log(err); }
    };
    share.smult = function(o, op_id) {
      if (!(o.jiff === share.jiff)) throw "Fixedpoint: shares do not belong to the same instance (*)";
      if (!share.jiff.helpers.Zp_equals(share, o)) throw "Fixedpoint: shares must belong to the same field (*)";
      if (!share.jiff.helpers.array_equals(share.holders, o.holders)) throw "shares must be held by the same parties (*)";

      if(op_id == null)
        op_id = share.jiff.counters.gen_op_id("*", share.holders);

      var magnitude = share.jiff.helpers.magnitude(share.jiff.decimal_digits);

      var result = share.legacy.smult(o, op_id);
      return result.legacy.cdiv(magnitude, op_id+":reduce");
    };

    share.slt = function(o, op_id) {
      console.log('h');
      if (!(o.jiff === share.jiff)) throw "shares do not belong to the same instance (<)";
      if (!share.jiff.helpers.Zp_equals(share, o)) throw "shares must belong to the same field (<)";
      if (!share.jiff.helpers.array_equals(share.holders, o.holders)) throw "shares must be held by the same parties (<)";

      if(op_id == null)
        op_id = share.jiff.counters.gen_op_id("<", share.holders);

      var magnitude = share.jiff.helpers.magnitude(share.jiff.decimal_digits);

      var result = share.legacy.slt(o, op_id);
      return result.legacy.cmult(magnitude, op_id+":increase");
    };

    share.clt = function(cst, op_id) {
      console.log('hs');
      if (!(share.isConstant(cst))) throw "parameter should be a number (<)";

      if(op_id == null)
        op_id = share.jiff.counters.gen_op_id("c<", share.holders);

      var magnitude = share.jiff.helpers.magnitude(share.jiff.decimal_digits);

      var result = share.legacy.clt(cst, op_id);
      return result.legacy.cmult(magnitude, op_id+":increase");
    };

    share.cgt = function(cst, op_id) {
      console.log('hg');
      if (!(share.isConstant(cst))) throw "parameter should be a number (>)";

      if(op_id == null)
        op_id = share.jiff.counters.gen_op_id("c>", share.holders);

      var magnitude = share.jiff.helpers.magnitude(share.jiff.decimal_digits);

      var result = share.legacy.cgt(cst, op_id);
      return result.legacy.cmult(magnitude, op_id+":increase");
    };

    share.sdiv = function(o, l, op_id) {
      throw "Fixedpoint: DIV NOT YET SUPPORTED";
      /*
      if (!(o.jiff === share.jiff)) throw "shares do not belong to the same instance (!=)";
      if (!share.jiff.helpers.Zp_equals(share, o)) throw "shares must belong to the same field (!=)";
      if (!share.jiff.helpers.array_equals(share.holders, o.holders)) throw "shares must be held by the same parties (!=)";

      // Forget all about decimal points and accuracies for now
      // Execute division as if regular integers
      var share_tmp = [share.decimal_digits, share.integer_digits, share.free_digits];
      var o_tmp = [o.decimal_digits, o.integer_digits, o.free_digits];
      var total = share.decimal_digits + share.integer_digits + share.free_digits;

      share.decimal_digits = 0; share.integer_digits = total; share.free_digits = 0;
      o.decimal_digits = 0; o.integer_digits = total; o.free_digits = 0;
      
      var result = share.legacy.sdiv(o);

      // restore accuracies
      share.decimal_digits = share_tmp[0]; share.integer_digits = share_tmp[1]; share.free_digits = share_tmp[2];
      o.decimal_digits = o_tmp[0]; o.integer_digits = o_tmp[1]; o.free_digits = o_tmp[2];

      result.decimal_digits = share.decimal_digits - o.decimal_digits;
      result.integer_digits = max(share.integer_digits, o.integer_digits);
      result.free_digits = total - result.decimal_digits - result.integer_digits;
      return result;
      */
    };

    share.cdiv = function(cst, op_id) {
      if (!(share.isConstant(cst))) throw "parameter should be a number (/)";

      if(op_id == null)
        op_id = share.jiff.counters.gen_op_id("c/", share.holders);

      var magnitude = share.jiff.helpers.magnitude(share.jiff.decimal_digits);
      var increased = share.legacy.cmult(magnitude);

      return increased.legacy.cdiv(cst);
    };

    return share;
  }

  // Take the jiff-client base instance and options for this module, and use them
  // to construct an instance for this module.
  function make_jiff(base_instance, options) {
    if(base_instance.modules.indexOf("bignumber") == -1) {
      throw "Fixedpoint extension must be applied on top of bignumber extension.";
    }

    /*
     * PARSE OPTIONS
     */
    if(options == null) options = {};
    if(options.Zp != null) base_instance.Zp = options.Zp;

    base_instance.total_digits = Math.floor(base_instance.helpers.bLog(base_instance.Zp, 10));
    if(options.decimal_digits == null && options.integer_digits == null) {
      options.decimal_digits = Math.floor(base_instance.total_digits / 3);
      options.integer_digits = Math.floor(base_instance.total_digits / 3);
    }
    else if(options.decimal_digits == null) {
      options.decimal_digits = Math.floor((base_instance.total_digits - options.integer_digits) / 2);
    } else if(options.integer_digits == null) {
      options.integer_digits = base_instance.total_digits - 2 * options.decimal_digits;
    }

    base_instance.decimal_digits = options.decimal_digits;
    base_instance.integer_digits = options.integer_digits;
    base_instance.free_digits = base_instance.total_digits - base_instance.decimal_digits - base_instance.integer_digits;
    if(base_instance.free_digits < 0 || base_instance.decimal_digits < 0 || base_instance.integer_digits < 0)
      throw "Fixedpoint: Zp is not large enough to fit integer and decimal parts size"

    /*
     * ADD MODULE NAME
     */
    base_instance.modules.push("fixedpoint");

    /* HELPERS */
    base_instance.helpers.magnitude = function(m) {
      return base_instance.helpers.BigNumber(10).pow(m).floor();
    };
    base_instance.helpers.fits_in_digits = function(num) {
      var magnitude = base_instance.helpers.magnitude(base_instance.decimal_digits + base_instance.integer_digits);
      return num.lt(magnitude);
    };
    base_instance.helpers.format_as_float = function(v) {
      var max_value = base_instance.helpers.magnitude(base_instance.decimal_digits + base_instance.integer_digits);
//      if(v.gte(max_value)) throw "Fixedpoint: open result is not accurate: integer part grew too big.";
      var magnitude = base_instance.helpers.magnitude(base_instance.decimal_digits);
      return v.div(magnitude);
    };
    base_instance.helpers.format_as_fixed = function(v) {
      if(!base_instance.helpers.fits_in_digits(v)) throw "Fixedpoint share: integer part is too big";
      var magnitude = base_instance.helpers.magnitude(base_instance.decimal_digits);
      return magnitude.times(v).floor();
    };

    /* OPEN */
    var old_open = base_instance.open;
    base_instance.open = function(share, parties, op_ids) {
      var promise = old_open(share, parties, op_ids);
      if(promise == null) return null;
      return promise.then(base_instance.helpers.format_as_float);
    };
    var old_receive_open = base_instance.receive_open;
    base_instance.receive_open = function(parties, threshold, Zp, op_ids) {
      var promise = old_receive_open(parties, threshold, Zp, op_ids);
      return promise.then(base_instance.helpers.format_as_float);
    };

    /* HOOKS */
    base_instance.hooks.beforeShare.push(function(jiff, secret, threshold, receivers_list, senders_list, Zp) {
      return base_instance.helpers.format_as_fixed(secret);
    });
    base_instance.hooks.createSecretShare.push(createFixedpointSecretShare);

    return base_instance;
  }

  // Expose the functions that consitute the API for this module.
  exports.make_jiff = make_jiff;
}((typeof exports == 'undefined' ? this.jiff_fixedpoint = {} : exports), typeof exports != 'undefined'));
