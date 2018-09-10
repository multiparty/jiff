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
  exports.name = 'bignumber';
  // secret share implementation
  function createSecretShare(jiff, share, share_helpers) {
    var hasBigNumber = jiff.has_extension('bignumber');
    var hasFixedPoint = jiff.has_extension('fixedpoint');

    // Keep a copy of the previous implementation of changed primitives
    share.negative_legacy = {};
    var internals = ['cadd', 'csub', 'cmult', 'sadd', 'ssub', 'smult', 'cdivfac', 'cdiv', 'sdiv',
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
      result = result.icsub(offset.times(cst).floor());
      return result.icadd(offset);
    };
    share.cxor_bit = function (cst) {
      var result = share.csub(offset);
      result = result.negative_legacy.cxor_bit(cst);
      return result.negative_legacy.cadd(offset);
    };
    share.cor_bit = function (cst_bit) {
      var result = share.csub(offset);
      result = result.negative_legacy.cor_bit(cst_bit);
      return result.negative_legacy.cadd(offset);
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
        result = share.csub(offset);
        o = o.csub(offset);
        result = result.negative_legacy.smult(o, op_id);
        result = result.cadd(offset);
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
      shareAbs = shareAbs.result.csub(offset);

      if (hasBigNumber) {
        cst = share.jiff.helpers.BigNumber(cst);
      }
      var otherNegative = hasBigNumber ? cst.lt(0) : cst < 0;
      cst = hasBigNumber ? cst.abs() : Math.abs(cst);

      // This is the result assuming both share and o are non-negative
      var result = shareAbs.negative_legacy.cdivfac(cst).cadd(offset);

      // o is non-negative
      if (!otherNegative) {
        // only need to correct for if share is negative
        return result.smult(selfNegative.cmult(-2).cadd(1), op_id + ':cor1');
      } else { // o is negative
        // correct for o
        result = result.cmult(-1);
        // if share is negative, result becomes positive again
        return result.smult(selfNegative.cmult(-2).cadd(1), op_id + ':cor1');
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
      shareAbs = shareAbs.result.csub(offset);

      if (hasBigNumber) {
        cst = share.jiff.helpers.BigNumber(cst);
      }
      var otherNegative = hasBigNumber ? cst.lt(0) : cst < 0;
      var cstAbs = hasBigNumber ? cst.abs() : Math.abs(cst);

      // This is the result assuming both share and o are non-negative
      var result = shareAbs.negative_legacy.cdiv(cstAbs, op_id + ':c/').cadd(offset);

      // o is non-negative
      if (!otherNegative) {
        // only need to correct for if share is negative
        result = result.smult(selfNegative.cmult(-2).cadd(1), op_id + ':cor1');
      } else { // o is negative
        // if share is negative, result remains positive, otherwise it becomes negative
        result = result.smult(selfNegative.cmult(2).cadd(-1), op_id + ':cor1');
      }

      // Round to zero
      if (floor_down === false) {
        return result;
      } else { // Round down
        var need_round = result.cmult(cst).sneq(share, op_id + ':floor:cneq');
        var xorNegative = selfNegative.cxor_bit(otherNegative ? 1 : 0);
        return result.sadd(need_round.smult(xorNegative, op_id + ':floor:&').cmult(-1));
      }
    };

    /**
     * Remainder with two shares (self % o). Behavior is identical to javascript's built in % operator with respect to negative numbers.
     * @method smod
     * @param {SecretShare} o - the modulus to apply
     * @param {number} [l=log_2(self.Zp)] - the maximum bit length of the answer.
     * @param {string} [op_id=auto_gen()] - the operation id which is used to identify this operation.
     * @param {Boolean} [floor_down=false] - true for round down or false for round towards zero.
     * @return {SecretShare} this party's share of the result.
     * @memberof SecretShare
     */
    share.smod = function (o, l, op_id, floor_down) {
      if (op_id == null) {
        op_id = share.jiff.counters.gen_op_id('%', share.holders);
      }
      var quotient;
      if (floor_down == null) {
        quotient = share.sdiv(o, l, op_id+':sdiv', false);
      } else {
        quotient = share.sdiv(o, l, op_id+':sdiv', floor_down);
      }

      var result = share.ssub(quotient.smult(o, op_id+':smult'));

      return result;
    };

    share.sdiv = function (o, l, op_id, floor_down) {
      if (op_id == null) {
        op_id = share.jiff.counters.gen_op_id('/', share.holders);
      }

      var shareAbs = share.abs(op_id + ':abs1', true);
      var selfNegative = shareAbs.isNegative;
      shareAbs = shareAbs.result.csub(offset);

      var otherAbs = o.abs(op_id + ':abs2', true);
      var otherNegative = otherAbs.isNegative;
      otherAbs = otherAbs.result.csub(offset);

      // This is the result assuming both share and o are non-negative
      var result = shareAbs.negative_legacy.sdiv(otherAbs, l, op_id + ':/').cadd(offset);

      // Correct if either share or o are negative but not both.
      var xorNegative = selfNegative.sxor_bit(otherNegative);

      // correct for self
      result = result.smult(xorNegative.cmult(-2).cadd(1), op_id + ':cor1');

      // Round to zero
      if (floor_down === false) {
        return result;
      } else { // Round down
        var need_round = result.smult(o, op_id + ':floor:smult').sneq(share, op_id + ':floor:sgt');
        return result.ssub(need_round.smult(xorNegative, op_id + ':floor:&'));
      }
    };

    // secret boolean operations
    share.sxor_bit = function (o, op_id) {
      var result = share.csub(offset);
      o = o.csub(offset);
      result = result.negative_legacy.sxor_bit(o, op_id);
      return result.cadd(offset);
    };
    share.sor_bit = function (o, op_id) {
      var result = share.csub(offset);
      o = o.csub(offset);
      result = result.negative_legacy.sor_bit(o, op_id);
      return result.cadd(offset);
    };
    share.refresh = function () {
      return share;
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
          if (i > 5 && i < 12) {
            if (!(share.isConstant(arguments[0]))) {
              throw 'Parameter should be a number (' + key + ')';
            }
            arguments[0] = hasBigNumber ? offset.plus(arguments[0]) : (arguments[0] + offset);
          }
          var result = share.negative_legacy[key].apply(share, arguments);
          return result.cadd(offset);
        };
      })(key, i);
    }

    // not operator
    share.not = function () {
      return share.cmult(-1).cadd(1);
    };

    // absolute value
    share.abs = function (op_id, return_intermediate) {
      if (op_id == null) {
        op_id = share.jiff.counters.gen_op_id('abs', share.holders);
      }

      var isNegative = share.negative_legacy.clt(offset, op_id + ':clt'); // 0 or 1, no offset
      var correction = share.csub(offset).negative_legacy.cmult(2);
      var result = share.negative_legacy.ssub(correction.negative_legacy.smult(isNegative, op_id + ':smult'));

      if (return_intermediate === true) {
        return { result: result, isNegative: isNegative.cadd(offset) };
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
        // TODO check number of free bits
        jiff.offset = jiff.helpers.magnitude(jiff.integer_digits + jiff.decimal_digits).minus(1).div(jiff.helpers.magnitude(jiff.decimal_digits));
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
