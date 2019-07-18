/**
 * @namespace jiff_fixedpoint
 * @version 1.0
 */
(function (exports, node) {
  /**
   * The name of this extension: 'multipleshares'
   * @type {string}
   * @memberOf jiff_asynchronousshare
   */
  exports.name = 'asyncshare';

  function Deferred() {
    // Polyfill for jQuery Deferred
    // From https://developer.mozilla.org/en-US/docs/Mozilla/JavaScript_code_modules/Promise.jsm/Deferred
    this.resolve = null;

    /* A method to reject the associated Promise with the value passed.
     * If the promise is already settled it does nothing.
     *
     * @param {anything} reason: The reason for the rejection of the Promise.
     * Generally its an Error object. If however a Promise is passed, then the Promise
     * itself will be the reason for rejection no matter the state of the Promise.
     */
    this.reject = null;

    /* A newly created Promise object.
     * Initially in pending state.
     */
    this.promise = new Promise(function (resolve, reject) {
      this.resolve = resolve;
      this.reject = reject;
    }.bind(this));
    Object.freeze(this);
  }

  // export functions
  function jiff_compute_shares(jiff, secret, parties_list, threshold, Zp, parties_ratios) {
    var shares = {}; // Keeps the shares
    var i;
    // Each player's random polynomial f must have
    // degree threshold - 1, so that threshold many points are needed
    // to interpolate/reconstruct.
    var t = threshold - 1;
    var polynomial = Array(t + 1); // stores the coefficients

    // Each players's random polynomial f must be constructed
    // such that f(0) = secret
    polynomial[0] = secret;

    // Compute the random polynomial f's coefficients
    for (i = 1; i <= t; i++) {
      polynomial[i] = jiff.helpers.random(Zp);
    }
    if (parties_ratios == null) {
      // Compute each players share such that share[i] = f(i)
      for (i = 0; i < parties_list.length; i++) {
        var p_id = parties_list[i];
        shares[p_id] = polynomial[0];
        var power = jiff.helpers.get_party_number(p_id, 0, parties_list.length);

        for (var j = 1; j < polynomial.length; j++) {
          var tmp = jiff.helpers.mod((polynomial[j] * power), Zp);
          shares[p_id] = jiff.helpers.mod((shares[p_id] + tmp), Zp);
          power = jiff.helpers.mod(power * jiff.helpers.get_party_number(p_id, 0, parties_list.length), Zp);
        }
      }
      return shares;
    }

    // Compute each players share such that share[i] = f(i)
    for (i = 0; i < parties_list.length; i++) {
      var p_id = parties_list[i];
      var p_ratio = p_id in parties_ratios ? parties_ratios[p_id] : 1;
      shares[p_id] = [];
      for (var share_num = 0; share_num < p_ratio; share_num++) {
        shares[p_id][share_num] = polynomial[0];
        var power = jiff.helpers.get_party_number(p_id, share_num, parties_list.length);

        for (var j = 1; j < polynomial.length; j++) {
          var tmp = jiff.helpers.mod((polynomial[j] * power), Zp);
          shares[p_id][share_num] = jiff.helpers.mod((shares[p_id][share_num] + tmp), Zp);
          power = jiff.helpers.mod(power * jiff.helpers.get_party_number(p_id, share_num, parties_list.length), Zp);
        }
      }
    }
    return shares;
  }

  function jiff_lagrange(jiff, shares) {
    var lagrange_coeff = []; // will contain shares.length many elements.
    // Compute the Lagrange coefficients at 0.
    for (var i = 0; i < shares.length; i++) {
      for (var share_num = 0; share_num < shares[i].value.length; share_num++) {
        var pi = jiff.helpers.get_party_number(shares[i].sender_id, share_num, jiff.party_count);
        lagrange_coeff[pi] = 1;

        for (var j = 0; j < shares.length; j++) {
          for (var n = 0; n < shares[j].value.length; n++) {
            var pj = jiff.helpers.get_party_number(shares[j].sender_id, n, jiff.party_count);
            if (pj !== pi) {
              var inv = jiff.helpers.extended_gcd(pi - pj, shares[i].Zp)[0];
              lagrange_coeff[pi] = jiff.helpers.mod(lagrange_coeff[pi] * (0 - pj), shares[i].Zp) * inv;
              lagrange_coeff[pi] = jiff.helpers.mod(lagrange_coeff[pi], shares[i].Zp);
            }
          }
        }
      }
    }

    // Reconstruct the secret via Lagrange interpolation
    var recons_secret = 0;
    for (var p = 0; p < shares.length; p++) {
      for (share_num = 0; share_num < shares[p].value.length; share_num++) {
        var party = jiff.helpers.get_party_number(shares[p].sender_id, share_num, jiff.party_count);
        var tmp = jiff.helpers.mod((shares[p].value[share_num] * lagrange_coeff[party]), shares[p].Zp);
        recons_secret = jiff.helpers.mod((recons_secret + tmp), shares[p].Zp);
      }
    }
    return recons_secret;
  }

  function createMultipleSharesSecretShare(jiff, share, share_helpers) {
    // Keep a copy of the previous implementation of changed primitives
    share.legacy = {};
    var internals = ['cadd', 'sadd', 'csub', 'ssub',
      'cmult', 'smult', 'smult_bgw',
      'cdivfac', 'cdiv', 'sdiv', 'smod',
      'cxor_bit', 'sxor_bit', 'cor_bit', 'sor_bit', 'not',
      'slt', 'slteq', 'sgt', 'sgteq', 'seq', 'sneq',
      'clt', 'clteq', 'cgt', 'cgteq', 'ceq', 'cneq',
      'lt_halfprime', 'if_else' ];
    for (var i = 0; i < internals.length; i++) {
      var key = internals[i];
      share.legacy[key] = share[key];
    }

    function max(x, y) {
      return x > y ? x : y;
    }

    share.open = function (parties, op_ids) {
      return share.jiff.open(share, parties, op_ids);
    };

    share.add = function (o) {
      if (share.isConstant(o)) {
        return share.cadd(o);
      }
      return share.sadd(o);
    };

    share.sub = function (o) {
      if (share.isConstant(o)) {
        return share.csub(o);
      }
      return share.ssub(o);
    };

    share.mult = function (o, op_id) {
      if (share.isConstant(o)) {
        return share.cmult(o);
      }
      return share.smult(o, op_id);
    };

    share.xor_bit = function (o) {
      if (share.isConstant(o)) {
        return share.cxor_bit(o);
      }
      return share.sxor_bit(o);
    };

    share.or_bit = function (o, op_id) {
      if (share.isConstant(o)) {
        return share.cor_bit(o);
      }
      return share.sor_bit(o, op_id);
    };

    share.gteq = function (o) {
      if (share.isConstant(o)) {
        return share.cgteq(o);
      }
      return share.sgteq(o);
    };

    share.gt = function (o) {
      if (share.isConstant(o)) {
        return share.cgt(o);
      }
      return share.sgt(o);
    };

    share.lteq = function (o) {
      if (share.isConstant(o)) {
        return share.clteq(o);
      }
      return share.slteq(o);
    };

    share.lt = function (o) {
      if (share.isConstant(o)) {
        return share.clt(o);
      }
      return share.slt(o);
    };

    share.eq = function (o) {
      if (share.isConstant(o)) {
        return share.ceq(o);
      }
      return share.seq(o);
    };

    share.neq = function (o) {
      if (share.isConstant(o)) {
        return share.cneq(o);
      }
      return share.sneq(o);
    };

    share.div = function (o) {
      if (share.isConstant(o)) {
        return share.cdiv(o);
      }
      return share.sdiv(o);
    };

    share.cadd = function (o) {
      if (!(share.isConstant(o))) {
        throw new Error('parameter should be a number (+)');
      }

      var ready_add = function () {
        var result = [];
        for (var i = 0; i < share.value.length; i++) {
            result.push(jiff.helpers.mod(share_helpers['+'](share.value[i], o), share.Zp));
        }
        return result;
      };

      if (share.ready) {
        if (typeof(share.value) == 'number') {
          return share.legacy.cadd(o);
        }
        return share.jiff.secret_share(share.jiff, true, null, ready_add(), share.holders, share.threshold, share.Zp, null, share.ratios);
      }

      var promise = share.promise.then(function () {
        if (typeof(share.value) == 'number') {
          return (share.legacy.cadd(o)).promise;
        }
        return ready_add(o);
      }, share.error);
      return share.jiff.secret_share(share.jiff, false, promise, undefined, share.holders, share.threshold, share.Zp, null, share.ratios);
    };

    share.sadd = function (o) {
      if (!(o.jiff === share.jiff)) {
        throw new Error('shares do not belong to the same instance (+)');
      }
      if (!share.jiff.helpers.Zp_equals(share, o)) {
        throw new Error('shares must belong to the same field (+)');
      }
      if (!share.jiff.helpers.array_equals(share.holders, o.holders)) {
        throw new Error('shares must be held by the same parties (+)');
      }

      // add the two share when ready
      var ready_add = function () {
        var result = [];
        for (var i = 0; i < share.value.length; i++) {
          result.push(share.jiff.helpers.mod(share_helpers['+'](share.value[i], o.value[i]), share.Zp));
        }
        return result;
      };

      if (share.ready && o.ready) {
        if (typeof(share.value) == 'number') {
          return share.legacy.sadd(o);
        }
        return share.jiff.secret_share(share.jiff, true, null, ready_add(), share.holders, max(share.threshold, o.threshold), share.Zp, null, share.ratios);
      }

      var promise = share.pick_promise(o).then( function () {
        if (typeof(share.value) == 'number') {
          var result = share.legacy.sadd(o);
          return result.promise;
        }
        return ready_add();
      }, share.error);
      return share.jiff.secret_share(share.jiff, false, promise, undefined, share.holders, max(share.threshold, o.threshold), share.Zp, null, share.ratios);
    };

    share.csub = function (o) {
      if (!(share.isConstant(o))) {
        throw new Error('parameter should be a number (-)');
      }

      var ready_sub = function () {
        var result = [];
        for (var i = 0; i < share.value.length; i++) {
          result.push(jiff.helpers.mod(share_helpers['-'](share.value[i], o), share.Zp));
        }
        return result;
      };

      if (share.ready) {
        if (typeof(share.value) == 'number') {
          return share.legacy.csub(o);
        }
        return share.jiff.secret_share(share.jiff, true, null, ready_sub(), share.holders, share.threshold, share.Zp, null, share.ratios);
      }

      var promise = share.promise.then(function () {
        if (typeof(share.value) == 'number') {
          return (share.legacy.csub(o)).promise;
        }
        return ready_sub();
      }, share.error);
      return share.jiff.secret_share(share.jiff, false, promise, undefined, share.holders, share.threshold, share.Zp, null, share.ratios);
    };

    share.ssub = function (o) {
      if (!(o.jiff === share.jiff)) {
        throw new Error('shares do not belong to the same instance (-)');
      }
      if (!share.jiff.helpers.Zp_equals(share, o)) {
        throw new Error('shares must belong to the same field (-)');
      }
      if (!share.jiff.helpers.array_equals(share.holders, o.holders)) {
        throw new Error('shares must be held by the same parties (-)');
      }

      var ready_sub = function () {
        var result = [];
        for (var i = 0; i < share.value.length; i++) {
          result.push(share.jiff.helpers.mod(share_helpers['-'](share.value[i], o.value[i]), share.Zp));
        }
        return result;
      };

      if (share.ready && o.ready) {
        if (typeof(share.value) == 'number') {
          return share.legacy.ssub(o);
        }
        return share.jiff.secret_share(share.jiff, true, null, ready_sub(), share.holders, max(share.threshold, o.threshold), share.Zp, null, share.ratios);
      }

      // promise to execute ready_add when both are ready
      var promise = share.pick_promise(o).then(function () {
        if (typeof(share.value) == 'number') {
          return (share.legacy.ssub(o).promise);
        }
        return ready_sub();
      }, share.error);
      return share.jiff.secret_share(share.jiff, false, promise, undefined, share.holders, max(share.threshold, o.threshold), share.Zp, null, share.ratios);
    };

    share.cmult = function (o) {
      if (!(share.isConstant(o))) {
        throw new Error('parameter should be a number (*)');
      }

      var ready_mult = function () {
        var result = [];
        for (var i = 0; i < share.value.length; i++) {
          result.push(jiff.helpers.mod(share_helpers['*'](share.value[i], o), share.Zp));
        }
        return result;
      };

      if (share.ready) {
        if (typeof(share.value) == 'number') {
          return share.legacy.cmult(o);
        }
        return share.jiff.secret_share(share.jiff, true, null, ready_mult(), share.holders, share.threshold, share.Zp, null, share.ratios);
      }

      var promise = share.promise.then(function () {
        if (typeof(share.value) == 'number') {
          return (share.legacy.cmult(o).promise);
        }
        return ready_mult();
      }, share.error);
      return share.jiff.secret_share(share.jiff, false, promise, undefined, share.holders, share.threshold, share.Zp, null, share.ratios);
    };

    share.smult = function (o, op_id) {
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

      var final_deferred = new Deferred();
      var final_promise = final_deferred.promise;
      var result = share.jiff.secret_share(share.jiff, false, final_promise, undefined, share.holders, max(share.threshold, o.threshold), share.Zp, 'share:' + op_id, share.ratios);

      // Get shares of triplets.
      var triplet = jiff.triplet(share.holders, max(share.threshold, o.threshold), share.Zp, op_id + ':triplet', share.ratios);

      var a = triplet[0];
      var b = triplet[1];
      var c = triplet[2];

      // d = s - a. e = o - b.
      var d = share.isadd(a.icmult(-1));
      var e = o.isadd(b.icmult(-1));

      // Open d and e.
      // The only communication cost.
      var e_promise = share.jiff.internal_open(e, e.holders, op_id + ':open1');
      var d_promise = share.jiff.internal_open(d, d.holders, op_id + ':open2');

      Promise.all([e_promise, d_promise]).then(function (arr) {
        var e_open = arr[0];
        var d_open = arr[1];

        // result_share = d_open * e_open + d_open * b_share + e_open * a_share + c.
        var t1 = share.jiff.helpers.mod(share_helpers['*'](d_open, e_open), share.Zp);
        var t2 = b.icmult(d_open);
        var t3 = a.icmult(e_open);

        // All this happens locally.
        var final_result = t2.icadd(t1);
        final_result = final_result.isadd(t3);
        final_result = final_result.isadd(c);

        final_result.wThen(final_deferred.resolve);
      });

      return result;
    };

    share.smult_bgw = function(o, op_id) {
      if (!(o.jiff === share.jiff)) {
        throw new Error('shares do not belong to the same instance (bgw*)');
      }
      if (!share.jiff.helpers.Zp_equals(share, o)) {
        throw new Error('shares must belong to the same field (bgw*)');
      }
      if (!share.jiff.helpers.array_equals(share.holders, o.holders)) {
        throw new Error('shares must be held by the same parties (bgw*)');
      }
      if ((share.threshold - 1) + (o.threshold - 1) > share.holders.length - 1) {
        throw new Error('threshold too high for BGW (*)');
      }
      var final_deferred = new Deferred();
      var final_promise = final_deferred.promise;

      var ready_mult_bgw = function () {
        var result = [];
        var promises = [];

        for (var i = 0; i < share.value.length; i++) {
          var share_tmp = jiff.secret_share(share.jiff, true, null, share.value[i], share.holders, share.threshold, share.Zp);
          var o_tmp = jiff.secret_share(o.jiff, true, null, o.value[i], o.holders, o.threshold, o.Zp);
          var multshare = share_tmp.legacy.smult_bgw(o_tmp, op_id);
          promises.push(multshare.promise);

          multshare.promise.then((function (i, multshare) {
            result[i] = multshare.value;
          }).bind(null, i, multshare));
        }

        Promise.all(promises).then(function () {
          final_deferred.resolve(result);
        }, share.error);
      };

      if (share.ready && o.ready) {
        ready_mult_bgw();
        return share.jiff.secret_share(share.jiff, false, final_promise, undefined, share.holders, max(share.threshold, o.threshold), share.Zp);
      }

      // promise to execute ready_add when both are ready
      share.pick_promise(o).then( function () {
        ready_mult_bgw();
      }, share.error);
      return share.jiff.secret_share(share.jiff, false, final_promise, undefined, share.holders, max(share.threshold, o.threshold), share.Zp);
    };

    share.cdiv = function (o, op_id) {
      var result, divshare;

      var ready_div = function () {
        result = [];
        var share_val = share.value;
        for (var i = 0; i < share.value.length; i++) {
          share.value = share_val[i];
          divshare = share.legacy.cdiv(o, op_id);
          if (divshare.ready) {
            result.push(divshare.value);
          } else {
            divshare.promise.then(function () {
              result.push(divshare.value);
            });
          }
        }
        share.value = share_val;
        return result;
      };

      if (share.ready) {
        if (typeof (share.value) === 'number') {
          return share.legacy.cdiv(o, op_id);
        } else {
          return share.jiff.secret_share(share.jiff, true, null, ready_div(), share.holders, share.threshold, share.Zp);
        }
      }

      var promise = share.promise.then( function () {
        if (typeof (share.value) === 'number') {
          divshare = share.legacy.cdiv(o);
          if (divshare.ready) {
            return divshare.value;
          }
          result = divshare.promise.then(function () {
            return divshare.value;
          });
          return result;
        } else {
          return ready_div();
        }
      }, share.error);
      return share.jiff.secret_share(share.jiff, false, promise, undefined, share.holders, share.threshold, share.Zp);
    };

    share.cdivfac = function (o) {
      var result, divshare;

      var ready_divfac = function () {
        result = [];
        var share_val = share.value;
        for (var i = 0; i < share.value.length; i++) {
          share.value = share_val[i];
          divshare = share.legacy.cdivfac(o);
          if (divshare.ready) {
            result.push(divshare.value);
          } else {
            divshare.promise.then(function () {
              result.push(divshare.value);
            });
          }
        }
        share.value = share_val;
        return result;
      };

      if (share.ready) {
        if (typeof (share.value) === 'number') {
          return share.legacy.cdivfac(o);
        } else {
          return share.jiff.secret_share(share.jiff, true, null, ready_divfac(), share.holders, share.threshold, share.Zp);
        }
      }

      var promise = share.promise.then( function () {
        if (typeof (share.value) === 'number') {
          divshare = share.legacy.cdivfac(o);
          if (divshare.ready) {
            return divshare.value;
          }
          result = divshare.promise.then(function () {
            return divshare.value;
          });
          return result;
        } else {
          return ready_divfac();
        }
      }, share.error);
      return share.jiff.secret_share(share.jiff, false, promise, undefined, share.holders, share.threshold, share.Zp);
    };

    share.sdiv = function (o, l, op_id) {
      var final_deferred = new Deferred();
      var final_promise = final_deferred.promise;

      var ready_div = function () {
        var result = [];
        var promises = [];

        for (var i = 0; i < share.value.length; i++) {
          var share_tmp = jiff.secret_share(share.jiff, true, null, share.value[i], share.holders, share.threshold, share.Zp, null, share.ratios);
          var o_tmp = jiff.secret_share(o.jiff, true, null, o.value[i], o.holders, o.threshold, o.Zp, null, o.ratios);
          var divshare = share_tmp.legacy.sdiv(o_tmp, l, op_id + ':' + i);
          promises.push(divshare.promise);

          divshare.promise.then((function (i, divshare) {
            console.log('divshare', i, divshare.value);
            result[i] = divshare.value;
          }).bind(null, i, divshare));
        }

        Promise.all(promises).then(function () {
          final_deferred.resolve(result);
        });
      };

      if (share.ready && o.ready) {
        ready_div();
        return share.jiff.secret_share(share.jiff, false, final_promise, undefined, share.holders, max(share.threshold, o.threshold), share.Zp, null, share.ratios);
      }

      // promise to execute ready_add when both are ready
      share.pick_promise(o).then( function () {
        ready_div();
      }, share.error);
      return share.jiff.secret_share(share.jiff, false, final_promise, undefined, share.holders, max(share.threshold, o.threshold), share.Zp);
    };

    share.smod = function (o, l, op_id) {
      var result, modshare;

      var ready_mod = function () {
        result = [];
        var share_val = share.value;
        var o_val = o.value;
        for (var i = 0; i < share.value.length; i++) {
          share.value = share_val[i];
          o.value = o_val[i];
          modshare = share.legacy.smod(o, l, op_id);
          if (modshare.ready) {
            result.push(modshare.value);
          } else {
            modshare.promise.then(function () {
              result.push(modshare.value);
            });
          }
        }
        share.value = share_val;
        o.value = o_val;
        return result;
      };

      if (share.ready && o.ready) {
        if (typeof (share.value) === 'number') {
          return share.legacy.smod(o, l, op_id);
        } else {
          return share.jiff.secret_share(share.jiff, true, null, ready_mod(), share.holders, max(share.threshold, o.threshold), share.Zp);
        }
      }

      // promise to execute ready_add when both are ready
      var promise = share.pick_promise(o).then( function () {
        if (typeof (share.value) === 'number') {
          modshare = share.legacy.smod(o, l, op_id);
          if (modshare.ready) {
            return modshare.value;
          }
          result = modshare.promise.then(function () {
            return modshare.value;
          });
          return result;
        } else {
          return ready_mod();
        }
      }, share.error);
      return share.jiff.secret_share(share.jiff, false, promise, undefined, share.holders, max(share.threshold, o.threshold), share.Zp);
    };

    share.cxor_bit = function (o) {
      var result, xor_share;
      var ready_xor_bit = function () {
        result = [];
        var share_val = share.value;
        for (var i = 0; i < share.value.length; i++) {
          share.value = share_val[i];
          xor_share = share.legacy.cxor_bit(o);
          if (xor_share.ready) {
            result.push(xor_share.value);
          } else {
            xor_share.promise.then(function () {
              result.push(xor_share.value);
            });
          }
        }
        share.value = share_val;
        return result;
      };

      if (share.ready) {
        if (typeof (share.value) === 'number') {
          return share.legacy.cxor_bit(o);
        } else {
          return share.jiff.secret_share(share.jiff, true, null, ready_xor_bit(), share.holders, share.threshold, share.Zp);
        }
      }

      var promise = share.promise.then( function () {
        if (typeof (share.value) === 'number') {
          xor_share = share.legacy.cxor_bit(o);
          if (xor_share.ready) {
            return xor_share.value;
          }
          result = xor_share.promise.then(function () {
            return xor_share.value;
          });
          return result;
        } else {
          return ready_xor_bit();
        }
      }, share.error);
      return share.jiff.secret_share(share.jiff, false, promise, undefined, share.holders, share.threshold, share.Zp);
    };


    share.cor_bit = function (o) {
      var result, or_share;
      var ready_or_bit = function () {
        result = [];
        var share_val = share.value;
        for (var i = 0; i < share.value.length; i++) {
          share.value = share_val[i];
          or_share = share.legacy.cor_bit(o);
          if (or_share.ready) {
            result.push(or_share.value);
          } else {
            or_share.promise.then(function () {
              result.push(or_share.value);
            });
          }
        }
        share.value = share_val;
        return result;
      };

      if (share.ready) {
        if (typeof (share.value) === 'number') {
          return share.legacy.cor_bit(o).value;
        } else {
          return share.jiff.secret_share(share.jiff, true, null, ready_or_bit(), share.holders, share.threshold, share.Zp);
        }
      }

      var promise = share.promise.then( function () {
        if (typeof (share.value) === 'number') {
          or_share = share.legacy.cor_bit(o);
          if (or_share.ready) {
            return or_share.value;
          }
          result = or_share.promise.then(function () {
            return or_share.value;
          });
          return result;
        } else {
          return ready_or_bit();
        }
      }, share.error);
      return share.jiff.secret_share(share.jiff, false, promise, undefined, share.holders, share.threshold, share.Zp);
    };

    share.clt = function (o, op_id) {
      var result, lt_share;
      var ready_lt = function () {
        result = [];
        var share_val = share.value;
        for (var i = 0; i < share.value.length; i++) {
          share.value = share_val[i];
          lt_share = share.legacy.clt(o, op_id);
          if (lt_share.ready) {
            result.push(lt_share.value);
          } else {
            lt_share.promise.then(function () {
              result.push(lt_share.value);
            });
          }
        }
        share.value = share_val;
        return result;
      };

      if (share.ready) {
        if (typeof (share.value) === 'number') {
          return share.legacy.clt(o, op_id);
        } else {
          return share.jiff.secret_share(share.jiff, true, null, ready_lt(), share.holders, share.threshold, share.Zp);
        }
      }

      var promise = share.promise.then( function () {
        if (typeof (share.value) === 'number') {
          lt_share = share.legacy.clt(o);
          if (lt_share.ready) {
            return lt_share.value;
          }
          result = lt_share.promise.then(function () {
            return lt_share.value;
          });
          return result;
        } else {
          return ready_lt();
        }
      }, share.error);
      return share.jiff.secret_share(share.jiff, false, promise, undefined, share.holders, share.threshold, share.Zp);
    };

    share.clteq = function (o, op_id) {
      var result, lteq_share;
      var ready_lteq = function () {
        result = [];
        var share_val = share.value;
        for (var i = 0; i < share.value.length; i++) {
          share.value = share_val[i];
          lteq_share = share.legacy.clteq(o, op_id);
          if (lteq_share.ready) {
            result.push(lteq_share.value);
          } else {
            lteq_share.promise.then(function () {
              result.push(lteq_share.value);
            });
          }
        }
        share.value = share_val;
        return result;
      };

        if (share.ready) {
          if (typeof (share.value) === 'number') {
            return share.legacy.clteq(o, op_id);
          } else {
            return share.jiff.secret_share(share.jiff, true, null, ready_lteq(), share.holders, share.threshold, share.Zp);
          }
        }

        var promise = share.promise.then( function () {
          if (typeof (share.value) === 'number') {
            lteq_share = share.legacy.clteq(o);
            if (lteq_share.ready) {
              return lteq_share.value;
            }
            result = lteq_share.promise.then(function () {
              return lteq_share.value;
            });
            return result;
          } else {
            return ready_lteq();
          }
        }, share.error);
        return share.jiff.secret_share(share.jiff, false, promise, undefined, share.holders, share.threshold, share.Zp);
    };

    share.cgt = function (o, op_id) {
      var result, gt_share;
      var ready_gt = function () {
        result = [];
        var share_val = share.value;
        for (var i = 0; i < share.value.length; i++) {
          share.value = share_val[i];
          gt_share = share.legacy.cgt(o, op_id);
          if (gt_share.ready) {
            result.push(gt_share.value);
          } else {
            gt_share.promise.then(function () {
              result.push(gt_share.value);
            });
          }
        }
        share.value = share_val;
        return result;
      };

      if (share.ready) {
        if (typeof (share.value) === 'number') {
          return share.legacy.cgt(o, op_id);
        } else {
          return share.jiff.secret_share(share.jiff, true, null, ready_gt(), share.holders, share.threshold, share.Zp);
        }
      }

      var promise = share.promise.then( function () {
        if (typeof (share.value) === 'number') {
          gt_share = share.legacy.cgt(o, op_id);
          if (gt_share.ready) {
            return gt_share.value;
          }
          result = gt_share.promise.then(function () {
            return gt_share.value;
          });
          return result;
        } else {
          return ready_gt();
        }
      }, share.error);
        return share.jiff.secret_share(share.jiff, false, promise, undefined, share.holders, share.threshold, share.Zp);
    };

    share.cgteq = function (o, op_id) {
      var result, gteq_share;
      var ready_gteq = function () {
        result = [];
        var share_val = share.value;
        for (var i = 0; i < share.value.length; i++) {
          share.value = share_val[i];
          gteq_share = share.legacy.cgteq(o, op_id);
          if (gteq_share.ready) {
            result.push(gteq_share.value);
          } else {
            gteq_share.promise.then(function () {
              result.push(gteq_share.value);
            });
          }
        }
        share.value = share_val;
        return result;
      };

      if (share.ready) {
        if (typeof (share.value) === 'number') {
          return share.legacy.cgteq(o, op_id);
        } else {
          return share.jiff.secret_share(share.jiff, true, null, ready_gteq(), share.holders, share.threshold, share.Zp);
        }
      }

      var promise = share.promise.then( function () {
        if (typeof (share.value) === 'number') {
          gteq_share = share.legacy.cgteq(o, op_id);
          if (gteq_share.ready) {
            return gteq_share.value;
          }
          result = gteq_share.promise.then(function () {
            return gteq_share.value;
          });
          return result;
        } else {
          return ready_gteq();
        }
      }, share.error);
      return share.jiff.secret_share(share.jiff, false, promise, undefined, share.holders, share.threshold, share.Zp);
    };

    share.ceq = function (o, op_id) {
      var result, eq_share;
      var ready_eq = function () {
        result = [];
        var share_val = share.value;
        for (var i = 0; i < share.value.length; i++) {
          share.value = share_val[i];
          eq_share = share.legacy.ceq(o, op_id);
          if (eq_share.ready) {
            result.push(eq_share.value);
          } else {
            eq_share.promise.then(function () {
              result.push(eq_share.value);
            });
          }
        }
        share.value = share_val;
        return result;
      };

      if (share.ready) {
        if (typeof (share.value) === 'number') {
          return share.legacy.ceq(o, op_id);
        } else {
          return share.jiff.secret_share(share.jiff, true, null, ready_eq(), share.holders, share.threshold, share.Zp);
        }
      }

      var promise = share.promise.then( function () {
        if (typeof (share.value) === 'number') {
          eq_share = share.legacy.ceq(o, op_id);
          if (eq_share.ready) {
            return eq_share.value;
          }
          result = eq_share.promise.then(function () {
            return eq_share.value;
          });
          return result;
        } else {
          return ready_eq();
        }
      }, share.error);
      return share.jiff.secret_share(share.jiff, false, promise, undefined, share.holders, share.threshold, share.Zp);
    };

    share.cneq = function (o, op_id) {
      var result, neq_share;
      var ready_neq = function () {
        result = [];
        var share_val = share.value;
        for (var i = 0; i < share.value.length; i++) {
          share.value = share_val[i];
          neq_share = share.legacy.cneq(o, op_id);
          if (neq_share.ready) {
            result.push(neq_share.value);
          } else {
            neq_share.promise.then(function () {
              result.push(neq_share.value);
            });
          }
        }
        share.value = share_val;
        return result;
      };

      if (share.ready) {
        if (typeof (share.value) === 'number') {
          return share.legacy.cneq(o, op_id).value;
        } else {
          return share.jiff.secret_share(share.jiff, true, null, ready_neq(), share.holders, share.threshold, share.Zp);
        }
      }

      var promise = share.promise.then( function () {
        if (typeof (share.value) === 'number') {
          neq_share = share.legacy.cneq(o, op_id);
          if (neq_share.ready) {
            return neq_share.value;
          }
          result = neq_share.promise.then(function () {
            return neq_share.value;
          });
          return result;
        } else {
          return ready_neq();
        }
      }, share.error);
      return share.jiff.secret_share(share.jiff, false, promise, undefined, share.holders, share.threshold, share.Zp);
    };

    share.slt = function (o, op_id) {
      var final_deferred = new Deferred();
      var final_promise = final_deferred.promise;

      var ready_lt = function () {
        var result = [];
        var promises = [];

        for (var i = 0; i < share.value.length; i++) {
          var share_tmp = jiff.secret_share(share.jiff, true, null, share.value[i], share.holders, share.threshold, share.Zp, null, share.ratios);
          var o_tmp = jiff.secret_share(o.jiff, true, null, o.value[i], o.holders, o.threshold, o.Zp, null, o.ratios);
          var lt_share = share_tmp.legacy.slt(o_tmp, op_id);
          promises.push(lt_share.promise);


          lt_share.promise.then((function (i, lt_share) {
            result[i] = lt_share.value;
          }).bind(null, i, lt_share));
        }

        Promise.all(promises).then(function () {
          final_deferred.resolve(result);
        });
      };

      if (share.ready && o.ready) {
        if (typeof (share.value) === 'number') {
          return share.legacy.slt(o, op_id);
        } else {
          ready_lt()
          return share.jiff.secret_share(share.jiff, false, final_promise, undefined, share.holders, max(share.threshold, o.threshold), share.Zp);
        }
      }

      // promise to execute ready_add when both are ready
      share.pick_promise(o).then( function () {
        if (typeof (share.value) === 'number') {
          lt_share = share.legacy.slt(o, op_id);
          if (lt_share.ready) {
            return lt_share.value;
          }
          result = lt_share.promise.then(function () {
            return lt_share.value;
          });
          return result;
        } else {
          ready_lt();
        }
      }, share.error);
      return share.jiff.secret_share(share.jiff, false, final_promise, undefined, share.holders, max(share.threshold, o.threshold), share.Zp);
    };

    share.slteq = function (o, op_id) {
      var result, lteq_share;

      var ready_lteq = function () {
        result = [];
        var share_val = share.value;
        var o_val = o.value;
        for (var i = 0; i < share.value.length; i++) {
          share.value = share_val[i];
          o.value = o_val[i];
          lteq_share = share.legacy.slteq(o, op_id);
          if (lteq_share.ready) {
            result.push(lteq_share.value);
          } else {
            lteq_share.promise.then(function () {
              result.push(lteq_share.value);
            });
          }
        }
        share.value = share_val;
        o.value = o_val;
        return result;
      };

      if (share.ready && o.ready) {
        if (typeof (share.value) === 'number') {
          return share.legacy.slteq(o, op_id);
        } else {
          return share.jiff.secret_share(share.jiff, true, null, ready_lteq(), share.holders, max(share.threshold, o.threshold), share.Zp);
        }
      }

      // promise to execute ready_add when both are ready
      var promise = share.pick_promise(o).then( function () {
        if (typeof (share.value) === 'number') {
          lteq_share = share.legacy.slteq(o, op_id);
          if (lteq_share.ready) {
            return lteq_share.value;
          }
          result = lteq_share.promise.then(function () {
            return lteq_share.value;
          });
          return result;
        } else {
          return ready_lteq();
        }
      }, share.error);
      return share.jiff.secret_share(share.jiff, false, finalpromise, undefined, share.holders, max(share.threshold, o.threshold), share.Zp);
    };

    share.sgt = function (o, op_id) {
      var result, gt_share;

      var ready_gt = function () {
        var result = [];
        var share_val = share.value;
        var o_val = o.value;
        for (var i = 0; i < share.value.length; i++) {
          share.value = share_val[i];
          o.value = o_val[i];
          gt_share = share.legacy.sgt(o, op_id);
          if (gt_share.ready) {
            result.push(gt_share.value);
          } else {
            gt_share.promise.then(function () {
              result.push(gt_share.value);
            });
          }
        }
        share.value = share_val;
        o.value = o_val;
        return result;
      };

      if (share.ready && o.ready) {
        if (typeof (share.value) === 'number') {
          return share.legacy.sgt(o, op_id);
        } else {
          return share.jiff.secret_share(share.jiff, true, null, ready_gt(), share.holders, max(share.threshold, o.threshold), share.Zp);
        }
      }

      // promise to execute ready_add when both are ready
      var promise = share.pick_promise(o).then( function () {
        if (typeof (share.value) === 'number') {
          gt_share = share.legacy.sgt(o, op_id);
          if (gt_share.ready) {
            return gt_share.value;
          }
          result = gt_share.promise.then(function () {
            return gt_share.value;
          });
          return result;
        } else {
          return ready_gt();
        }
      }, share.error);
      return share.jiff.secret_share(share.jiff, false, promise, undefined, share.holders, max(share.threshold, o.threshold), share.Zp);
    };

    share.sgteq = function (o, op_id) {
      var result, gteq_share;

      var ready_gteq = function () {
        result = [];
        var share_val = share.value;
        var o_val = o.value;
        for (var i = 0; i < share.value.length; i++) {
          share.value = share_val[i];
          o.value = o_val[i];
          gteq_share = share.legacy.sgteq(o, op_id);
          if (gteq_share.ready) {
            result.push(gteq_share.value);
          } else {
            gteq_share.promise.then(function () {
              result.push(gteq_share.value);
            });
          }
        }
        share.value = share_val;
        o.value = o_val;
        return result;
      };

      if (share.ready && o.ready) {
        if (typeof (share.value) === 'number') {
          return share.legacy.sgteq(o, op_id);
        } else {
          return share.jiff.secret_share(share.jiff, true, null, ready_gteq(), share.holders, max(share.threshold, o.threshold), share.Zp);
        }
      }

      // promise to execute ready_add when both are ready
      var promise = share.pick_promise(o).then( function () {
        if (typeof (share.value) === 'number') {
          gteq_share = share.legacy.sgteq(o, op_id);
          if (gteq_share.ready) {
            return gteq_share.value;
          }
          result = gteq_share.promise.then(function () {
              return gteq_share.value;
          });
          return result;
        } else {
          return ready_gteq();
        }
      }, share.error);
      return share.jiff.secret_share(share.jiff, false, promise, undefined, share.holders, max(share.threshold, o.threshold), share.Zp);
    };

    share.seq = function (o, op_id) {
      var result, eq_share;

      var ready_eq = function () {
        result = [];
        var share_val = share.value;
        var o_val = o.value;
        for (var i = 0; i < share.value.length; i++) {
          share.value = share_val[i];
          o.value = o_val[i];
          eq_share = share.legacy.seq(o, op_id);
          if (eq_share.ready) {
            result.push(eq_share.value);
          } else {
            eq_share.promise.then(function () {
              result.push(eq_share.value);
            });
          }
        }
        share.value = share_val;
        o.value = o_val;
        return result;
      };

      if (share.ready && o.ready) {
        if (typeof (share.value) === 'number') {
          return share.legacy.seq(o, op_id);
        } else {
          return share.jiff.secret_share(share.jiff, true, null, ready_eq(), share.holders, max(share.threshold, o.threshold), share.Zp);
        }
      }

      // promise to execute ready_add when both are ready
      var promise = share.pick_promise(o).then( function () {
        if (typeof (share.value) === 'number') {
          eq_share = share.legacy.seq(o, op_id);
          if (eq_share.ready) {
            return eq_share.value;
          }
          result = eq_share.promise.then(function () {
            return eq_share.value;
          });
          return result;
        } else {
          return ready_eq();
        }
      }, share.error);
      return share.jiff.secret_share(share.jiff, false, promise, undefined, share.holders, max(share.threshold, o.threshold), share.Zp);
    };

    share.sneq = function (o, op_id) {
      var result, neq_share;

      var ready_neq = function () {
        result = [];
        var share_val = share.value;
        var o_val = o.value;
        for (var i = 0; i < share.value.length; i++) {
          share.value = share_val[i];
          o.value = o_val[i];
          neq_share = share.legacy.sneq(o, op_id);
          if (neq_share.ready) {
            result.push(neq_share.value);
          } else {
            neq_share.promise.then(function () {
              result.push(neq_share.value);
            });
          }
        }
        share.value = share_val;
        o.value = o_val;
        return result;
      };

      if (share.ready && o.ready) {
        if (typeof (share.value) === 'number') {
          return share.legacy.sneq(o, op_id);
        } else {
          return share.jiff.secret_share(share.jiff, true, null, ready_neq(), share.holders, max(share.threshold, o.threshold), share.Zp);
        }
      }

      // promise to execute ready_add when both are ready
      var promise = share.pick_promise(o).then( function () {
        if (typeof (share.value) === 'number') {
          neq_share = share.legacy.sneq(o, op_id);
          if (neq_share.ready) {
            return neq_share.value;
          }
          result = neq_share.promise.then(function () {
            return neq_share.value;
          });
          return result;
        } else {
          return ready_neq();
        }
      }, share.error);
      return share.jiff.secret_share(share.jiff, false, promise, undefined, share.holders, max(share.threshold, o.threshold), share.Zp);
    };

    /*share.lt_halfprime = function (op_id) {
      var result, halfprime_share;

      var ready_lt_halfprime = function () {
        result = [];
        var share_val = share.value;
        for (var i = 0; i < share.value.length; i++) {
          share.value = share_val[i];
          halfprime_share = share.legacy.lt_halfprime(op_id);
          if (halfprime_share.ready) {
            result.push(halfprime_share.value);
          } else {
            halfprime_share.promise.then(function () {
              result.push(halfprime_share.value);
            });
          }
        }
        share.value = share_val;
        return result;
      };

      if (share.ready) {
        if (typeof (share.value) === 'number') {
          return share.legacy.lt_halfprime(op_id);
        } else {
          return share.jiff.secret_share(share.jiff, true, null, ready_lt_halfprime(), share.holders, share.threshold, share.Zp);
        }
      }

      var promise = share.promise.then( function () {
        if (typeof (share.value) === 'number') {
          halfprime_share = share.legacy.lt_halfprime(op_id);
          if (halfprime_share.ready) {
            return halfprime_share.value;
          }
          result = halfprime_share.promise.then(function () {
            return halfprime_share.value;
          });
          return result;
        } else {
          return ready_lt_halfprime();
        }
      }, share.error);
      return share.jiff.secret_share(share.jiff, false, promise, undefined, share.holders, share.threshold, share.Zp);
    };*/

    /*share.not = function () {
      var result, not_share;
      var ready_not = function () {
        result = [];
        var share_val = share.value;
        for (var i = 0; i < share.value.length; i++) {
          share.value = share_val[i];
          not_share = share.legacy.not();
          if (not_share.ready) {
            result.push(not_share.value);
          } else {
            not_share.promise.then(function () {
              result.push(not_share.value);
            });
          }
        }
        share.value = share_val;
        return result;
      };

      if (share.ready) {
        if (typeof (share.value) === 'number') {
          return share.legacy.not();
        } else {
          return share.jiff.secret_share(share.jiff, true, null, ready_not(), share.holders, share.threshold, share.Zp);
        }
      }

      var promise = share.promise.then( function () {
        if (typeof (share.value) === 'number') {
          not_share = share.legacy.not();
          if (not_share.ready) {
            return not_share.value;
          }
          result = not_share.promise.then(function () {
            return not_share.value;
          });
          return result;
        } else {
          return ready_not();
        }
      }, share.error);
      return share.jiff.secret_share(share.jiff, false, promise, undefined, share.holders, share.threshold, share.Zp);
    };*/

    share.if_else = function (trueVal, falseVal, op_id) {
      var result, ifelseshare;
      var ready_if_else = function () {
        result = [];
        var share_val = share.value;
        for (var i = 0; i < share.value.length; i++) {
          share.value = share_val[i];
          ifelseshare = share.legacy.if_else(trueVal, falseVal, op_id);
          if (ifelseshare.ready) {
            result.push(ifelseshare.value);
          } else {
            ifelseshare.promise.then(function () {
              result.push(ifelseshare.value);
            });
          }
        }
        share.value = share_val;
        return result;
      };

      if (share.ready) {
        if (typeof (share.value) === 'number') {
          return share.legacy.if_else(trueVal, falseVal, op_id).value;
        } else {
          return share.jiff.secret_share(share.jiff, true, null, ready_if_else(), share.holders, share.threshold, share.Zp);
        }
      }

      var promise = share.promise.then( function () {
        if (typeof (share.value) === 'number') {
          ifelseshare = share.legacy.if_else(trueVal, falseVal, op_id);
          if (ifelseshare.ready) {
            return ifelseshare.value;
          }
          result = ifelseshare.promise.then(function () {
            return ifelseshare.value;
          });
          return result;
        } else {
          return ready_if_else();
        }
      }, share.error);
      return share.jiff.secret_share(share.jiff, false, promise, undefined, share.holders, share.threshold, share.Zp);
    };

    share.isadd = share.sadd;
    share.issub = share.ssub;
    share.ismult = share.smult;
    share.icadd = share.cadd;
    share.icsub = share.csub;
    share.icmult = share.cmult;

    return share;
  }


  function make_jiff(base_instance, options) {
    var jiff = base_instance;

    // Parse options
    if (options == null) {
      options = {};
    }

    jiff.helpers.get_party_number = function (party_id, share_num, party_count) {
      if (share_num == null){
        share_num = 0;
      }
      if (typeof(party_id) === 'number') {
        return party_id + (share_num * (jiff.party_count+1));
      }
      if (party_id.startsWith('s')) {
        return parseInt(party_id.substring(1), 10) * (jiff.party_count+1); // n+1 reserved for server
      }
      return parseInt(party_id, 10) + (share_num * (jiff.party_count+1));
    };

    var old_secret_share = jiff.secret_share;
    jiff.secret_share = function (jiff, ready, promise, value, holders, threshold, Zp, id, ratios) {
      var share = old_secret_share(jiff, ready, promise, value, holders, threshold, Zp, id);
      if (!(ratios == null)) {
        share.ratios = ratios;
      }
      return share;
    };

    function jiff_broadcast(jiff, share, parties, op_ids) {
      for (var index = 0; index < parties.length; index++) {
        var i = parties[index]; // Party id
        if (i === jiff.id) {
          receive_open(jiff, {party_id: i, share: share.value, op_id: op_ids[i], Zp: share.Zp});
          continue;
        }

        // encrypt, sign and send
        var msg = {party_id: i, share: share.value.slice(), op_id: op_ids[i], Zp: share.Zp};
        msg = jiff.execute_array_hooks('beforeOperation', [jiff, 'open', msg], 2);
        for (var j = 0; j < msg['share'].length; j++) {
          msg['share'][j] = jiff.hooks.encryptSign(jiff, msg['share'][j].toString(), jiff.keymap[msg['party_id']], jiff.secret_key);
        }
        jiff.socket.safe_emit('open', JSON.stringify(msg));
      }
    }

    function receive_open(jiff, json_msg) {
      // Decrypt share
      if (json_msg['party_id'] !== jiff.id) {
        for (var i = 0; i < json_msg['share'].length; i++) {
          json_msg['share'][i] = jiff.hooks.decryptSign(jiff, json_msg['share'][i], jiff.secret_key, jiff.keymap[json_msg['party_id']]);
        }
        json_msg = jiff.execute_array_hooks('afterOperation', [jiff, 'open', json_msg], 2);
      }

      var sender_id = json_msg['party_id'];
      var op_id = json_msg['op_id'];
      var share = json_msg['share'];
      var Zp = json_msg['Zp'];

      // call hook
      share = jiff.execute_array_hooks('receiveOpen', [jiff, sender_id, share, Zp], 2);

      // Resolve the deferred.
      if (jiff.deferreds[op_id] == null) {
        jiff.deferreds[op_id] = {};
      }
      if (jiff.deferreds[op_id][sender_id] == null) {
        jiff.deferreds[op_id][sender_id] = new Deferred();
      }

      jiff.deferreds[op_id][sender_id].resolve({value: share, sender_id: sender_id, Zp: Zp});
    }

    jiff_open = function(jiff, share, parties, op_ids) {
      var i;

      if (!(share.jiff === jiff)) {
        throw 'share does not belong to given instance';
      }

      // Default values
      if (parties == null || parties === []) {
        parties = [];
        for (i = 1; i <= jiff.party_count; i++) {
          parties.push(i);
        }
      } else {
        parties.sort();
      }

      // If not a receiver nor holder, do nothing
      if (share.holders.indexOf(jiff.id) === -1 && parties.indexOf(jiff.id) === -1) {
        return null;
      }

      // Compute operation ids (one for each party that will receive a result
      if (op_ids == null) {
        op_ids = {};
      }

      if (typeof (op_ids) === 'string' || typeof (op_ids) === 'number') {
        var tmp = {};
        for (i = 0; i < parties.length; i++) {
          tmp[parties[i]] = op_ids;
        }
        op_ids = tmp;
      } else {
        var holders_label = share.holders.join(',');
        for (i = 0; i < parties.length; i++) {
          if (op_ids[parties[i]] == null) {
            op_ids[parties[i]] = jiff.counters.gen_open_id(parties[i], holders_label);
          }
        }
      }

      // Party is a holder
      if (share.holders.indexOf(jiff.id) > -1) {
        // Call hook
        share = jiff.execute_array_hooks('beforeOpen', [jiff, share, parties], 1);

        // refresh/reshare, so that the original share remains secret, instead
        // a new share is sent/open without changing the actual value.
        //share = share.refresh('refresh:' + op_ids[parties[0]]);

        // The given share has been computed, share it to all parties
        if (share.ready) {
          jiff_broadcast(jiff, share, parties, op_ids);
        } else {
          jiff.counters.pending_opens++;
          // Share is not ready, setup sharing as a callback to its promise
          share.promise.then(function () {
            jiff.counters.pending_opens--;
            jiff_broadcast(jiff, share, parties, op_ids);
          }, share.error);
        }
      }

      // Party is a receiver
      if (parties.indexOf(jiff.id) > -1) {
        var shares = []; // this will store received shares
        var numberofshares = 0;
        var final_deferred = new Deferred(); // will be resolved when the final value is reconstructed
        var final_promise = final_deferred.promise;
        for (i = 0; i < share.holders.length; i++) {
          var p_id = share.holders[i];

          // Setup a deferred for receiving a share from party p_id
          if (jiff.deferreds[op_ids[jiff.id]] == null) {
            jiff.deferreds[op_ids[jiff.id]] = {};
          }
          if (jiff.deferreds[op_ids[jiff.id]][p_id] == null) {
            jiff.deferreds[op_ids[jiff.id]][p_id] = new Deferred();
          }

          // Clean up deferred when fulfilled
          var promise = jiff.deferreds[op_ids[jiff.id]][p_id].promise;

          // destroy deferred when done
          (function (promise, p_id) { // p_id is modified in a for loop, must do this to avoid scoping issues.
            promise.then(function (received_share) {
              jiff.deferreds[op_ids[jiff.id]][p_id] = null;
              shares.push(received_share);
              numberofshares += received_share['value'].length;

              // Too few shares, nothing to do.
              if (numberofshares < share.threshold) {
                return;
              }

              // Enough shares to reconstruct.
              // If did not already reconstruct, do it.
              if (final_deferred != null) {
                var recons_secret = jiff_lagrange(jiff, shares);
                recons_secret = jiff.execute_array_hooks('afterReconstructShare', [jiff, recons_secret], 1);
                final_deferred.resolve(recons_secret);
                final_deferred = null;
              }

              // If all shares were received, clean up.
              if (shares.length === share.holders.length) {
                shares = null;
                jiff.deferreds[op_ids[jiff.id]] = null;
              }
            });
          })(promise, p_id);
        }
        return final_promise;
      }
    };


    jiff.open = function (share, parties, op_ids) {
      return jiff.internal_open(share, parties, op_ids);
    };

    jiff.internal_open = function (share, parties, op_ids) {
      return jiff_open(jiff, share, parties, op_ids);
    };

    jiff.share = function (secret, threshold, receivers_list, senders_list, Zp, share_id, receivers_ratios) {
      var i, j, p_id, p_ratio;

      // defaults
      if (Zp == null) {
        Zp = jiff.Zp;
      }
      if (receivers_list == null) {
        receivers_list = [];
        for (i = 1; i <= jiff.party_count; i++) {
          receivers_list.push(i);
        }
      }
      if (senders_list == null) {
        senders_list = [];
        for (i = 1; i <= jiff.party_count; i++) {
          senders_list.push(i);
        }
      }
      if (threshold == null) {
        threshold = receivers_list.length;
      }
      if (threshold < 0) {
        threshold = 2;
      }
      if (threshold > receivers_list.length) {
        threshold = receivers_list.length;
      }
      if (receivers_ratios == null) {
        receivers_ratios = {1: 2, 2: 1}
      }

      // if party is uninvolved in the share, do nothing
      if (receivers_list.indexOf(jiff.id) === -1 && senders_list.indexOf(jiff.id) === -1) {
        return {};
      }

      // compute operation id
      receivers_list.sort(); // sort to get the same order
      senders_list.sort();
      if (share_id == null) {
        share_id = jiff.counters.gen_share_id(receivers_list, senders_list);
      }

      // stage sending of shares
      if (senders_list.indexOf(jiff.id) > -1) {
        // Call hook
        secret = jiff.execute_array_hooks('beforeShare', [jiff, secret, threshold, receivers_list, senders_list, Zp], 1);

        // compute shares
        var shares = jiff_compute_shares(jiff, secret, receivers_list, threshold, Zp, receivers_ratios);

        // Call hook
        shares = jiff.execute_array_hooks('afterComputeShare', [jiff, shares, threshold, receivers_list, senders_list, Zp], 1);

        // send shares
        for (i = 0; i < receivers_list.length; i++) {
          p_id = receivers_list[i];
          if (p_id === jiff.id) {
            continue;
          }

          // send encrypted and signed shares_id[p_id] to party p_id
          var msg = {party_id: p_id, share: shares[p_id], op_id: share_id, p_ratio: p_ratio};
          msg = jiff.execute_array_hooks('beforeOperation', [jiff, 'share', msg], 2);
          p_ratio = (p_id in receivers_ratios) ? receivers_ratios[p_id] : 1;
          for (j = 0; j < p_ratio; j++) {
            msg['share'][j] = jiff.hooks.encryptSign(jiff, msg['share'][j].toString(10), jiff.keymap[msg['party_id']], jiff.secret_key);
          }
          jiff.socket.safe_emit('share', JSON.stringify(msg));
        }
      }

      // stage receiving of shares
      var result = {};
      if (receivers_list.indexOf(jiff.id) > -1) {
        // setup a map of deferred for every received share
        if (jiff.deferreds[share_id] == null) {
          jiff.deferreds[share_id] = {};
        }

        for (i = 0; i < senders_list.length; i++) {
          p_id = senders_list[i];
          p_ratio = (p_id in receivers_ratios) ? receivers_ratios[p_ratio] : 1;
          if (p_id === jiff.id) {
            var my_share = jiff.execute_array_hooks('receiveShare', [jiff, p_id, shares[p_id]], 2);
            result[p_id] = jiff.secret_share(jiff, true, null, my_share, receivers_list, threshold, Zp, null, receivers_ratios);
            continue; // Keep party's own share
          }

          // check if a deferred is set up (maybe the message was previously received)
          if (jiff.deferreds[share_id][p_id] == null) {
            // not ready, setup a deferred
            jiff.deferreds[share_id][p_id] = new Deferred();
          }

          var promise = jiff.deferreds[share_id][p_id].promise;

          // destroy deferred when done
          (function (promise, p_id) { // p_id is modified in a for loop, must do this to avoid scoping issues.
            promise.then(function () {
              jiff.deferreds[share_id][p_id] = null;
            });
          })(promise, p_id);

          // receive share_i[id] from party p_id
          result[p_id] = jiff.secret_share(jiff, false, promise, undefined, receivers_list, threshold, Zp, share_id + ':' + p_id, receivers_ratios);
        }
      }
      return result;
    };


    function jiff_triplet(jiff, receivers_list, threshold, Zp, triplet_id, receivers_ratios) {
      if (Zp == null) {
        Zp = jiff.Zp;
      }
      if (receivers_list == null) {
        receivers_list = [];
        for (var i = 1; i <= jiff.party_count; i++) {
          receivers_list.push(i);
        }
      }
      if (threshold == null) {
        threshold = receivers_list.length;
      }

      // Get the id of the triplet needed.
      if (triplet_id == null) {
        triplet_id = jiff.counters.gen_triplet_id(receivers_list);
      }

      // Send a request to the server.
      var msg = { triplet_id: triplet_id, receivers: receivers_list, threshold: threshold, Zp: Zp, ratios: receivers_ratios};
      msg = jiff.execute_array_hooks('beforeOperation', [jiff, 'triplet', msg], 2);
      msg = JSON.stringify(msg);

      // Setup deferred to handle receiving the triplets later.
      var a_deferred = new Deferred();
      var b_deferred = new Deferred();
      var c_deferred = new Deferred();
      jiff.deferreds[triplet_id] = {a: a_deferred, b: b_deferred, c: c_deferred};

      // send a request to the server.
      if (jiff.id === 's1') {
        jiff.socket.safe_emit('triplet', msg);
      } else {
        var cipher = jiff.hooks.encryptSign(jiff, msg, jiff.keymap['s1'], jiff.secret_key);
        jiff.socket.safe_emit('triplet', JSON.stringify(cipher));
      }

      var a_share = jiff.secret_share(jiff, false, a_deferred.promise, undefined, receivers_list, threshold, Zp, triplet_id + ':a');
      var b_share = jiff.secret_share(jiff, false, b_deferred.promise, undefined, receivers_list, threshold, Zp, triplet_id + ':b');
      var c_share = jiff.secret_share(jiff, false, c_deferred.promise, undefined, receivers_list, threshold, Zp, triplet_id + ':c');

      return [a_share, b_share, c_share];
    }

    jiff.triplet = function (receivers_list, threshold, Zp, triplet_id, receivers_ratios) {
      return jiff_triplet(jiff, receivers_list, threshold, Zp, triplet_id, receivers_ratios);
    };


    /* HOOKS */
    jiff.hooks.createSecretShare.push(createMultipleSharesSecretShare);
    // parse content of share/open messages to be integers
    jiff.hooks.afterOperation[0] = function (jiff, label, msg) {
      if (label === 'share' || label === 'open') {
        if (msg['share'].length >= 1) {
          for (var i = 0; i < msg['share'].length; i++) {
            msg['share'][i] = parseInt(msg['share'][i], 10);
          }
        } else {
          msg['share'] = parseInt(msg['share'], 10);
        }
      }
      return msg;
    };

    return jiff;
  }

  // Expose API
  exports.make_jiff = make_jiff;
  exports.sharing_schemes = {shamir_share: jiff_compute_shares, shamir_reconstruct: jiff_lagrange};
}((typeof exports === 'undefined' ? this.jiff_asynchronousshare = {} : exports), typeof exports !== 'undefined'));