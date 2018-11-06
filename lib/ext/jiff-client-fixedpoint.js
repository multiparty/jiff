/**
 * This defines a library extension for for fixed point arithmetic in JIFF.
 * This wraps and exposes the jiff_fixedpoint API. Exposed members can be accessed with jiff_fixedpoint.&lt;member-name&gt;
 * in browser JS, or by using require('<path>/lib/ext/jiff-client-fixedpoint').&lt;member-name&gt; as usual in nodejs.
 *
 * @namespace jiff_fixedpoint
 * @version 1.0
 */
(function (exports, node) {
  /**
   * The name of this extension: 'fixedpoint'
   * @type {string}
   * @memberOf jiff_fixedpoint
   */
  exports.name = 'fixedpoint';

  function createFixedpointSecretShare(jiff_instance, share, share_helpers) {
    share.legacy = {};
    var internals = ['cadd', 'csub', 'cmult',
      'sadd', 'ssub', 'smult', 'smult_bgw',
      'cdivfac', 'cdiv', 'sdiv', 'smod',
      'cxor_bit', 'sxor_bit', 'cor_bit', 'sor_bit', 'not',
      'slt', 'slteq', 'sgt', 'sgteq', 'seq', 'sneq',
      'clt', 'clteq', 'cgt', 'cgteq', 'ceq', 'cneq',
      'lt_halfprime', 'if_else' ];
    for (var i = 0; i < internals.length; i++) {
      var key = internals[i];
      share.legacy[key] = share[key];
    }

    var magnitude = share.jiff.helpers.magnitude(share.jiff.decimal_digits);

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
        throw new Error('parameter should be a number (+)');
      }

      cst = share.jiff.helpers.BigNumber(cst);
      cst = share_helpers['floor'](share_helpers['*'](cst, magnitude));
      return share.legacy.cadd(cst);
    };
    share.csub = function (cst) {
      if (!(share.isConstant(cst))) {
        throw new Error('parameter should be a number (-)');
      }

      cst = share.jiff.helpers.BigNumber(cst);
      cst = share_helpers['floor'](share_helpers['*'](cst, magnitude));
      return share.legacy.csub(cst);
    };
    share.cmult = function (cst, op_id, div) {
      if (!(share.isConstant(cst))) {
        throw new Error('parameter should be a number (-)');
      }

      // cst is an integer
      if (cst.toString().indexOf('.') === -1 && div !== false) {
        var tmp = share.legacy.cmult(cst);
        if (share.jiff.has_extension('negativenumber')) {
          tmp = tmp.legacy.csub(magnitude.times(tmp.jiff.offset).times(cst));
          tmp = tmp.legacy.cadd(magnitude.times(tmp.jiff.offset));
        }
        return tmp;
      }

      // cst is a decimal
      cst = share.jiff.helpers.BigNumber(cst);
      cst = share_helpers['floor'](share_helpers['*'](cst, magnitude)); // turn cst to fixedpoint

      // the number here may be too big, before dividing by magnitude, make sure it is small
      var result = share.legacy.cmult(cst);
      if (share.jiff.has_extension(('negativenumber'))) {
        result = result.legacy.csub(magnitude.times(result.jiff.offset).times(cst));
        if (div === false) {
          result = result.legacy.cadd(magnitude.times(result.jiff.offset));
        } else {
          result = result.legacy.cadd(magnitude.times(magnitude).times(result.jiff.offset));
        }
      }

      if (div === false) {
        return result;
      }

      return result.legacy.cdiv(magnitude, op_id);
    };

    share.cdivfac = function (cst) {
      if (!(share.isConstant(cst))) {
        throw new Error('Parameter should be a number (cdivfac)');
      }

      var cstDecimal = cst.toString().indexOf('.') > -1;
      cst = share.jiff.helpers.BigNumber(cst).times(cstDecimal ? magnitude : 1);

      var result = share.legacy.cdivfac(cst);
      if (cstDecimal) {
        return result.legacy.cmult(magnitude);
      }
      return result;
    };

    // secret arithmetic operations
    share.smult = function (o, op_id, div) {
      if (!(o.jiff === share.jiff)) {
        throw new Error('shares do not belong to the same instance (*)');
      }
      if (!share.jiff.helpers.Zp_equals(share, o)) {
        throw new Error('shares must belong to the same field (*)');
      }
      if (!share.jiff.helpers.array_equals(share.holders, o.holders)) {
        throw new Error('shares must be held by the same parties (*)');
      }

      if (op_id == null) {
        op_id = share.jiff.counters.gen_op_id('*', share.holders);
      }

      var result = share.legacy.smult(o, op_id);

      // Negative number composing
      if (share.jiff.has_extension('negativenumber')) {
        var offset = share_helpers['*'](magnitude, share.jiff.offset);

        // Subtract x*offset*mag^2, y*offset*mag^2, offset^2*mag^2
        var subshare1 = share.icsub(offset).icmult(offset);
        var subshare2 = o.icsub(offset).icmult(offset);

        result = result.icsub(offset.pow(2));
        result = result.issub(subshare1).issub(subshare2);

        // Add offset term back on before dividing
        if (div === false) {
          result = result.icadd(offset);
        } else {
          result = result.icadd(offset.times(magnitude));
        }
      }

      if (div === false) {
        return result;
      }
      return result.legacy.cdiv(magnitude, op_id + ':reduce');
    };

    // BGW based secret multiplication
    share.smult_bgw = function (o, op_id, div) {
      if (!(o.jiff === share.jiff)) {
        throw new Error('shares do not belong to the same instance (bgw*)');
      }
      if (!share.jiff.helpers.Zp_equals(share, o)) {
        throw new Error('shares must belong to the same field (bgw*)');
      }
      if (!share.jiff.helpers.array_equals(share.holders, o.holders)) {
        throw new Error('shares must be held by the same parties (bgw*)');
      }

      if (op_id == null) {
        op_id = share.jiff.counters.gen_op_id('bgw*', share.holders);
      }

      var result = share.legacy.smult_bgw(o, op_id);

      // Negative number composing
      if (share.jiff.has_extension('negativenumber')) {
        var offset = share_helpers['*'](magnitude, share.jiff.offset);

        // Subtract x*offset*mag^2, y*offset*mag^2, offset^2*mag^2
        var subshare1 = share.icsub(offset).icmult(offset);
        var subshare2 = o.icsub(offset).icmult(offset);

        result = result.icsub(offset.pow(2));
        result = result.issub(subshare1).issub(subshare2);

        // Add offset term back on before dividing
        if (div === false) {
          result = result.icadd(offset);
        } else {
          result = result.icadd(offset.times(magnitude));
        }
      }

      if (div === false) {
        return result;
      }
      return result.legacy.cdiv(magnitude, op_id + ':reduce');
    };

    share.smod = function (o, l, op_id) {
      if (op_id == null) {
        op_id = share.jiff.counters.gen_op_id('%', share.holders);
      }

      var floorQuotient = share.legacy.sdiv(o, l, op_id+':sdiv');
      return share.legacy.ssub(floorQuotient.legacy.smult(o, op_id+':smult'));
    };

    share.floor = function (o, op_id) {
      if (op_id == null) {
        op_id = share.jiff.counters.gen_op_id('floor', share.holders);
      }

      return share.legacy.cdiv(magnitude, op_id).legacy.cmult(magnitude);
    };

    // boolean operations on BINARY shares
    share.cxor_bit = function (cst) {
      if (!(share.isConstant(cst))) {
        throw new Error('parameter should be a number (^)');
      }
      if (!share_helpers['binary'](cst)) {
        throw new Error('parameter should be binary (^)');
      }

      // share should be both binary integers => our representation of it should be either 0 or 1 * 10^{decimal_digits}
      // In both cases, multiplying by the inverse of 10^{decimal_digits} should be enough to reduce it to either 0 or 1.
      var reduced_share = share.legacy.cdivfac(magnitude);
      var reduced_xor = reduced_share.legacy.cadd(cst).legacy.ssub(reduced_share.legacy.cmult(cst).legacy.cmult(2));
      return reduced_xor.legacy.cmult(magnitude);
    };
    share.cor_bit = function (cst) {
      if (!(share.isConstant(cst))) {
        throw new Error('parameter should be a number (|)');
      }
      if (!share_helpers['binary'](cst)) {
        throw new Error('parameter should be binary (|)');
      }

      // share should be both binary integers => our representation of it should be either 0 or 1 * 10^{decimal_digits}
      // In both cases, multiplying by the inverse of 10^{decimal_digits} should be enough to reduce it to either 0 or 1.
      var reduced_share = share.legacy.cdivfac(magnitude);
      var reduced_xor = reduced_share.legacy.cadd(cst).legacy.ssub(reduced_share.legacy.cmult(cst));
      return reduced_xor.legacy.cmult(magnitude);
    };
    share.sxor_bit = function (o, op_id) {
      if (!(o.jiff === share.jiff)) {
        throw new Error('shares do not belong to the same instance (^)');
      }
      if (!share.jiff.helpers.Zp_equals(share, o)) {
        throw new Error('shares must belong to the same field (^)');
      }
      if (!share.jiff.helpers.array_equals(share.holders, o.holders)) {
        throw new Error('shares must be held by the same parties (^)');
      }

      // share and o should be both binary integers => our representation of them should be either 0 or 1 * 10^{decimal_digits}
      // In both cases, multiplying by the inverse of 10^{decimal_digits} should be enough to reduce it to either 0 or 1.
      var reduced_share = share.legacy.cdivfac(magnitude);
      var reduced_o = o.legacy.cdivfac(magnitude);
      var reduced_xor = reduced_share.legacy.sadd(reduced_o).legacy.ssub(reduced_share.legacy.smult(reduced_o, op_id).legacy.cmult(2));
      return reduced_xor.legacy.cmult(magnitude);
    };
    share.sor_bit = function (o, op_id) {
      if (!(o.jiff === share.jiff)) {
        throw new Error('shares do not belong to the same instance (|)');
      }
      if (!share.jiff.helpers.Zp_equals(share, o)) {
        throw new Error('shares must belong to the same field (|)');
      }
      if (!share.jiff.helpers.array_equals(share.holders, o.holders)) {
        throw new Error('shares must be held by the same parties (|)');
      }

      // share and o should be both binary integers => our representation of them should be either 0 or 1 * 10^{decimal_digits}
      // In both cases, multiplying by the inverse of 10^{decimal_digits} should be enough to reduce it to either 0 or 1.
      var reduced_share = share.legacy.cdivfac(magnitude);
      var reduced_o = o.legacy.cdivfac(magnitude);
      var reduced_or = reduced_share.legacy.sadd(reduced_o).legacy.ssub(reduced_share.legacy.smult(reduced_o, op_id));
      return reduced_or.legacy.cmult(magnitude);
    };
    share.not = function () {
      return share.legacy.cmult(-1).legacy.cadd(magnitude);
    };

    // secret and constant comparisons
    var comparisons = [
      'slt', 'slteq', 'sgt', 'sgteq', 'seq', 'sneq',
      'clt', 'clteq', 'cgt', 'cgteq', 'ceq', 'cneq',
      'lt_halfprime'
    ];
    for (i = 0; i < comparisons.length; i++) {
      key = comparisons[i];
      share[key] = (function (key, i) {
        return function () {
          if (i > 5 && i < 12) {
            if (!(share.isConstant(arguments[0]))) {
              throw new Error('Parameter should be a number (' + key + ')');
            }
            arguments[0] = share.jiff.helpers.BigNumber(arguments[0]);
            arguments[0] = share_helpers['floor'](share_helpers['*'](arguments[0], magnitude));
          }
          var result = share.legacy[key].apply(share, arguments);
          return result.legacy.cmult(magnitude);
        };
      })(key, i);
    }

    // Fixedpoint division
    share.sdiv = function (o, l, op_id) {
      if (!(o.jiff === share.jiff)) {
        throw new Error('shares do not belong to the same instance (/)');
      }
      if (!share.jiff.helpers.Zp_equals(share, o)) {
        throw new Error('shares must belong to the same field (/)');
      }
      if (!share.jiff.helpers.array_equals(share.holders, o.holders)) {
        throw new Error('shares must be held by the same parties (/)');
      }

      var increased = share.legacy.cmult(magnitude);

      if (l != null) {
        l = l + share_helpers['ceil'](share.jiff.helpers.bLog(magnitude));
      }
      return increased.legacy.sdiv(o, l, op_id);
    };
    share.cdiv = function (cst, op_id) {
      if (!(share.isConstant(cst))) {
        throw new Error('parameter should be a number (/)');
      }

      // if cst is an integer, do same old constant division
      if (cst.toString().indexOf('.') === -1) {
        return share.legacy.cdiv(cst, op_id);
      }

      cst = share.jiff.helpers.BigNumber(cst);
      cst = share_helpers['floor'](share_helpers['*'](cst, magnitude));

      var increased = share.legacy.cmult(magnitude);
      return increased.legacy.cdiv(cst, op_id);
    };

    // optimized if_else
    share.if_else = function (val1, val2, op_id) {
      if (share.isConstant(val1)) {
        val1 = magnitude.times(val1).floor();
      }
      if (share.isConstant(val2)) {
        val2 = magnitude.times(val2).floor();
      }

      var reduce_share = share.legacy.cdivfac(magnitude);
      return reduce_share.legacy.if_else(val1, val2, op_id);
    };

    return share;
  }

  // Take the jiff-client base instance and options for this extension, and use them
  // to construct an instance for this extension.
  function make_jiff(base_instance, options) {
    if (!base_instance.has_extension('bignumber')) {
      throw new Error('Fixedpoint extension must be applied on top of bignumber extension.');
    }

    if (base_instance.has_extension('negativenumber')) {
      throw new Error('Fixedpoint extension must be applied before negativenumber extension.');
    }

    /*
     * PARSE OPTIONS
     */
    if (options == null) {
      options = {};
    }
    if (options.Zp != null) {
      base_instance.Zp = base_instance.helpers.BigNumber(options.Zp);
    }

    // Determine the digits allocation, produce errors or warnings if not enough digits exists in Zp
    base_instance.total_digits = Math.floor(base_instance.helpers.bLog(base_instance.Zp, 10));
    if (options.decimal_digits == null && options.integer_digits == null) {
      options.decimal_digits = Math.floor(base_instance.total_digits / 3);
      options.integer_digits = Math.floor(base_instance.total_digits / 3);
    } else if (options.decimal_digits == null) {
      options.decimal_digits = Math.floor((base_instance.total_digits - options.integer_digits) / 2);
    } else if (options.integer_digits == null) {
      options.integer_digits = base_instance.total_digits - 2 * options.decimal_digits;
    }

    if (options.free_digits == null) {
      options.free_digits = Math.min(base_instance.total_digits - options.decimal_digits - options.integer_digits, options.decimal_digits);
    }

    base_instance.decimal_digits = options.decimal_digits;
    base_instance.integer_digits = options.integer_digits;
    base_instance.free_digits = options.free_digits;
    if (base_instance.free_digits + base_instance.decimal_digits + base_instance.integer_digits > base_instance.total_digits || base_instance.free_digits < 0) {
      throw new Error('Fixedpoint: Zp is not large enough to fit given integer, decimal, and free parts size');
    }
    if (base_instance.free_digits < options.decimal_digits) {
      if (!(options.warn === false)) {
        console.log('Warning: Fixedpoint extension: not enough free_digits to perform secret multiplications/divisions/mod or constant multiplications/divisions against non-integer constants safely. Need ' + (options.decimal_digits - base_instance.free_digits) + ' more digits in Zp.');
      }
      base_instance.free_digits = 0;
    }

    /* HELPERS */
    base_instance.helpers.magnitude = function (m) {
      return base_instance.helpers.BigNumber(10).pow(m).floor();
    };
    base_instance.helpers.fits_in_digits = function (num) {
      var magnitude = base_instance.helpers.magnitude(base_instance.decimal_digits + base_instance.integer_digits);
      return magnitude.gt(num);
    };
    base_instance.helpers.format_as_float = function (v) {
      /* if (!(options.warn === false)) {
        var max_value = base_instance.helpers.magnitude(base_instance.decimal_digits + base_instance.integer_digits);
        if (v.gte(max_value)) {
          console.log('warning: Fixedpoint extension: open result is not accurate: integer part grew too big.');
        }
      } */
      var magnitude = base_instance.helpers.magnitude(base_instance.decimal_digits);
      return v.div(magnitude);
    };
    base_instance.helpers.format_as_fixed = function (v) {
      if (!base_instance.helpers.fits_in_digits(v)) {
        throw new Error('Fixedpoint share: integer part is too big');
      }
      var magnitude = base_instance.helpers.magnitude(base_instance.decimal_digits);
      return magnitude.times(v).floor();
    };
    base_instance.helpers.to_fixed = function (v) {
      v = base_instance.helpers.BigNumber(v);
      var str = v.toFixed(base_instance.decimal_digits, base_instance.helpers._BigNumber.ROUND_FLOOR);
      return base_instance.helpers.BigNumber(str);

    };

    // Speed up calculating certain popular inverses by pre-computing
    var stored_magnitude = base_instance.helpers.magnitude(base_instance.decimal_digits);
    var stored_maginv = base_instance.helpers.extended_gcd(stored_magnitude, base_instance.Zp);
    var old_extended_gcd = base_instance.helpers.extended_gcd;
    base_instance.helpers.extended_gcd = function (a, b) {
      if (stored_magnitude.eq(a) && base_instance.Zp.eq(b)) {
        return stored_maginv;
      }
      return old_extended_gcd(a, b);
    };

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

    /* SHARE */
    var old_share = base_instance.share;
    base_instance.share = function (secret, threshold, receivers_list, senders_list, Zp, share_id) {
      if (secret != null) {
        secret = base_instance.helpers.format_as_fixed(secret);
      }
      return old_share(secret, threshold, receivers_list, senders_list, Zp, share_id);
    };

    /* HOOKS */
    base_instance.hooks.createSecretShare.push(createFixedpointSecretShare);

    return base_instance;
  }

  // Expose API
  exports.make_jiff = make_jiff;
}((typeof exports === 'undefined' ? this.jiff_fixedpoint = {} : exports), typeof exports !== 'undefined'));
