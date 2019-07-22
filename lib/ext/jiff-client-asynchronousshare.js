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

    share.refresh = function (op_id) {
      return share.isadd(share.jiff.server_generate_and_share({number: 0, ratios: share.ratios}, share.holders, share.threshold, share.Zp, op_id)[0]);
    }

    share.add = function (o) {
      console.log('correct adding share', share);
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

    share.div = function (o, op_id) {
      if (share.isConstant(o)) {
        return share.cdiv(o, op_id);
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
        return ready_add();
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
      if (!(share.isConstant(o))) {
        throw new Error('parameter should be a number (/)');
      }

      if (share_helpers['<='](o, 0)) {
        throw new Error('divisor must be > 0 (cst/): ' + o);
      }

      if (share_helpers['<='](share.Zp, o)) {
        throw new Error('divisor must be < share.Zp (' + share.Zp + ') in (cst/): ' + o);
      }

      if (op_id == null) {
        op_id = share.jiff.counters.gen_op_id('c/', share.holders);
      }

      // Allocate share for result to which the answer will be resolved once available
      var final_deferred = new Deferred();
      var final_promise = final_deferred.promise;
      var result = share.jiff.secret_share(share.jiff, false, final_promise, undefined, share.holders, share.threshold, share.Zp, 'share:' + op_id, share.ratios);

      var ZpOVERc = share_helpers['floor/'](share.Zp, o);

      // add uniform noise to self so we can open
      var nOVERc = share.jiff.server_generate_and_share({max: ZpOVERc, ratios: share.ratios}, share.holders, share.threshold, share.Zp, op_id + ':nOVERc')[0];
      var nMODc = share.jiff.server_generate_and_share({max: o, ratios: share.ratios}, share.holders, share.threshold, share.Zp, op_id + ':nMODc')[0];
      var noise = nOVERc.icmult(o).isadd(nMODc);

      var noisyX = share.isadd(noise);

      share.jiff.internal_open(noisyX, noisyX.holders, op_id + ':open').then(function (noisyX) {
        var wrapped = share.icgt(noisyX, op_id + ':wrap_cgt'); // 1 => x + noise wrapped around Zp, 0 otherwise

        // if we did not wrap
        var noWrapDiv = share_helpers['floor/'](noisyX, o);
        var unCorrectedQuotient = nOVERc.icmult(-1).icadd(noWrapDiv).icsub(1);
        var verify = share.issub(unCorrectedQuotient.icmult(o));
        var isNotCorrect = verify.icgteq(o, op_id + ':cor1');
        var noWrapAnswer = unCorrectedQuotient.isadd(isNotCorrect); // if incorrect => isNotCorrect = 1 => quotient = unCorrectedQuotient - 1

        // if we wrapped
        var wrapDiv = share_helpers['floor/'](share_helpers['+'](noisyX, share.Zp), o);
        var unCorrectedQuotient2 = nOVERc.icmult(-1).icadd(wrapDiv).icsub(1);
        var verify2 = share.issub(unCorrectedQuotient2.icmult(o));
        var isNotCorrect2 = verify2.icgteq(o, op_id + ':cor2');
        var wrapAnswer = unCorrectedQuotient2.isadd(isNotCorrect2); // if incorrect => isNotCorrect = 1 => quotient = unCorrectedQuotient - 1

        var answer = noWrapAnswer.isadd(wrapped.ismult(wrapAnswer.issub(noWrapAnswer), op_id + ':smult'));
        answer.wThen(final_deferred.resolve);
      });

      // special case, if result is zero, sometimes we will get to -1 due to how correction happens above (.csub(1) and then compare)
      var zeroIt = share.iclt(o, op_id + ':zero_check').inot();
      return result.ismult(zeroIt, op_id + ':zero_it');
    };

    share.cdivfac = function (o) {
      if (!(share.isConstant(o))) {
        throw new Error('Parameter should be a number (cdivfac)');
      }
      var inv = share.jiff.helpers.extended_gcd(o, share.Zp)[0];

      var ready_cdivfac = function () {
        var result = [];
        for (var i = 0; i < share.value.length; i++) {
          result.push(share.jiff.helpers.mod(share_helpers['*'](share.value[i], inv), share.Zp))
        }
        return result;
      }

      if (share.ready) {
        // If share is ready.
        return share.jiff.secret_share(share.jiff, true, null, ready_cdivfac(), share.holders, share.threshold, share.Zp, null, share.ratios);
      }

      var promise = share.promise.then(function () {
        return ready_cdivfac();
      }, share.error);
      return share.jiff.secret_share(share.jiff, false, promise, undefined, share.holders, share.threshold, share.Zp, null, share.ratios);
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

    share.lt_halfprime = function (op_id) {
      if (op_id == null) {
        op_id = share.jiff.counters.gen_op_id('lt_hp', share.holders);
      }

      var final_deferred = new Deferred();
      var final_promise = final_deferred.promise;
      var result = share.jiff.secret_share(share.jiff, false, final_promise, undefined, share.holders, share.threshold, share.Zp, 'share:' + op_id, share.ratios);

      // if 2*self is even, then self is less than half prime, otherwise self is greater or equal to half prime
      var share2 = share.icmult(2);

      // To check if share is even, we will use pre-shared bits as some form of a bit mask
      var bitLength = share_helpers['floor'](share.jiff.helpers.bLog(share2.Zp, 2)); // TODO: this leaks one bit, fix it for mod 2^n
      var bits = share.jiff.server_generate_and_share({
        bit: true,
        count: bitLength,
        ratios: share.ratios
      }, share2.holders, share2.threshold, share2.Zp, op_id + ':number:bits');
      bits[bitLength] = share.jiff.server_generate_and_share({number: 0, ratios: share.ratios}, share2.holders, share2.threshold, share2.Zp, op_id + ':number:' + bitLength)[0]; // remove this line when fixing TODO

      // bit composition: r = (rl ... r1 r0)_10
      var r = share.jiff.protocols.bits.bit_composition(bits);

      // open share + noise, and utilize opened value with shared bit representation of noise to check the least significant digit of share.
      share2.jiff.internal_open(r.isadd(share2), share2.holders, op_id + ':open').then(function (result) {
        var wrapped = share.jiff.protocols.bits.cgt(bits, result, op_id + ':bits.cgt');
        wrapped.ratios = share.ratios;
        var isOdd = share.jiff.helpers.mod(result, 2);
        isOdd = bits[0].icxor_bit(isOdd);
        isOdd = isOdd.isxor_bit(wrapped, op_id + ':sxor_bit');

        var answer = isOdd.inot();
        answer.wThen(final_deferred.resolve);
      });

      return result;
    };

    share.clt = function (o, op_id) {
      var result = share.legacy.clt(o, op_id);
      result.ratios = share.ratios;
      return result;
    }

    share.slt = function (o, op_id) {
      var result = share.legacy.slt(o, op_id);
      result.ratios = share.ratios;
      return result;
    }

    share.cgt = function (o, op_id) {
      var result = share.legacy.cgt(o, op_id);
      result.ratios = share.ratios;
      return result;
    }

    share.isadd = share.sadd;
    share.issub = share.ssub;
    share.ismult = share.smult;
    share.icadd = share.cadd;
    share.icsub = share.csub;
    share.icmult = share.cmult;
    share.ilt_halfprime = share.lt_halfprime;
    share.islt = share.slt;
    share.iclt = share.clt;
    share.icgt = share.cgt;

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
        share = share.refresh('refresh:' + op_ids[parties[0]]);

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

    jiff_share = function (jiff, secret, threshold, receivers_list, senders_list, Zp, share_id, receivers_ratios) {
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

    jiff.share = function (secret, threshold, receivers_list, senders_list, Zp, share_id, receivers_ratios) {
      // type check to confirm the secret to be shared is a number
      // for fixed-point extension it should allow non-ints
      if (secret != null && (typeof(secret) !== 'number' || Math.floor(secret) !== secret || secret < 0)) {
        throw new Error('secret must be a non-negative whole number');
      }
      if (secret != null && (secret >= (Zp == null ? jiff.Zp : Zp))) {
        throw new Error('secret must fit inside Zp');
      }
      return jiff.internal_share(secret, threshold, receivers_list, senders_list, Zp, share_id, receivers_ratios);
    };

    /**
     * Same as jiff-instance.share, but used by internal JIFF primitives/protocols (bgw).
     */
    jiff.internal_share = function (secret, threshold, receivers_list, senders_list, Zp, share_id, receivers_ratios) {
      return jiff_share(jiff, secret, threshold, receivers_list, senders_list, Zp, share_id, receivers_ratios);
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

    jiff_server_share_number = function (jiff, options, receivers_list, threshold, Zp, number_id) {
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

      // Get the id of the number.
      if (number_id == null) {
        number_id = jiff.counters.gen_number_id(receivers_list);
      }

      if (options == null) {
        options = {};
      }
      if (options.count == null) {
        options.count = 1;
      }

      var msg = {number_id: number_id, receivers: receivers_list, threshold: threshold, Zp: Zp, ratios: options.ratios};
      msg = Object.assign(msg, options);

      msg = jiff.execute_array_hooks('beforeOperation', [jiff, 'number', msg], 2);
      msg = JSON.stringify(msg);

      // Setup deferreds to handle receiving the triplets later.
      var shares = [];
      for (i = 0; i < options.count; i++) {
        var deferred = new Deferred();
        jiff.deferreds[number_id + ':' + i] = deferred;
        shares[i] = jiff.secret_share(jiff, false, deferred.promise, undefined, receivers_list, threshold, Zp, number_id + ':' + i, options.ratios);
      }

      // Send a request to the server.
      if (jiff.id === 's1') {
        jiff.socket.safe_emit('number', msg);
      } else {
        var cipher = jiff.hooks.encryptSign(jiff, msg, jiff.keymap['s1'], jiff.secret_key);
        jiff.socket.safe_emit('number', JSON.stringify(cipher));
      }

      return shares;
    }

    jiff.server_generate_and_share = function (options, receivers_list, threshold, Zp, number_id) {
      return jiff_server_share_number(jiff, options, receivers_list, threshold, Zp, number_id);
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