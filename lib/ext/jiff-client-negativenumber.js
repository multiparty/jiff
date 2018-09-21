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
  function createSecretShare(jiff, share, share_helpers) {
    var hasBigNumber = jiff.has_extension('bignumber');
    var hasFixedPoint = jiff.has_extension('fixedpoint');

    // Keep a copy of the previous implementation of changed primitives
    share.negative_legacy = {};
    var internals = ['cadd', 'csub', 'cmult',
      'sadd', 'ssub', 'smult', 'smult_bgw',
      'cdivfac', 'cdiv', 'sdiv', 'smod',
      'cxor_bit', 'sxor_bit', 'cor_bit', 'sor_bit'];
    for (var i = 0; i < internals.length; i++) {
      var key = internals[i];
      share.negative_legacy[key] = share[key];
    }

    var offset = share.jiff.offset;
    if (hasFixedPoint) {
      offset = share_helpers['*'](share.jiff.offset, share.jiff.helpers.magnitude(share.jiff.decimal_digits));
    }
    share.offset = offset;

    // Constant arithmetic and boolean operations
    share.cmult = function (cst) {
      var result = share.negative_legacy.cmult(cst);
      if (hasFixedPoint) {
        return result;
      }

      // Works for regular and bigNumbers
      result = result.negative_legacy.csub(share_helpers['*'](share.jiff.offset, cst));
      return result.negative_legacy.cadd(share.jiff.offset);
    };
    share.cxor_bit = function (cst) {
      var result = share.negative_legacy.csub(share.jiff.offset);
      result = result.negative_legacy.cxor_bit(cst);
      return result.negative_legacy.cadd(share.jiff.offset);
    };
    share.cor_bit = function (cst_bit) {
      var result = share.negative_legacy.csub(share.jiff.offset);
      result = result.negative_legacy.cor_bit(cst_bit);
      return result.negative_legacy.cadd(share.jiff.offset);
    };

    // Secret arithmetic operations
    share.sadd = function (o) {
      var result = share.negative_legacy.sadd(o);
      return result.icsub(offset);
    };
    share.ssub = function (o) {
      // The offset will cancel with the normal ssub, so we add it back on
      var result = share.negative_legacy.ssub(o);
      return result.icadd(offset);
    };
    share.smult = function (o, op_id) {
      var result;
      if (hasFixedPoint) {
        // Regular multiplication
        // Result: x*y*mag^2 + x*offset*mag^2 + y*offset*mag^2 + offset^2*mag^2
        result = share.negative_legacy.smult(o, op_id);
      } else {
        result = share.negative_legacy.csub(offset);
        o = o.negative_legacy.csub(offset);
        result = result.negative_legacy.smult(o, op_id);
        result = result.negative_legacy.cadd(offset);
      }
      return result;
    };
    share.smult_bgw = function (o, op_id) {
      var result;
      if (hasFixedPoint) {
        // Regular multiplication
        // Result: x*y*mag^2 + x*offset*mag^2 + y*offset*mag^2 + offset^2*mag^2
        result = share.negative_legacy.smult_bgw(o, op_id);
      } else {
        result = share.negative_legacy.csub(offset);
        o = o.negative_legacy.csub(offset);
        result = result.negative_legacy.smult_bgw(o, op_id);
        result = result.negative_legacy.cadd(offset);
      }
      return result;
    };

    // Divisions
    share.cdivfac = function (cst, op_id) {
      if (!(share.isConstant(cst))) {
        throw 'Parameter should be a number (cdivfac)';
      }

      var shareAbs = share.abs(op_id, true);
      var selfNegative = shareAbs.isNegative;
      shareAbs = shareAbs.result.negative_legacy.csub(share.jiff.offset);

      cst = hasBigNumber ? share.jiff.helpers.BigNumber(cst) : cst;
      var otherNegative = share_helpers['<'](cst, 0);
      cst = share_helpers['abs'](cst);

      // This is the result assuming both share and o are non-negative
      var result = shareAbs.negative_legacy.cdivfac(cst).negative_legacy.cadd(share.jiff.offset);

      // o is non-negative
      if (!otherNegative) {
        // only need to correct for if share is negative
        return result.smult(selfNegative.cmult(-2).negative_legacy.cadd(1), op_id + ':cor1');
      } else { // o is negative
        // correct for o
        result = result.cmult(-1);
        // if share is negative, result becomes positive again
        return result.smult(selfNegative.cmult(-2).negative_legacy.cadd(1), op_id + ':cor1');
      }
    };
    share.cdiv = function (cst, op_id, floor_down) {
      if (!(share.isConstant(cst))) {
        throw 'Parameter should be a number (cdiv)';
      }

      if (op_id == null) {
        op_id = share.jiff.counters.gen_op_id('c/', share.holders);
      }

      var shareAbs = share.abs(op_id + ':abs', true);
      var selfNegative = shareAbs.isNegative;
      shareAbs = shareAbs.result.negative_legacy.csub(share.jiff.offset);

      cst = hasBigNumber ? share.jiff.helpers.BigNumber(cst) : cst;
      var otherNegative = share_helpers['<'](cst, 0);
      var cstAbs = share_helpers['abs'](cst);

      // This is the result assuming both share and o are non-negative
      var result = shareAbs.negative_legacy.cdiv(cstAbs, op_id + ':c/').negative_legacy.cadd(share.jiff.offset);

      // o is non-negative
      if (!otherNegative) {
        // only need to correct for if share is negative
        result = result.smult(selfNegative.cmult(-2).negative_legacy.cadd(1), op_id + ':cor1');
      } else { // o is negative
        // if share is negative, result remains positive, otherwise it becomes negative
        result = result.smult(selfNegative.cmult(2).negative_legacy.cadd(-1), op_id + ':cor1');
      }

      // Round to zero
      if (floor_down === false) {
        return result;
      } else { // Round down
        var need_round = result.cmult(cst).sneq(share, op_id + ':floor:cneq');
        var xorNegative = selfNegative.cxor_bit(otherNegative ? 1 : 0);

        if (hasFixedPoint) {
          var magnitude = share.jiff.helpers.magnitude(share.jiff.decimal_digits);

          xorNegative = xorNegative.negative_legacy.csub(share.jiff.offset).negative_legacy.cdivfac(magnitude);
          need_round = need_round.negative_legacy.csub(share.jiff.offset).negative_legacy.cdivfac(magnitude);
          var and = xorNegative.ismult(need_round, op_id + ':floor:&'); // no offset or magnitude
          return result.issub(and);
        } else {
          return result.ssub(need_round.smult(xorNegative, op_id + ':floor:&'));
        }
      }
    };

    share.smod = function (o, l, op_id) {
      if (op_id == null) {
        op_id = share.jiff.counters.gen_op_id('%', share.holders);
      }

      // Absolute value of share and o
      var shareAbs = share.abs(op_id+':abs1', true);
      var negative = shareAbs.isNegative;
      shareAbs = shareAbs.result.negative_legacy.csub(share.jiff.offset);

      var oAbs = o.abs(op_id+':abs').negative_legacy.csub(o.jiff.offset);

      var result = shareAbs.negative_legacy.smod(oAbs, l, op_id + ':%');

      negative = negative.negative_legacy.csub(share.jiff.offset);
      if (hasFixedPoint) {
        var magnitude = share.jiff.helpers.magnitude(share.jiff.decimal_digits);
        negative =  negative.negative_legacy.cdivfac(magnitude);
      }

      negative = negative.icmult(-2).icadd(1);
      result = result.ismult(negative, op_id+':smult');
      return result.negative_legacy.cadd(share.jiff.offset);
    };

    share.sdiv = function (o, l, op_id, floor_down) {
      if (op_id == null) {
        op_id = share.jiff.counters.gen_op_id('/', share.holders);
      }

      var shareAbs = share.abs(op_id + ':abs1', true);
      var selfNegative = shareAbs.isNegative;
      shareAbs = shareAbs.result.negative_legacy.csub(share.jiff.offset);

      var otherAbs = o.abs(op_id + ':abs2', true);
      var otherNegative = otherAbs.isNegative;
      otherAbs = otherAbs.result.negative_legacy.csub(o.jiff.offset);

      // This is the result assuming both share and o are non-negative
      var result = shareAbs.negative_legacy.sdiv(otherAbs, l, op_id + ':/').negative_legacy.cadd(share.jiff.offset);

      // Correct if either share or o are negative but not both.
      var xorNegative = selfNegative.sxor_bit(otherNegative);

      // correct for self
      result = result.smult(xorNegative.cmult(-2).negative_legacy.cadd(1), op_id + ':cor1');

      // Round to zero
      if (floor_down === false) {
        return result;
      } else { // Round down
        var need_round = result.smult(o, op_id + ':floor:smult').sneq(share, op_id + ':floor:sgt');
        if (hasFixedPoint) {
          var magnitude = share.jiff.helpers.magnitude(share.jiff.decimal_digits);

          xorNegative = xorNegative.negative_legacy.csub(share.jiff.offset).negative_legacy.cdivfac(magnitude);
          need_round = need_round.negative_legacy.csub(share.jiff.offset).negative_legacy.cdivfac(magnitude);
          var and = xorNegative.ismult(need_round, op_id + ':floor:&'); // no offset or magnitude
          return result.issub(and);
        } else {
          return result.ssub(need_round.smult(xorNegative, op_id + ':floor:&'));
        }
      }
    };

    // secret boolean operations
    share.sxor_bit = function (o, op_id) {
      var result = share.negative_legacy.csub(share.jiff.offset);
      o = o.negative_legacy.csub(o.jiff.offset);
      result = result.negative_legacy.sxor_bit(o, op_id);
      return result.negative_legacy.cadd(share.jiff.offset);
    };
    share.sor_bit = function (o, op_id) {
      var result = share.negative_legacy.csub(share.jiff.offset);
      o = o.negative_legacy.csub(o.jiff.offset);
      result = result.negative_legacy.sor_bit(o, op_id);
      return result.negative_legacy.cadd(share.jiff.offset);
    };

    // secret and constant comparisons
    var comparisons = ['slt', 'slteq', 'sgt', 'sgteq', 'seq', 'sneq',
      'clt', 'clteq', 'cgt', 'cgteq', 'ceq', 'cneq',
      'lt_halfprime'];
    for (i = 0; i < comparisons.length; i++) {
      key = comparisons[i];
      share.negative_legacy[key] = share[key];
      share[key] = (function (key, i) {
        return function () {
          if (i > 5) {
            if (!(share.isConstant(arguments[0]))) {
              throw 'Parameter should be a number (' + key + ')';
            }
            arguments[0] = share_helpers['+'](share.jiff.offset, arguments[0]);
          }
          var result = share.negative_legacy[key].apply(share, arguments);
          return result.negative_legacy.cadd(share.jiff.offset);
        };
      })(key, i);
    }

    // not operator
    share.not = function () {
      return share.cmult(-1).negative_legacy.cadd(1);
    };

    // absolute value
    share.abs = function (op_id, return_intermediate) {
      if (op_id == null) {
        op_id = share.jiff.counters.gen_op_id('abs', share.holders);
      }

      var isNegative = share.iclt(offset, op_id + ':clt'); // 0 or 1, no offset or magnitude
      var correction = share.icsub(offset).icmult(2);
      var result = share.issub(correction.ismult(isNegative, op_id + ':smult'));

      if (return_intermediate === true) {
        if (hasFixedPoint) {
          isNegative = isNegative.icmult(share.jiff.helpers.magnitude(share.jiff.decimal_digits));
        }
        return { result: result, isNegative: isNegative.icadd(offset) };
      } else {
        return result;
      }
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
          var warnMsg = 'Fixedpoint|NegativeNumber: Zp is not large enough to perform multiplications safely. ';
          warnMsg += 'Need Zp >= ' +maxWithMult.toString();
          console.log(warnMsg);
        }
      } else if (jiff.has_extension('bignumber')) {
        jiff.offset = jiff.Zp.div(2).floor();
      } else {
        jiff.offset = Math.floor(jiff.Zp / 2);
      }
    }

    var old_open = jiff.open;
    jiff.open = function (share, parties, op_ids) {
      var promise = old_open(share, parties, op_ids);
      if (promise == null) {
        return null;
      } else {
        return promise.then(
          function (v) {
            if (jiff.has_extension('bignumber')) {
              return v.minus(jiff.offset);
            } else {
              return v - jiff.offset;
            }
          }
        );
      }
    };

    var old_receive_open = jiff.receive_open;
    jiff.receive_open = function (parties, threshold, Zp, op_ids) {
      if (Zp == null) {
        Zp = jiff.Zp;
      }
      var promise = old_receive_open(parties, threshold, Zp, op_ids);
      return promise.then(
        function (v) {
          if (jiff.has_extension('bignumber')) {
            return v.mod(Zp).minus(jiff.offset);
          } else {
            return v - jiff.offset;
          }
        }
      );
    };

    /* SHARE */
    var old_share = jiff.share;
    jiff.share = function (secret, threshold, receivers_list, senders_list, Zp, share_id) {
      if (secret != null) {
        if (jiff.has_extension('bignumber')) {
          secret = jiff.offset.plus(secret);
        } else {
          secret = secret + jiff.offset;
        }
      }
      return old_share(secret, threshold, receivers_list, senders_list, Zp, share_id);
    };

    /* HOOKS */
    jiff.hooks.createSecretShare.push(createSecretShare);

    return jiff;
  }

  // Expose API
  exports.make_jiff = make_jiff;

}((typeof exports === 'undefined' ? this.jiff_negativenumber = {} : exports), typeof exports !== 'undefined'));
