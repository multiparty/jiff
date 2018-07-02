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
      var old_sadd = share.sadd;
      share.sadd = function(o) {
        var result = old_sadd(o);
        return result.cadd(-1 * jiff.offset);
      }

      var old_cmult = share.cmult;
      share.cmult = function(c) {
        var result = old_cmult(c); // c * (x+o)
        var off = jiff.offset;
        var subvar = jiff.helpers.mod(off * c, jiff.Zp); // c * o
        return result.cadd(-1 * subvar).cadd(off);
      }

      var old_sub = share.ssub;
      share.ssub = function(o) {
        // The offset will cancel with the normal ssub, so we add it back on
        var result = old_sub(o);
        return result.cadd(jiff.offset);
      }

      share.smult = function(o, op_id) {
        if (!(o.jiff === share.jiff)) throw "shares do not belong to the same instance (*)";
        if (!share.jiff.helpers.Zp_equals(share, o)) throw "shares must belong to the same field (*)";
        if (!share.jiff.helpers.array_equals(share.holders, o.holders)) throw "shares must be held by the same parties (*)";

        if(op_id == null)
          op_id = share.jiff.counters.gen_op_id("*", share.holders);

        var final_deferred = $.Deferred();
        var final_promise = final_deferred.promise();
        var result = share.jiff.secret_share(share.jiff, false, final_promise, undefined, share.holders, max(share.threshold, o.threshold), share.Zp, "share:"+op_id);

        // Subtract offset from original shares.
        var nshare = share.csub(jiff.offset);
        var no = o.csub(jiff.offset);

        // Get shares of triplets.
        var triplet = jiff.triplet(share.holders, max(share.threshold, o.threshold), share.Zp, op_id+":triplet");

        var a = triplet[0];
        var b = triplet[1];
        var c = triplet[2];

        // d = s - a. e = o - b.
        var d = nshare.isadd(a.icmult(-1));
        var e = no.isadd(b.icmult(-1));

        // Open d and e.
        // The only communication cost.
        var e_promise = share.jiff.internal_open(e, e.holders, op_id+":open1");
        var d_promise = share.jiff.internal_open(d, d.holders, op_id+":open2");
        Promise.all([e_promise, d_promise]).then(function(arr) {
          var e_open = arr[0];
          var d_open = arr[1];

          // result_share = d_open * e_open + d_open * b_share + e_open * a_share + c.
          var t1 = share.jiff.helpers.mod(share_helpers['*'](d_open, e_open), jiff.Zp);
          var t2 = b.icmult(d_open);
          var t3 = a.icmult(e_open);

          // All this happens locally.
          var final_result = t2.icadd(t1);
          final_result = final_result.isadd(t3);
          final_result = final_result.isadd(c).cadd(jiff.offset);

          if(final_result.ready)
            final_deferred.resolve(final_result.value);
          else // Resolve the deferred when ready.
            final_result.promise.then(function () { final_deferred.resolve(final_result.value); });
        });

        return result;
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
