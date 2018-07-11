/**
 * This defines a library module for for negativenumber in JIFF.
 * This wraps and exposes the jiff-client-negativenumber API. Exposed members can be accessed with jiff_negativenumber.&lt;member-name&gt;
 * in browser JS, or by using require('./modules/jiff-client-negativenumber').&lt;member-name&gt; as usual in nodejs.
 * @namespace jiff_negativenumber
 * @version 1.0
 *
 * FEATURES: supports all of the regular JIFF API.
 * COMPOSITION: composes with bignumber and fixedpoint extensions.
 * 
 */

(function(exports, node) {
    /** Return the maximum of two numbers */
    function max(x, y) {
      return x > y ? x : y;
    }

    // secret share implementation
    function createSecretShare(jiff, share, share_helpers) {
      // Keep a copy of the previous implementation of changed primitives
      share.legacy = {};
      var internals = [ "cmult", "sadd", "ssub", "smult", "cdivfac", "cdiv", "sdiv",
                        "cxor_bit", "sxor_bit", "cor_bit", "sor_bit" ];
      for(var i = 0; i < internals.length; i++) {
        var key = internals[i];
        share.legacy[key] = share[key];
      }

      var offset = share.jiff.offset;

      // Constant arithmetic and boolean operations
      share.cmult = function(cst) {
        var result = share.csub(offset);
        result = result.legacy.cmult(cst);
        return result.cadd(offset);
      }
      share.cxor_bit = function(cst) {
        var result = share.csub(offset);
        result = result.legacy.cxor_bit(cst);
        return result.cadd(offset);
      }
      share.cor_bit = function(cst_bit) {
        var result = share.csub(offset);
        result = result.legacy.cor_bit(cst_bit);
        return result.cadd(offset);
      }

      // Secret arithmetic operations
      share.sadd = function(o) {
        var result = share.legacy.sadd(o);
        return result.csub(offset);
      }
      share.ssub = function(o) {
        // The offset will cancel with the normal ssub, so we add it back on
        var result = share.legacy.ssub(o);
        return result.cadd(offset);
      }
      share.smult = function(o, op_id) {
        var result = share.csub(offset);
        o = o.csub(offset);
        result = result.legacy.smult(o, op_id);
        return result.cadd(offset);
      };

      // Divisions
      share.cdivfac = function(cst, op_id) {
        if (!(share.isConstant(cst))) {
          throw 'Parameter should be a number (cdivfac)';
        }

        var shareAbs = share.abs(op_id, true);
        var selfNegative = shareAbs.isNegative;
        shareAbs = shareAbs.result.csub(offset);

        var otherNegative = cst < 0;
        cst = Math.abs(cst);

        // This is the result assuming both share and o are non-negative
        var result = shareAbs.legacy.cdivfac(cst).cadd(offset);
        
        // o is non-negative
        if(!otherNegative) {
          // only need to correct for if share is negative
          return result.smult(selfNegative.cmult(-2).cadd(1), op_id+":cor1");
        }
        // o is negative
        else {
          // correct for o
          result = result.cmult(-1);
          // if share is negative, result becomes positive again
          return result.smult(selfNegative.cmult(-2).cadd(1), op_id+":cor1");
        }
      };
      share.cdiv = function(cst, op_id, floor_down) {
        if (!(share.isConstant(cst))) {
          throw 'Parameter should be a number (cdiv)';
        }        

        if (op_id == null) {
          op_id = share.jiff.counters.gen_op_id('c/', share.holders);
        }

        var shareAbs = share.abs(op_id+":abs", true);
        var selfNegative = shareAbs.isNegative;
        shareAbs = shareAbs.result.csub(offset);

        var otherNegative = cst < 0;
        var cstAbs = Math.abs(cst);

        // This is the result assuming both share and o are non-negative
        var result = shareAbs.legacy.cdiv(cstAbs, op_id+":c/").cadd(offset);

        // o is non-negative
        if(!otherNegative) {
          // only need to correct for if share is negative
          result = result.smult(selfNegative.cmult(-2).cadd(1), op_id+":cor1");
        }
        // o is negative
        else {
          // if share is negative, result remains positive, otherwise it becomes negative
          result = result.smult(selfNegative.cmult(2).cadd(-1), op_id+":cor1");
        }

        // Round to zero
        if(floor_down === false) {
          return result;
        }
        // Round down
        else {
          var need_round = result.cmult(cst).sneq(share, op_id+":floor:cneq");
          var xorNegative = selfNegative.cxor_bit(otherNegative ? 1 : 0);
          return result.sadd(need_round.smult(xorNegative, op_id+":floor:&").cmult(-1));
        }
      };
      share.sdiv = function(o, l, op_id, floor_down) {
        if (op_id == null) {
          op_id = share.jiff.counters.gen_op_id('/', share.holders);
        }

        var shareAbs = share.abs(op_id+":abs1", true);
        var selfNegative = shareAbs.isNegative;
        shareAbs = shareAbs.result.csub(offset);

        var otherAbs = o.abs(op_id+":abs2", true)
        var otherNegative = otherAbs.isNegative;
        otherAbs = otherAbs.result.csub(offset);

        // This is the result assuming both share and o are non-negative
        var result = shareAbs.legacy.sdiv(otherAbs, l, op_id+":/").cadd(offset);

        // Correct if either share or o are negative but not both.
        var xorNegative = selfNegative.sxor_bit(otherNegative);

        // correct for self
        result = result.smult(xorNegative.cmult(-2).cadd(1), op_id+":cor1");

        // Round to zero
        if(floor_down === false) {
          return result;
        }
        // Round down
        else {
          var need_round = result.smult(o, op_id+":floor:smult").sneq(share, op_id+":floor:sgt");
          return result.ssub(need_round.smult(xorNegative, op_id+":floor:&"));
        }
      };

      // secret boolean operations
      share.sxor_bit = function(o, op_id) {
        var result = share.csub(offset);
        o = o.csub(offset);
        result = result.legacy.sxor_bit(o, op_id);
        return result.cadd(offset);
      };
      share.sor_bit = function(o, op_id) {
        var result = share.csub(offset);
        o = o.csub(offset);
        result = result.legacy.sor_bit(o, op_id);
        return result.cadd(offset);
      };

      // secret and constant comparisons
      var comparisons = [ "slt", "slteq", "sgt", "sgteq", "seq", "sneq",
                          "clt", "clteq", "cgt", "cgteq", "ceq", "cneq", 
                          "lt_halfprime" ];
      for(var i = 0; i < comparisons.length; i++) {
        var key = comparisons[i];
        share.legacy[key] = share[key];
        share[key] = (function(key, i) {
          return function() {
            if (i > 5 && i < 12) {
              if (!(share.isConstant(arguments[0]))) {
                throw 'Parameter should be a number (' + key + ')';
              }
              arguments[0] = arguments[0] + offset;
            }
            var result = share.legacy[key].apply(share, arguments);
            return result.cadd(offset);
          };
        })(key, i);
      }

      // not operator
      share.not = function() {
        return share.cmult(-1).cadd(1);
      }

      // absolute value
      share.abs = function(op_id, return_intermediate) {
        if (op_id == null) {
          op_id = share.jiff.counters.gen_op_id('abs', share.holders);
        }

        var isNegative = share.legacy.clt(offset, op_id+":clt"); // 0 or 1, no offset
        var correction = share.csub(offset).legacy.cmult(2);
        var result = share.legacy.ssub(correction.legacy.smult(isNegative, op_id+":smult"));

        if(return_intermediate === true) return { "result": result, "isNegative": isNegative.cadd(offset) };
        else return result;
      };

      return share;
    }

    // Take the jiff-client base instance and options for this module, and use them
    // to construct an instance for this module.
    function make_jiff(base_instance, options) {
      var jiff = base_instance;

      // Parse options
      if(options == null) options = {};

      // Offset "scales" negative numbers
      jiff.offset = options.offset;
      if (jiff.offset == null) {
        jiff.offset = Math.floor(jiff.Zp / 2);
      }

      // Add module name
      jiff.modules.push('negativenumber');

      var old_open = jiff.open;
      jiff.open = function(share, parties, op_ids) {
        var promise = old_open(share, parties, op_ids);
        if (promise == null) {
          return null;
        }
        else {
          return promise.then(
            function(v) {
              return v - jiff.offset;
            }
          );
        }
      };

      var old_receive_open = jiff.receive_open;
      jiff.receive_open = function(parties, threshold, Zp, op_ids) {
        var promise = old_receive_open(parties, threshold, Zp, op_ids);
        return promise.then(
          function(v) {
            return v - jiff.offset;
          }
        );
      };

      /* HOOKS */
      jiff.hooks.createSecretShare.push(createSecretShare);
      jiff.hooks.beforeShare.push(
        function(jiff, secret, threshold, receivers_list, senders_list, Zp) {
          return secret + jiff.offset;
        }
      );

      return jiff;
    }

    // Expose the functions that consitute the API for this module.
    exports.make_jiff = make_jiff;

}((typeof exports == 'undefined' ? this.jiff_negativenumber = {} : exports), typeof exports != 'undefined'));
