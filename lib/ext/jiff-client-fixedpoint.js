/**
 * This defines a library module for for fixed point arithmetic in JIFF.
 * This wraps and exposes the jiff_fixedpoint API. Exposed members can be accessed with jiff_fixedpoint.&lt;member-name&gt;
 * in browser JS, or by using require('./modules/jiff-client-fixedpoint').&lt;member-name&gt; as usual in nodejs.
 *
 * @namespace jiff
 * @version 1.0
 */
(function (exports, node) {
  function min(x, y) {
    return x < y ? x : y;
  }

  function max(x, y) {
    return x > y ? x : y;
  }

  // int_part, fraction_part should both be secert shares.
  function createFixedpointSecretShare(jiff_instance, share, share_helpers) {
    share.legacy = {};
    var internals = ['cadd', 'csub', 'cmult', 'sadd', 'ssub', 'smult',
      'cxor_bit', 'sxor_bit', 'cor_bit', 'sor_bit',
      'slt', 'slteq', 'sgt', 'sgteq', 'seq', 'sneq',
      'clt', 'clteq', 'cgt', 'cgteq', 'ceq', 'cneq',
      'sdiv', 'cdiv', 'lt_halfprime'];
    for (var i = 0; i < internals.length; i++) {
      var key = internals[i];
      share.legacy[key] = share[key];
    }

    // Modify generic mult function to pass op_id to both cmult and smult
    share.mult = function (o, op_id) {
      if (share.isConstant(o)) {
        return share.cmult(o, op_id);
      }
      return share.smult(o, op_id);
    };

    // Constant arithmetic operations
    share.cadd = function (cst) {
      if (!(share.isConstant(cst))) {
        throw 'parameter should be a number (+)';
      }

      var magnitude = share.jiff.helpers.magnitude(share.jiff.decimal_digits);
      cst = share.jiff.helpers.BigNumber(cst);
      cst = share_helpers['floor'](share_helpers['*'](cst, magnitude));
      return share.legacy.cadd(cst);
    };
    share.csub = function (cst) {
      if (!(share.isConstant(cst))) {
        throw 'parameter should be a number (-)';
      }

      var magnitude = share.jiff.helpers.magnitude(share.jiff.decimal_digits);
      cst = share.jiff.helpers.BigNumber(cst);
      cst = share_helpers['floor'](share_helpers['*'](cst, magnitude));
      return share.legacy.csub(cst);
    };
    share.cmult = function (cst, op_id) {
      if (!(share.isConstant(cst))) {
        throw 'parameter should be a number (-)';
      }
      if (cst.toString().indexOf('.') === -1) {
        return share.legacy.cmult(cst);
      }

      var magnitude = share.jiff.helpers.magnitude(share.jiff.decimal_digits);
      cst = share.jiff.helpers.BigNumber(cst);
      cst = share_helpers['floor'](share_helpers['*'](cst, magnitude));

      var result = share.legacy.cmult(cst);
      return result.legacy.cdiv(magnitude, op_id);
    };

    // secret arithmetic operations
    share.smult = function (o, op_id) {
      if (!(o.jiff === share.jiff)) {
        throw 'shares do not belong to the same instance (*)';
      }
      if (!share.jiff.helpers.Zp_equals(share, o)) {
        throw 'shares must belong to the same field (*)';
      }
      if (!share.jiff.helpers.array_equals(share.holders, o.holders)) {
        throw 'shares must be held by the same parties (*)';
      }

      if (op_id == null) {
        op_id = share.jiff.counters.gen_op_id('*', share.holders);
      }

      var magnitude = share.jiff.helpers.magnitude(share.jiff.decimal_digits);

      var result = share.legacy.smult(o, op_id);
      return result.legacy.cdiv(magnitude, op_id + ':reduce');
    };

    // boolean operations on BINARY shares
    share.cxor_bit = function (cst) {
      if (!(share.isConstant(cst))) {
        throw 'parameter should be a number (^)';
      }
      if (!share_helpers['binary'](cst)) {
        throw 'parameter should be binary (^)';
      }

      return share.cadd(cst).issub(share.cmult(cst).cmult(2));
    };
    share.cor_bit = function (cst) {
      if (!(share.isConstant(cst))) {
        throw 'parameter should be a number (|)';
      }
      if (!share_helpers['binary'](cst)) {
        throw 'parameter should be binary (|)';
      }

      return share.cadd(cst).issub(share.cmult(cst));
    };
    share.sxor_bit = function (o, op_id) {
      if (!(o.jiff === share.jiff)) {
        throw 'shares do not belong to the same instance (^)';
      }
      if (!share.jiff.helpers.Zp_equals(share, o)) {
        throw 'shares must belong to the same field (^)';
      }
      if (!share.jiff.helpers.array_equals(share.holders, o.holders)) {
        throw 'shares must be held by the same parties (^)';
      }

      var magnitude = share.jiff.helpers.magnitude(share.jiff.decimal_digits);

      // share and o should be both binary integers => our representation of them should be either 0 or 1 * 10^{decimal_digits}
      // In both cases, multiplying by the inverse of 10^{decimal_digits} should be enough to reduce it to either 0 or 1.
      var reduced_share = share.cdivfac(magnitude);
      var reduced_o = o.cdivfac(magnitude);
      var reduced_xor = reduced_share.sadd(reduced_o).ssub(reduced_share.legacy.smult(reduced_o, op_id).cmult(2));
      return reduced_xor.cmult(magnitude);
    };
    share.sor_bit = function (o, op_id) {
      if (!(o.jiff === share.jiff)) {
        throw 'shares do not belong to the same instance (|)';
      }
      if (!share.jiff.helpers.Zp_equals(share, o)) {
        throw 'shares must belong to the same field (|)';
      }
      if (!share.jiff.helpers.array_equals(share.holders, o.holders)) {
        throw 'shares must be held by the same parties (|)';
      }

      var magnitude = share.jiff.helpers.magnitude(share.jiff.decimal_digits);

      // share and o should be both binary integers => our representation of them should be either 0 or 1 * 10^{decimal_digits}
      // In both cases, multiplying by the inverse of 10^{decimal_digits} should be enough to reduce it to either 0 or 1.
      var reduced_share = share.cdivfac(magnitude);
      var reduced_o = o.cdivfac(magnitude);
      var reduced_or = reduced_share.sadd(reduced_o).ssub(reduced_share.legacy.smult(reduced_o, op_id));
      return reduced_or.cmult(magnitude);
    };
    share.not = function () {
      return share.cmult(-1).cadd(1);
    };

    // Secret Comparisons
    share.slt = function (o, op_id) {
      var result = share.legacy.slt(o, op_id);
      var magnitude = share.jiff.helpers.magnitude(share.jiff.decimal_digits);
      return result.legacy.cmult(magnitude);
    };
    share.slteq = function (o, op_id) {
      var result = share.legacy.slteq(o, op_id);
      var magnitude = share.jiff.helpers.magnitude(share.jiff.decimal_digits);
      return result.legacy.cmult(magnitude);
    };
    share.sgt = function (o, op_id) {
      var result = share.legacy.sgt(o, op_id);
      var magnitude = share.jiff.helpers.magnitude(share.jiff.decimal_digits);
      return result.legacy.cmult(magnitude);
    };
    share.sgteq = function (o, op_id) {
      var result = share.legacy.sgteq(o, op_id);
      var magnitude = share.jiff.helpers.magnitude(share.jiff.decimal_digits);
      return result.legacy.cmult(magnitude);
    };
    share.seq = function (o, op_id) {
      var result = share.legacy.seq(o, op_id);
      var magnitude = share.jiff.helpers.magnitude(share.jiff.decimal_digits);
      return result.legacy.cmult(magnitude);
    };
    share.sneq = function (o, op_id) {
      var result = share.legacy.sneq(o, op_id);
      var magnitude = share.jiff.helpers.magnitude(share.jiff.decimal_digits);
      return result.legacy.cmult(magnitude);
    };

    // Constant Comparisons
    share.clt = function (cst, op_id) {
      if (!(share.isConstant(cst))) {
        throw 'parameter should be a number (<)';
      }

      var magnitude = share.jiff.helpers.magnitude(share.jiff.decimal_digits);
      cst = share.jiff.helpers.BigNumber(cst);
      cst = share_helpers['floor'](share_helpers['*'](cst, magnitude));

      var result = share.legacy.clt(cst, op_id);
      return result.legacy.cmult(magnitude);
    };
    share.clteq = function (cst, op_id) {
      if (!(share.isConstant(cst))) {
        throw 'parameter should be a number (<=)';
      }

      var magnitude = share.jiff.helpers.magnitude(share.jiff.decimal_digits);
      cst = share.jiff.helpers.BigNumber(cst);
      cst = share_helpers['floor'](share_helpers['*'](cst, magnitude));

      var result = share.legacy.clteq(cst, op_id);
      return result.legacy.cmult(magnitude);
    };
    share.cgt = function (cst, op_id) {
      if (!(share.isConstant(cst))) {
        throw 'parameter should be a number (>)';
      }

      var magnitude = share.jiff.helpers.magnitude(share.jiff.decimal_digits);
      cst = share.jiff.helpers.BigNumber(cst);
      cst = share_helpers['floor'](share_helpers['*'](cst, magnitude));

      var result = share.legacy.cgt(cst, op_id);
      return result.legacy.cmult(magnitude);
    };
    share.cgteq = function (cst, op_id) {
      if (!(share.isConstant(cst))) {
        throw 'parameter should be a number (>=)';
      }

      var magnitude = share.jiff.helpers.magnitude(share.jiff.decimal_digits);
      cst = share.jiff.helpers.BigNumber(cst);
      cst = share_helpers['floor'](share_helpers['*'](cst, magnitude));

      var result = share.legacy.cgteq(cst, op_id);
      return result.legacy.cmult(magnitude);
    };
    share.ceq = function (cst, op_id) {
      if (!(share.isConstant(cst))) {
        throw 'parameter should be a number (=)';
      }

      var magnitude = share.jiff.helpers.magnitude(share.jiff.decimal_digits);
      cst = share.jiff.helpers.BigNumber(cst);
      cst = share_helpers['floor'](share_helpers['*'](cst, magnitude));

      var result = share.legacy.ceq(cst, op_id);
      return result.legacy.cmult(magnitude);
    };
    share.cneq = function (cst, op_id) {
      if (!(share.isConstant(cst))) {
        throw 'parameter should be a number (!=)';
      }

      var magnitude = share.jiff.helpers.magnitude(share.jiff.decimal_digits);
      cst = share.jiff.helpers.BigNumber(cst);
      cst = share_helpers['floor'](share_helpers['*'](cst, magnitude));

      var result = share.legacy.cneq(cst, op_id);
      return result.legacy.cmult(magnitude);
    };

    // Fixedpoint division
    share.sdiv = function (o, l, op_id) {
      if (!(o.jiff === share.jiff)) {
        throw 'shares do not belong to the same instance (!=)';
      }
      if (!share.jiff.helpers.Zp_equals(share, o)) {
        throw 'shares must belong to the same field (!=)';
      }
      if (!share.jiff.helpers.array_equals(share.holders, o.holders)) {
        throw 'shares must be held by the same parties (!=)';
      }

      var magnitude = share.jiff.helpers.magnitude(share.jiff.decimal_digits);
      var increased = share.cmult(magnitude);

      if (l != null) {
        l = l + share_helpers['ceil'](share.jiff.helpers.bLog(magnitude));
      }
      return increased.legacy.sdiv(o, l, op_id);
    };
    share.cdiv = function (cst, op_id) {
      if (!(share.isConstant(cst))) {
        throw 'parameter should be a number (/)';
      }

      var magnitude = share.jiff.helpers.magnitude(share.jiff.decimal_digits);
      cst = share.jiff.helpers.BigNumber(cst);
      cst = share_helpers['floor'](share_helpers['*'](cst, magnitude));

      var increased = share.legacy.cmult(magnitude);
      return increased.legacy.cdiv(cst, op_id);
    };

    return share;
  }

  // Take the jiff-client base instance and options for this module, and use them
  // to construct an instance for this module.
  function make_jiff(base_instance, options) {
    if (base_instance.modules.indexOf('bignumber') === -1) {
      throw 'Fixedpoint extension must be applied on top of bignumber extension.';
    }

    /*
     * PARSE OPTIONS
     */
    if (options == null) {
      options = {};
    }
    if (options.Zp != null) {
      base_instance.Zp = options.Zp;
    }

    base_instance.total_digits = Math.floor(base_instance.helpers.bLog(base_instance.Zp, 10));
    if (options.decimal_digits == null && options.integer_digits == null) {
      options.decimal_digits = Math.floor(base_instance.total_digits / 3);
      options.integer_digits = Math.floor(base_instance.total_digits / 3);
    } else if (options.decimal_digits == null) {
      options.decimal_digits = Math.floor((base_instance.total_digits - options.integer_digits) / 2);
    } else if (options.integer_digits == null) {
      options.integer_digits = base_instance.total_digits - 2 * options.decimal_digits;
    }

    base_instance.decimal_digits = options.decimal_digits;
    base_instance.integer_digits = options.integer_digits;
    base_instance.free_digits = base_instance.total_digits - base_instance.decimal_digits - base_instance.integer_digits;
    if (base_instance.free_digits < 0 || base_instance.decimal_digits < 0 || base_instance.integer_digits < 0) {
      throw 'Fixedpoint: Zp is not large enough to fit integer and decimal parts size'
    }

    /*
     * ADD MODULE NAME
     */
    base_instance.modules.push('fixedpoint');

    /* HELPERS */
    base_instance.helpers.magnitude = function (m) {
      return base_instance.helpers.BigNumber(10).pow(m).floor();
    };
    base_instance.helpers.fits_in_digits = function (num) {
      var magnitude = base_instance.helpers.magnitude(base_instance.decimal_digits + base_instance.integer_digits);
      return num.lt(magnitude);
    };
    base_instance.helpers.format_as_float = function (v) {
      // var max_value = base_instance.helpers.magnitude(base_instance.decimal_digits + base_instance.integer_digits);
      // if(v.gte(max_value)) throw "Fixedpoint: open result is not accurate: integer part grew too big.";
      var magnitude = base_instance.helpers.magnitude(base_instance.decimal_digits);
      return v.div(magnitude);
    };
    base_instance.helpers.format_as_fixed = function (v) {
      if (!base_instance.helpers.fits_in_digits(v)) {
        throw 'Fixedpoint share: integer part is too big';
      }
      var magnitude = base_instance.helpers.magnitude(base_instance.decimal_digits);
      return magnitude.times(v).floor();
    };

    // Speed up calculating certain popular inverses by precomputing
    var stored_magnitude = base_instance.helpers.magnitude(base_instance.decimal_digits);
    var stored_maginv = base_instance.helpers.extended_gcd(stored_magnitude, base_instance.Zp);
    var old_extended_gcd = base_instance.helpers.extended_gcd;
    base_instance.helpers.extended_gcd = function (a, b) {
      if (stored_magnitude.eq(a) && base_instance.Zp.eq(b)) {
        return stored_maginv;
      }
      return old_extended_gcd(a, b);
    }

    /* OPEN */
    var old_open = base_instance.open;
    base_instance.open = function (share, parties, op_ids) {
      var promise = old_open(share, parties, op_ids);
      if (promise == null) {
        return null;
      }
      return promise.then(base_instance.helpers.format_as_float);
    };
    var old_receive_open = base_instance.receive_open;
    base_instance.receive_open = function (parties, threshold, Zp, op_ids) {
      var promise = old_receive_open(parties, threshold, Zp, op_ids);
      return promise.then(base_instance.helpers.format_as_float);
    };

    /* HOOKS */
    base_instance.hooks.beforeShare.push(function (jiff, secret, threshold, receivers_list, senders_list, Zp) {
      return base_instance.helpers.format_as_fixed(secret);
    });
    base_instance.hooks.createSecretShare.push(createFixedpointSecretShare);

    return base_instance;
  }

  // Expose the functions that consitute the API for this module.
  exports.make_jiff = make_jiff;
}((typeof exports === 'undefined' ? this.jiff_fixedpoint = {} : exports), typeof exports !== 'undefined'));
