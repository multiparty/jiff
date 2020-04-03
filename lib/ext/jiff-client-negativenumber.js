/**
 * This defines a library extension for for negativenumber in JIFF.
 * This wraps and exposes the jiff-client-negativenumber API. Exposed members can be accessed with jiff_negativenumber.&lt;member-name&gt;
 * in browser JS, or by using require('<path>/lib/ext/jiff-client-negativenumber').&lt;member-name&gt; as usual in nodejs.
 * @namespace jiff_negativenumber
 * @version 1.0
 *
 * FEATURES: supports all of the regular JIFF API.
 * COMPOSITION: composes with bignumber and fixedpoint extensions.
 *
 */

(function (exports, node) {
  /**
   * The name of this extension: 'negativenumber'
   * @type {string}
   * @memberOf jiff_negativenumber
   */
  exports.name = 'negativenumber';

  // secret share implementation
  function createNegativeNumberSecretShare(jiff, share) {
    var hasBigNumber = jiff.has_extension('bignumber');
    var hasFixedPoint = jiff.has_extension('fixedpoint');
    var offset = share.jiff.offset;

    // Keep a copy of the previous implementation of changed primitives
    share.negative_legacy = {};
    var internals = ['cadd', 'csub', 'cmult',
      'sadd', 'ssub', 'smult', 'smult_bgw',
      'cdivfac', 'cdiv', 'sdiv', 'smod',
      'cxor_bit', 'sxor_bit', 'cor_bit', 'sor_bit', 'not',
      'slt', 'slteq', 'sgt', 'sgteq', 'seq', 'sneq',
      'clt', 'clteq', 'cgt', 'cgteq', 'ceq', 'cneq',
      'lt_halfprime', 'if_else', 'cpow' ];
    for (var i = 0; i < internals.length; i++) {
      var key = internals[i];
      share.negative_legacy[key] = share[key].bind(share);
    }

    // Constant arithmetic and boolean operations
    share.cmult = function (cst, op_id, div) {
      if (op_id == null) {
        op_id = share.jiff.counters.gen_op_id('cmult', share.holders);
      }

      var result = share.negative_legacy.cmult(cst, op_id, div);
      if (hasFixedPoint) {
        return result;
      }
      // Works for regular and bigNumbers
      result = result.negative_legacy.csub(jiff.share_helpers['*'](offset, cst));
      return result.negative_legacy.cadd(offset);
    };

    // Secret arithmetic operations
    share.sadd = function (o) {
      var result = share.negative_legacy.sadd(o);
      return result.negative_legacy.csub(offset);
    };
    share.ssub = function (o) {
      // The offset will cancel with the normal ssub, so we add it back on
      var result = share.negative_legacy.ssub(o);
      return result.negative_legacy.cadd(offset);
    };
    share.smult = function (o, op_id, div) {
      if (op_id == null) {
        op_id = share.jiff.counters.gen_op_id('smult', share.holders);
      }

      var result;
      if (hasFixedPoint) {
        // Regular multiplication
        // Result: x*y*mag^2 + x*offset*mag^2 + y*offset*mag^2 + offset^2*mag^2
        result = share.negative_legacy.smult(o, op_id, div);
      } else {
        result = share.negative_legacy.csub(offset);
        o = o.negative_legacy.csub(offset);
        result = result.negative_legacy.smult(o, op_id);
        result = result.negative_legacy.cadd(offset);
      }
      return result;
    };
    share.smult_bgw = function (o, op_id, reshare, div) {
      if (op_id == null) {
        op_id = share.jiff.counters.gen_op_id('smult_bgw', share.holders);
      }

      var result;
      if (hasFixedPoint) {
        // Regular multiplication
        // Result: x*y*mag^2 + x*offset*mag^2 + y*offset*mag^2 + offset^2*mag^2
        result = share.negative_legacy.smult_bgw(o, op_id, reshare, div);
      } else {
        result = share.negative_legacy.csub(offset);
        o = o.negative_legacy.csub(offset);
        result = result.negative_legacy.smult_bgw(o, op_id, reshare);
        result = result.negative_legacy.cadd(offset);
      }
      return result;
    };

    // bit operations
    share.cxor_bit = function (cst) {
      var result = share.negative_legacy.csub(offset);
      result = result.negative_legacy.cxor_bit(cst);
      return result.negative_legacy.cadd(offset);
    };
    share.cor_bit = function (cst_bit) {
      var result = share.negative_legacy.csub(offset);
      result = result.negative_legacy.cor_bit(cst_bit);
      return result.negative_legacy.cadd(offset);
    };
    // secret boolean operations
    share.sxor_bit = function (o, op_id) {
      if (op_id == null) {
        op_id = share.jiff.counters.gen_op_id('sxor_bit', share.holders);
      }

      var result = share.negative_legacy.csub(offset);
      o = o.negative_legacy.csub(offset);
      result = result.negative_legacy.sxor_bit(o, op_id);
      return result.negative_legacy.cadd(offset);
    };
    share.sor_bit = function (o, op_id) {
      if (op_id == null) {
        op_id = share.jiff.counters.gen_op_id('sor_bit', share.holders);
      }

      var result = share.negative_legacy.csub(offset);
      o = o.negative_legacy.csub(offset);
      result = result.negative_legacy.sor_bit(o, op_id);
      return result.negative_legacy.cadd(offset);
    };
    // not operator
    share.not = function () {
      var reduced = share.negative_legacy.csub(offset);
      reduced = reduced.icmult(-1).negative_legacy.cadd(1);
      return reduced.negative_legacy.cadd(offset);
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
            arguments[0] = jiff.share_helpers['+'](offset, arguments[0]);
          }
          var result = share.negative_legacy[key].apply(share, arguments);
          return result.negative_legacy.cadd(offset);
        };
      })(key, i);
    }

    // Divisions will utilize this function to reduce the underlying representation
    // of shares that are known to be whole non-negative numbers to the base representation
    // so that they are compatible with base legacy operations.
    function reduce_representation(share) {
      share = share.negative_legacy.csub(offset);
      if (hasFixedPoint) {
        var magnitude = share.jiff.helpers.magnitude(share.jiff.decimal_digits);
        share = share.negative_legacy.cdivfac(magnitude);
      }
      return share;
    }

    // Divisions
    share.cdivfac = function (cst, op_id) {
      if (!(share.isConstant(cst))) {
        throw new Error('Parameter should be a number (cdivfac)');
      }
      if (op_id == null) {
        op_id = share.jiff.counters.gen_op_id('cdivfac', share.holders);
      }

      // Absolute value of share and cst
      var shareAbs = share.iabs(op_id + ':abs', true);
      var selfNegative = shareAbs.isNegative;
      shareAbs = shareAbs.result.negative_legacy.csub(offset);

      cst = hasBigNumber ? share.jiff.helpers.BigNumber(cst) : cst;
      var otherNegative = jiff.share_helpers['<'](cst, 0);
      cst = jiff.share_helpers['abs'](cst);

      // This is the result assuming both share and o are non-negative
      var result = shareAbs.negative_legacy.cdivfac(cst);

      // For efficiency, since we know that selfNegative is a bit (i.e. non-negative integer)
      // reduce selfNegative to base representation (either 0 or 1 without offset or magnitude)
      // then use it to correct the sign of the result.
      selfNegative = reduce_representation(selfNegative);
      var signUnit = selfNegative.icmult(-2).icadd(1); // if negative this is -1, if positive this is 1

      // o is positive
      if (!otherNegative) { // only need to correct for if share is negative
        result = result.ismult(signUnit, op_id + ':cor1');
      } else { // o is negative, correct if share is positive
        result = result.ismult(signUnit.icmult(-1), op_id + ':cor1');
      }
      return result.negative_legacy.cadd(offset);
    };
    share.cdiv = function (cst, op_id, floor_down) {
      if (!(share.isConstant(cst))) {
        throw new Error('Parameter should be a number (cdiv)');
      }
      if (op_id == null) {
        op_id = share.jiff.counters.gen_op_id('cdiv', share.holders);
      }

      // Absolute value of share and cst
      var shareAbs = share.iabs(op_id + ':abs', true);
      var selfNegative = shareAbs.isNegative;
      shareAbs = shareAbs.result.negative_legacy.csub(offset);

      cst = hasBigNumber ? share.jiff.helpers.BigNumber(cst) : cst;
      var otherNegative = jiff.share_helpers['<'](cst, 0);
      var cstAbs = jiff.share_helpers['abs'](cst);

      // This is the result assuming both share and o are non-negative
      var resultAbs = shareAbs.negative_legacy.cdiv(cstAbs, op_id + ':cdiv');

      // Sign correction
      selfNegative = reduce_representation(selfNegative);
      var signUnit = selfNegative.icmult(-2).icadd(1); // if negative this is -1, if positive this is 1
      var result;
      if (!otherNegative) { // only need to correct for if share is negative
        result = resultAbs.ismult(signUnit, op_id + ':cor1');
      } else {
        result = resultAbs.ismult(signUnit.icmult(-1), op_id + ':cor1');
      }
      result = result.negative_legacy.cadd(offset);

      // Floor correction
      if (floor_down === false) { // Round to zero
        return result;
      } else { // Round down
        var magnitude = hasFixedPoint ? share.jiff.helpers.magnitude(share.jiff.decimal_digits) : 1;
        magnitude = cstAbs.toString().indexOf('.') > -1 ? magnitude : 1;
        magnitude = hasBigNumber ? share.jiff.helpers.BigNumber(magnitude) : magnitude;
        cstAbs = jiff.share_helpers['floor'](jiff.share_helpers['*'](magnitude, cstAbs));

        var need_round = resultAbs.icmult(cstAbs).isneq(shareAbs.icmult(magnitude), op_id + ':floor:sneq');
        var xorNegative = selfNegative.icxor_bit(otherNegative ? 1 : 0);

        // we must correct if (1) need rounding (i.e. cst does not divide share) (2) xorNegative (i.e. result is negative)
        var and = need_round.ismult(xorNegative, op_id+':floor:and');
        return result.issub(and);
      }
    };
    share.smod = function (o, l, op_id) {
      if (op_id == null) {
        op_id = share.jiff.counters.gen_op_id('smod', share.holders);
      }

      // Absolute value of share and o
      var shareAbs = share.iabs(op_id+':abs1', true);
      var negative = shareAbs.isNegative;
      shareAbs = shareAbs.result.negative_legacy.csub(offset);
      var oAbs = o.iabs(op_id+':abs2').negative_legacy.csub(offset);

      // |share| % |o|
      var result = shareAbs.negative_legacy.smod(oAbs, l, op_id + ':smod');
      negative = reduce_representation(negative);

      // Sign correction
      negative = negative.icmult(-2).icadd(1); // if negative = -1, else = 1
      result = result.ismult(negative, op_id+':smult');
      return result.negative_legacy.cadd(offset);
    };
    share.sdiv = function (o, l, op_id, floor_down) {
      if (op_id == null) {
        op_id = share.jiff.counters.gen_op_id('sdiv', share.holders);
      }

      // Absolute value of share and o
      var shareAbs = share.iabs(op_id + ':abs1', true);
      var selfNegative = shareAbs.isNegative;
      shareAbs = shareAbs.result.negative_legacy.csub(offset);

      var otherAbs = o.iabs(op_id + ':abs2', true);
      var otherNegative = otherAbs.isNegative;
      otherAbs = otherAbs.result.negative_legacy.csub(offset);

      // This is the result assuming both share and o are non-negative
      var resultAbs = shareAbs.negative_legacy.sdiv(otherAbs, l, op_id + ':sdiv');

      // Sign correction: if either share or o are negative but not both.
      selfNegative = reduce_representation(selfNegative);
      otherNegative = reduce_representation(otherNegative);
      var xorNegative = selfNegative.isxor_bit(otherNegative, op_id + ':sxor');
      var sign = xorNegative.icmult(-2).icadd(1); // if negative = -1, else = 1
      var result = resultAbs.ismult(sign, op_id + ':cor1');
      result = result.negative_legacy.cadd(offset);

      // Floor correction
      if (floor_down === false) { // Round to zero
        return result;
      } else { // Round down
        var magnitude = hasFixedPoint ? share.jiff.helpers.magnitude(share.jiff.decimal_digits) : 1;
        var need_round = resultAbs.ismult(otherAbs, op_id+':floor:smult').isneq(shareAbs.icmult(magnitude), op_id+':floor:sneq');

        // we must correct if (1) need rounding (i.e. cst does not divide share) (2) xorNegative (i.e. result is negative)
        var and = xorNegative.ismult(need_round, op_id + ':floor:and');
        return result.issub(and);
      }
    };

    // New Operations
    // absolute value
    share.abs = function (op_id, return_intermediate) {
      if (op_id == null) {
        op_id = share.jiff.counters.gen_op_id('abs', share.holders);
      }

      var _offset = offset;
      if (hasFixedPoint) {
        var magnitude = share.jiff.helpers.magnitude(share.jiff.decimal_digits);
        _offset = jiff.share_helpers['*'](magnitude, _offset);
      }

      var isNegative = share.iclt(_offset, op_id + ':clt'); // 0 or 1, no offset or magnitude
      var correction = share.icsub(_offset).icmult(2);
      var result = share.issub(correction.ismult(isNegative, op_id + ':smult'));

      if (return_intermediate === true) {
        if (hasFixedPoint) {
          isNegative = isNegative.icmult(share.jiff.helpers.magnitude(share.jiff.decimal_digits));
        }
        return { result: result, isNegative: isNegative.icadd(_offset) };
      } else {
        return result;
      }
    };
    share.iabs = share.abs;

    // optimized if_else
    share.if_else = function (val1, val2, op_id) {
      if (share.isConstant(val1)) {
        val1 = jiff.share_helpers['+'](offset, val1);
      }
      if (share.isConstant(val2)) {
        val2 = jiff.share_helpers['+'](offset, val2);
      }

      var reduce_share = share.negative_legacy.csub(offset);
      return reduce_share.negative_legacy.if_else(val1, val2, op_id);
    };

    // cpow
    share.cpow = function (cst, op_id) {
      throw new Error('.cpow() is unsupported in the negativeNumber extension');
    };

    return share;
  }

  // Take the jiff-client base instance and options for this extension, and use them
  // to construct an instance for this extension.
  function make_jiff(base_instance, options) {
    var jiff = base_instance;

    // Parse options
    if (options == null) {
      options = {};
    }

    // Offset 'scales' negative numbers
    jiff.offset = options.offset;
    if (jiff.offset == null) {
      if (jiff.has_extension('fixedpoint')) {
        jiff.offset = jiff.helpers.magnitude(jiff.integer_digits);

        // Sanity Checks
        var maxNoMult = jiff.helpers.magnitude(jiff.integer_digits + jiff.decimal_digits).times(2);
        if (!maxNoMult.lte(jiff.Zp)) {
          var msg = 'Fixedpoint|NegativeNumber: Zp is not large enough to fit given integer and decimal parts with negative numbers. ';
          msg += 'Need Zp >= ' + maxNoMult.toString() + ' to fit parameters.';
          throw msg;
        }
        var maxWithMult = jiff.helpers.magnitude(jiff.integer_digits + 2*jiff.decimal_digits).times(2);
        if (!maxWithMult.lte(jiff.Zp) && !(options.warn === false)) {
          var warnMsg = 'Warning: Fixedpoint|NegativeNumber extension: not enough free_digits to perform secret multiplications/divisions or constant multiplications/divisions against non-integer constants safely. ';
          warnMsg += 'Need Zp >= ' +maxWithMult.toString();
          console.log(warnMsg);
        }
      } else {
        jiff.offset = jiff.share_helpers['floor'](jiff.share_helpers['/'](jiff.Zp, 2));
      }
    }

    var old_open = jiff.open;
    jiff.open = function () {
      var promise = old_open.apply(jiff, arguments);
      if (promise == null) {
        return null;
      } else {
        return promise.then(function (v) {
          return jiff.share_helpers['-'](v, jiff.offset);
        });
      }
    };

    /* SHARE */
    var old_share = jiff.share;
    jiff.share = function (secret, threshold, receivers_list, senders_list, Zp, share_id) {
      if (secret != null) {
        secret = jiff.share_helpers['+'](jiff.offset, secret);
      }
      return old_share(secret, threshold, receivers_list, senders_list, Zp, share_id);
    };

    /* changes to preprocessing */
    var previous_namespace = jiff.extensions[jiff.extensions.indexOf(exports.name)-1];
    var should_floor_down_preprocessing = function (threshold, receivers_list, compute_list, Zp, op_id, params) {
      if (params.floor_down === false) {
        params.ignore = true;
      }
      return params;
    };

    jiff.preprocessing_function_map[exports.name] = {
      abs: [
        { op: 'clt', op_id: ':clt' },
        { op: 'smult', op_id: ':smult' }
      ],
      cdivfac: [
        { op: 'abs', op_id: ':abs', namespace: exports.name },
        { op: 'smult', op_id: ':cor1' }
      ],
      cdiv: [
        { op: 'abs', op_id: ':abs', namespace: exports.name },
        { op: 'cdiv', op_id: ':cdiv', namespace: previous_namespace },
        { op: 'smult', op_id: ':cor1' },
        { op: 'sneq', op_id: ':floor:sneq', handler: should_floor_down_preprocessing },
        { op: 'smult', op_id: ':floor:and', handler: should_floor_down_preprocessing }
      ],
      sdiv: [
        { op: 'abs', op_id: ':abs1', namespace: exports.name },
        { op: 'abs', op_id: ':abs2', namespace: exports.name },
        { op: 'sdiv', op_id: ':sdiv', namespace: previous_namespace },
        { op: 'sxor_bit', op_id: ':sxor' },
        { op: 'smult', op_id: ':cor1' },
        { op: 'smult', op_id: ':floor:smult', handler: should_floor_down_preprocessing },
        { op: 'sneq', op_id: ':floor:sneq', handler: should_floor_down_preprocessing },
        { op: 'smult', op_id: ':floor:and', handler: should_floor_down_preprocessing }
      ],
      smod: [
        { op: 'abs', op_id: ':abs1', namespace: exports.name },
        { op: 'abs', op_id: ':abs2', namespace: exports.name },
        { op: 'smod', op_id: ':smod', namespace: previous_namespace },
        { op: 'smult', op_id: ':smult' }
      ]
    };

    /* HOOKS */
    jiff.hooks.createSecretShare.push(createNegativeNumberSecretShare);

    return jiff;
  }

  // Expose API
  exports.make_jiff = make_jiff;

}((typeof exports === 'undefined' ? this.jiff_negativenumber = {} : exports), typeof exports !== 'undefined'));
