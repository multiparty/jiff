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
      var internals = [ "cmult", "sadd", "ssub", "smult",
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
      var old_sadd = share.sadd;
      share.sadd = function(o) {
        var result = old_sadd(o);
        return result.csub(offset);
      }
      var old_sub = share.ssub;
      share.ssub = function(o) {
        // The offset will cancel with the normal ssub, so we add it back on
        var result = old_sub(o);
        return result.cadd(offset);
      }
      share.smult = function(o, op_id) {
        var result = share.csub(offset);
        o = o.csub(offset);
        result = result.legacy.smult(o, op_id);
        return result.cadd(offset);
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
