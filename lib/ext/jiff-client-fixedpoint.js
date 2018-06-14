
/**
 * This defines a library module for for fixed point arithmetic in JIFF.
 * This wraps and exposes the jiff_fixedpoint API. Exposed members can be accessed with jiff_fixedpoint.&lt;member-name&gt;
 * in browser JS, or by using require('./modules/jiff-client-fixedpoint').&lt;member-name&gt; as usual in nodejs.
 *
 * @namespace jiff
 * @version 1.0
 */
(function(exports, node) {
  function min(x, y) {
    return x < y ? x : y;
  }

  function max(x, y) {
    return x > y ? x : y;
  }

  function compute_constant_digits(cst) {
    cst = cst.toString(10);
    var offset = cst.startsWith("-") ? 1 : 0;

    var index = cst.indexOf(".");
    if(index == -1) {
      return { "decimal_digits": 0, "integer_digits": cst.length - offset };
    }

    return {
      "decimal_digits": cst.substring(index+1).length - offset,
      "integer_digits": cst.substring(0, index).length - offset
    };
  }

  // int_part, fraction_part should both be secert shares.
  function createFixedpointSecretShare(jiff_instance, share) {
    share.integer_digits = null; // set right outside this function
    share.decimal_digits = null; // set right outside this function
    share.free_digits = null; // set right outside this function

    share.legacy = {};
    share.legacy.old_cadd = share.cadd;
    share.legacy.old_csub = share.csub;
    share.legacy.old_cmult = share.cmult;
    
    share.legacy.old_sadd = share.sadd;
    share.legacy.old_ssub = share.ssub;
    share.legacy.old_smult = share.smult;
    share.legacy.old_slt = share.slt;
    share.legacy.old_clt = share.clt;
    share.legacy.old_cgt = share.cgt;
    share.legacy.old_sdiv = share.sdiv;
    share.legacy.old_cdiv = share.cdiv;
    share.legacy.old_lt_halfprime = share.lt_halfprime;

    share.reduce_resolution = function(new_decimal_digits) {
      if(new_decimal_digits > share.decimal_digits) throw "Fixedpoint: reduce_resolution attempts to increase resolution"
      if(new_decimal_digits == share.decimal_digits) return share;

      var total = share.decimal_digits + share.integer_digits + share.free_digits;
      var diff = share.decimal_digits - new_decimal_digits;
      var magnitude = jiff_instance.helpers.magnitude(diff);
      
      // Forget about accuracies, do simple division as if everything is integers
      var share_tmp = [share.decimal_digits, share.integer_digits, share.free_digits];
      share.decimal_digits = 0; share.integer_digits = total; share.free_digits = 0;

      var result = share.legacy.old_cdiv(magnitude);

      // restore accuracies
      share.decimal_digits = share_tmp[0]; share.integer_digits = share_tmp[1]; share.free_digits = share_tmp[2];

      result.decimal_digits = share.decimal_digits - diff;
      result.integer_digits = share.integer_digits;
      result.free_digits = share.free_digits + diff;
      return result;
    }

    share.increase_resolution = function(new_decimal_digits) {
      if(new_decimal_digits < share.decimal_digits) throw "Fixedpoint: increase_resolution attempts to reduce resolution"
      if(new_decimal_digits == share.decimal_digits) return share;

      var total = share.decimal_digits + share.integer_digits + share.free_digits;
      var diff = new_decimal_digits - share.decimal_digits;
      var magnitude = jiff_instance.helpers.magnitude(diff);
      
      var result = share.legacy.old_cmult(magnitude);

      result.decimal_digits = share.decimal_digits + diff;
      result.integer_digits = share.integer_digits;
      result.free_digits = share.free_digits - diff;
      return result;
    }

    share.refresh = function(op_id) {
      return share;
//     var mask = share.jiff.server_generate_and_share({"number": 0}, share.holders, share.threshold, share.Zp, op_id, share.decimal_digits, share.integer_digits);
//     return share.sadd(mask);
    };

    share.cadd = function(cst) {
      if (!(share.isConstant(cst))) throw "Fixedpoint: parameter should be a number (+)";

      // Compute digit allocation for given constant
      var cst_digits = compute_constant_digits(cst);
      var cst_decimal = cst_digits.decimal_digits;
      var cst_integer = cst_digits.integer_digits;
      var cst_free = share.free_digits + share.decimal_digits + share.integer_digits - cst_decimal - cst_integer;
      
      // if the constant is more accurate than share, additional resolution is ignored, and addition is possible
      // However, if constant is less accurate, we need to increase its resolution if possible to match share
      if(cst_decimal < share.decimal_digits)
        if(cst_free < share.decimal_digits - cst_decimal) // we do not have enough free digits to increase resolution
          throw "Fixedpoint (constant +): Incompatible precision";
        else
          cst_free = cst_free - (share.decimal_digits - cst_decimal);

      else if(cst_decimal > share.decimal_digits)
        cst_free = cst_free + (cst_decimal - share.decimal_digits);

      // assertion: we have enough free digits in cst to increase resolution to share.decimal_digits

      var magnitude = jiff_instance.helpers.magnitude(share.decimal_digits);
      cst = magnitude.times(cst).floor();

      var result = share.legacy.old_cadd(cst);
      result.integer_digits = max(share.integer_digits, cst_integer);
      result.decimal_digits = share.decimal_digits;
      result.free_digits = min(share.free_digits, cst_free);
      return result;
    };

    share.csub = function(cst) {
      if (!(share.isConstant(cst))) throw "Fixedpoint: parameter should be a number (-)";
      cst = share.jiff.helpers.BigNumber(cst).times(-1);
      return share.cadd(cst);
    };

    share.sadd = function(o) {
      if (!(o.jiff === share.jiff)) throw "Fixedpoint: shares do not belong to the same instance (+)";
      if (!share.jiff.helpers.Zp_equals(share, o)) throw "Fixedpoint: shares must belong to the same field (+)";
      if (!share.jiff.helpers.array_equals(share.holders, o.holders)) throw "shares must be held by the same parties (+)";

      // enforce share1.decimal_digits >= share2.decimal_digits
      var share1 = share;
      var share2 = o;
      var decimal_accuracy_difference = share1.decimal_digits - share2.decimal_digits;
      if(decimal_accuracy_difference < 0) {
        var tmp = share1;
        share1 = share2;
        share2 = tmp;
        decimal_accuracy_difference = -1 * decimal_accuracy_difference;
      }

      // must decrease share1 resolution to match share2
      // answer is guaranteed accuracy up to the LOWEST resolution/precision
      if(decimal_accuracy_difference != 0) {
        /*var magnitude = jiff_instance.helpers.magnitude(decimal_accuracy_difference);
        share2 = share2.legacy.old_cmult(magnitude);
        share2.decimal_digits = share1.decimal_digits;
        share2.free_digits = share2.free_digits - decimal_accuracy_difference; */
        // IF THINGS ARE BREAKING IN ADDITION: UNCOMMENT THIS and comment the line directly below
        share1 = share1.reduce_resolution(share2.decimal_digits);
      }

      // assertion: share1.decimal_digits = share2.decimal_digits

      var result = share1.legacy.old_sadd(share2);
      result.decimal_digits = share1.decimal_digits;
      result.integer_digits = max(share1.integer_digits, share2.integer_digits);
      result.free_digits = min(share1.free_digits, share2.free_digits);
      return result;
    };

    share.ssub = function(o) {
      if (!(o.jiff === share.jiff)) throw "Fixedpoint: shares do not belong to the same instance (-)";
      if (!share.jiff.helpers.Zp_equals(share, o)) throw "Fixedpoint: shares must belong to the same field (-)";
      if (!share.jiff.helpers.array_equals(share.holders, o.holders)) throw "shares must be held by the same parties (-)";
      return share.sadd(o.cmult(-1));
    };

    share.cmult = function(cst) {
      if (!(share.isConstant(cst))) throw "Fixedpoint: parameter should be a number (*)";
      console.log("HELLo");
       try {
      // Compute digit allocation for given constant
      var cst_digits = compute_constant_digits(cst);
      var cst_decimal = cst_digits.decimal_digits;
      var cst_integer = cst_digits.integer_digits;
      var cst_free = share.free_digits + share.decimal_digits + share.integer_digits - cst_decimal - cst_integer;

      var magnitude = jiff_instance.helpers.magnitude(cst_decimal);
      cst = magnitude.times(cst).floor();

      var result = share.legacy.old_cmult(cst);
      result.integer_digits = max(share.integer_digits, cst_integer);
      result.decimal_digits = share.decimal_digits + cst_decimal;
      result.free_digits = share.free_digits + share.decimal_digits + share.integer_digits - result.integer_digits - result.decimal_digits;
      return result.reduce_resolution(share.decimal_digits); } catch(err) {console.log(err);}
    };

    share.smult = function(o) {
      if (!(o.jiff === share.jiff)) throw "Fixedpoint: shares do not belong to the same instance (*)";
      if (!share.jiff.helpers.Zp_equals(share, o)) throw "Fixedpoint: shares must belong to the same field (*)";
      if (!share.jiff.helpers.array_equals(share.holders, o.holders)) throw "shares must be held by the same parties (*)";

      // Forget all about decimal points and accuracies for now
      // Execute multiplication as if regular integers
      var share_tmp = [share.decimal_digits, share.integer_digits, share.free_digits];
      var o_tmp = [o.decimal_digits, o.integer_digits, o.free_digits];
      var total = share.decimal_digits + share.integer_digits + share.free_digits;

      share.decimal_digits = 0; share.integer_digits = total; share.free_digits = 0;
      o.decimal_digits = 0; o.integer_digits = total; o.free_digits = 0;
      
      var result = share.legacy.old_smult(o);

      // restore accuracies
      share.decimal_digits = share_tmp[0]; share.integer_digits = share_tmp[1]; share.free_digits = share_tmp[2];
      o.decimal_digits = o_tmp[0]; o.integer_digits = o_tmp[1]; o.free_digits = o_tmp[2];

      // compute result's accuracy
      result.integer_digits = max(share.integer_digits, o.integer_digits);
      result.decimal_digits = share.decimal_digits + o.decimal_digits;
      result.free_digits = total - result.integer_digits - result.decimal_digits;
      return result.reduce_resolution(max(share.decimal_digits, o.decimal_digits));
    };

    share.sgteq = function(o, l, op_id) {
      if (!(o.jiff === share.jiff)) throw "shares do not belong to the same instance (>=)";
      if (!share.jiff.helpers.Zp_equals(share, o)) throw "shares must belong to the same field (>=)";
      if (!share.jiff.helpers.array_equals(share.holders, o.holders)) throw "shares must be held by the same parties (>=)";
      
      // rename share so that it does not cause unintended changes
      var self = share;

      // share has higher resolution
      if(self.decimal_digits > o.decimal_digits) {
        // Option 1: try to increase o's resolution
        if(o.free_digits >= self.decimal_digits - o.decimal_digits) {
          var magnitude = jiff_instance.helpers.magnitude(self.decimal_digits - o.decimal_digits);
          o = o.old_cmult(magnitude);
          o.decimal_digits = o.decimal_digits + (self.decimal_digits - o.decimal_digits);
          o.free_digits = o.free_digits - (self.decimal_digits - o.decimal_digits);
        }
        // Option 2: reduces self's accuracy to match o
        else // this is ok, since it will not affect the result of >=
          self = self.reduce_resolution(o.decimal_digits);
      }

      else if(self.decimal_digits < o.decimal_digits) {
        // Option 1: increase self's resolution
        if(self.free_digits >= o.decimal_digits - self.decimal_digits) {
          var magnitude = jiff_instance.helpers.magnitude(o.decimal_digits - self.decimal_digits);
          self = self.old_cmult(magnitude);
          self.decimal_digits = self.decimal_digits + (o.decimal_digits - self.decimal_digits);
          self.free_digits = self.free_digits - (o.decimal_digits - self.decimal_digits);
        }
        // Option 2: cannot reduce resolution here without possibily getting incorrect answer
        else
          throw "Fixedpoint (Comparison): Incompatible Precision";
      }

      // assertion: self.decimal_digits = o.decimal_digits

      // Forget all about decimal points and accuracies for now
      // Execute comparison as if regular integers
      var self_tmp = [self.decimal_digits, self.integer_digits, self.free_digits];
      var o_tmp = [o.decimal_digits, o.integer_digits, o.free_digits];
      var total = self.decimal_digits + self.integer_digits + self.free_digits;

      self.decimal_digits = 0; self.integer_digits = total; self.free_digits = 0;
      o.decimal_digits = 0; o.integer_digits = total; o.free_digits = 0;

      var result = self.legacy.old_sgteq(o, l, op_id);

      // restore accuracies
      self.decimal_digits = self_tmp[0]; self.integer_digits = self_tmp[1]; self.free_digits = self_tmp[2];
      o.decimal_digits = o_tmp[0]; o.integer_digits = o_tmp[1]; o.free_digits = o_tmp[2];

      result.free_digits = total - 1;
      result.decimal_digits = 0;
      result.integer_digits = 1;
      return result;
      //return result.increase_resolution(max(self.decimal_digits, o.decimal_digits));
    };

    share.sdiv = function(o, l, op_id) {
      throw "Fixedpoint: DIV NOT YET SUPPORTED";
      /*
      if (!(o.jiff === self.jiff)) throw "shares do not belong to the same instance (!=)";
      if (!self.jiff.helpers.Zp_equals(self, o)) throw "shares must belong to the same field (!=)";
      if (!self.jiff.helpers.array_equals(self.holders, o.holders)) throw "shares must be held by the same parties (!=)";

      // Forget all about decimal points and accuracies for now
      // Execute division as if regular integers
      var share_tmp = [share.decimal_digits, share.integer_digits, share.free_digits];
      var o_tmp = [o.decimal_digits, o.integer_digits, o.free_digits];
      var total = share.decimal_digits + share.integer_digits + share.free_digits;

      share.decimal_digits = 0; share.integer_digits = total; share.free_digits = 0;
      o.decimal_digits = 0; o.integer_digits = total; o.free_digits = 0;
      
      var result = share.legacy.old_sdiv(o);

      // restore accuracies
      share.decimal_digits = share_tmp[0]; share.integer_digits = share_tmp[1]; share.free_digits = share_tmp[2];
      o.decimal_digits = o_tmp[0]; o.integer_digits = o_tmp[1]; o.free_digits = o_tmp[2];

      result.decimal_digits = share.decimal_digits - o.decimal_digits;
      result.integer_digits = max(share.integer_digits, o.integer_digits);
      result.free_digits = total - result.decimal_digits - result.integer_digits;
      return result;
      */
    };

    self.cdiv = function(cst, op_id) {
      if (!(self.isConstant(cst))) throw "parameter should be a number (/)";

      if(op_id == null)
        op_id = self.jiff.counters.gen_op_id("c/", self.holders);

      // Allocate share for result to which the answer will be resolved once available
      var final_deferred = $.Deferred();
      var final_promise = final_deferred.promise();
      var result = self.jiff.secret_share(self.jiff, false, final_promise, undefined, self.holders, self.threshold, self.Zp, "share:" + op_id);

      var ZpOVERc = self.Zp.div(cst).floor();

      // add uniform noise to self so we can open
      var nOVERc = self.jiff.server_generate_and_share( { "max":  ZpOVERc } );
      var nMODc = self.jiff.server_generate_and_share( { "max": cst } );
      var noise = nOVERc.cmult(cst).sadd(nMODc);

      var noisyX = self.sadd(noise);
      self.jiff.open(noisyX, noisyX.holders, op_id+":open").then(function(noisyX) {
        var wrapped = self.cgt(noisyX, op_id+":wrap_cgt"); // 1 => x + noise wrapped around Zp, 0 otherwise

        // if we did not wrap
        var noWrapDiv = noisyX.div(cst).floor();
        var unCorrectedQuotient = nOVERc.cmult(-1).cadd(noWrapDiv).csub(1);
        var verify = self.ssub(unCorrectedQuotient.cmult(cst));
        var isNotCorrect = verify.cgteq(cst, op_id+":cor1");
        var noWrapAnswer = unCorrectedQuotient.sadd(isNotCorrect); // if incorrect => isNotCorrect = 1 => quotient = unCorrectedQuotient - 1

        // if we wrapped
        var wrapDiv = noisyX.plus(self.Zp).div(cst).floor();
        unCorrectedQuotient = nOVERc.cmult(-1).cadd(wrapDiv).csub(1);
        verify = self.ssub(unCorrectedQuotient.cmult(cst));
        isNotCorrect = verify.cgteq(cst, op_id+":cor2");
        var wrapAnswer = unCorrectedQuotient.sadd(isNotCorrect); // if incorrect => isNotCorrect = 1 => quotient = unCorrectedQuotient - 1

        var answer = noWrapAnswer.sadd(wrapped.smult(wrapAnswer.ssub(noWrapAnswer), op_id+":smult"));

        if(answer.ready) final_deferred.resolve(answer.value);
        else answer.promise.then(function() { final_deferred.resolve(answer.value); });
      });

      // special case, if result is zero, sometimes we will get to -1 due to how correction happens aboe (.csub(1) and then compare)
      var zeroIt = self.clt(cst, op_id+":zero_check").not();
      return result.smult(zeroIt, op_id+":zero_it");
    };

    return share;
  }

  // Take the jiff-client base instance and options for this module, and use them
  // to construct an instance for this module.
  function make_jiff(base_instance, options) {
    if(base_instance.modules.indexOf("bignumber") == -1) {
      throw "Fixedpoint extension must be applied on top of bignumber extension.";
    }

    /*
     * PARSE OPTIONS
     */
    if(options == null) options = {};
    if(options.Zp != null) base_instance.Zp = options.Zp;

    base_instance.total_digits = Math.floor(base_instance.helpers.bLog(base_instance.Zp));

    if(options.decimal_digits == null && options.integer_digits == null) {
      options.decimal_digits = Math.floor(base_instance.total_digits / 3);
      options.integer_digits = Math.floor(base_instance.total_digits / 3);
    }
    else if(options.decimal_digits == null) {
      options.decimal_digits = Math.floor((base_instance.total_digits - options.integer_digits) / 2);
    } else if(options.integer_digits == null) {
      options.integer_digits = base_instance.total_digits - 2 * options.decimal_digits;
    }

    base_instance.decimal_digits = options.decimal_digits;
    base_instance.integer_digits = options.integer_digits;
    base_instance.free_digits = base_instance.total_digits - base_instance.decimal_digits - base_instance.integer_digits;
    if(base_instance.free_digits < 0)
      throw "Fixedpoint: Zp is not large enough to fit integer and decimal parts size"

    /*
     * ADD MODULE NAME
     */
    base_instance.modules.push("fixedpoint");

    /*
     * HELPERS
     */
    base_instance.helpers.magnitude = function(m) {
      return base_instance.helpers.BigNumber(10).pow(m).floor();
    };

    base_instance.helpers.fits_in_digits = function(num, decimal_digits, integer_digits) {
      var dec_mag = base_instance.helpers.magnitude(decimal_digits);
      var int_mag = base_instance.helpers.magnitude(integer_digits);
      var max_in_digits = dec_mag.minus(1).times(int_mag).plus(int_mag.minus(1));
      return !max_in_digits.lt(num);
    };

    base_instance.helpers.allocate_digits = function(Zp, decimal_digits, integer_digits) {
      // Compute the digit allocation
      if(Zp == null) Zp = base_instance.Zp;

      // if Zp is the default Zp, return the default digit allocation
      if(decimal_digits == null && integer_digits == null && base_instance.Zp.eq(Zp))
        return {
          "free_digits": base_instance.free_digits,
          "decimal_digits": base_instance.decimal_digits,
          "integer_digits": base_instance.integer_digits
        };

      // Zp is not the default, figure out a balanced digit allocation
      var total_digits = Math.floor(base_instance.helpers.bLog(Zp));

      if(decimal_digits == null && integer_digits == null) {
        integer_digits = Math.floor(total_digits / 3);
        decimal_digits = Math.floor(total_digits / 3);
      } else if(decimal_digits == null) {
        decimal_digits = Math.floor((total_digits - integer_digits) / 2);
      } else if(integer_digits == null) {
        integer_digits = total_digits - 2 * decimal_digits;
      }

      var free_digits = total_digits - decimal_digits - integer_digits;
      return { "free_digits": free_digits, "decimal_digits": decimal_digits, "integer_digits": integer_digits };
    };

    /* ALTERNATE IMPLEMENTATIONS OF JIFF PRIMTIVES */
    var old_triplet = base_instance.triplet;
    base_instance.triplet = function(receivers_list, threshold, Zp, triplet_id) {
      var total_digits = Math.floor(base_instance.helpers.bLog(Zp));
      var triplet = old_triplet(receivers_list, threshold, Zp, triplet_id);

      triplet[0].decimal_digits = 0; triplet[0].integer_digits = total_digits; triplet[0].free_digits = 0;
      triplet[1].decimal_digits = 0; triplet[1].integer_digits = total_digits; triplet[1].free_digits = 0;
      triplet[2].decimal_digits = 0; triplet[2].integer_digits = total_digits; triplet[2].free_digits = 0;
      return triplet;
    };

    var old_generate_and_share_random = base_instance.protocols.generate_and_share_random;
    base_instance.protocols.generate_and_share_random = function(threshold, receivers_list, senders_list, Zp, decimal_digits, integer_digits) {
      // Compute the digit allocation
      var allocation = base_instance.helpers.allocate_digits(Zp, decimal_digits, integer_digits);
      var free_digits = allocation.free_digits;
      decimal_digits = allocation.decimal_digits;
      integer_digits = allocation.integer_digits;

      // Detect if digit allocation satisfies the given Zp
      if(free_digits < 0) throw "Fixedpoint generate_and_share_random: not enough bits in Zp!";

      var share = old_generate_and_share_random(threshold, receivers_list, senders_list, Zp);
      share.decimal_digits = decimal_digits;
      share.integer_digits = integer_digits;
      share.free_digits = free_digits;
      return share;
    };

    var old_generate_and_share_zero = base_instance.protocols.generate_and_share_zero;
    base_instance.protocols.generate_and_share_zero = function(threshold, receivers_list, senders_list, Zp, decimal_digits, integer_digits) {
      // Compute the digit allocation
      var allocation = base_instance.helpers.allocate_digits(Zp, decimal_digits, integer_digits);
      var free_digits = allocation.free_digits;
      decimal_digits = allocation.decimal_digits;
      integer_digits = allocation.integer_digits;

      // Detect if digit allocation satisfies the given Zp
      if(free_digits < 0) throw "Fixedpoint generate_and_share_zero: not enough bits in Zp!";

      var share = old_generate_and_share_zero(threshold, receivers_list, senders_list, Zp);
      share.decimal_digits = decimal_digits;
      share.integer_digits = integer_digits;
      share.free_digits = free_digits;
      return share;
    };

    var old_server_generate_and_share = base_instance.server_generate_and_share;
    base_instance.server_generate_and_share = function(options, receivers_list, threshold, Zp, number_id, decimal_digits, integer_digits) {
      // Compute the digit allocation
      var allocation = base_instance.helpers.allocate_digits(Zp, decimal_digits, integer_digits);
      var free_digits = allocation.free_digits;
      decimal_digits = allocation.decimal_digits;
      integer_digits = allocation.integer_digits;

      var share = old_server_generate_and_share(options, receivers_list, threshold, Zp, number_id);
      share.decimal_digits = decimal_digits;
      share.integer_digits = integer_digits;
      share.free_digits = free_digits;
      return share;
    }

    var old_share = base_instance.share;
    /**
     * Share a secret input.
     * @method share
     * @memberof jiff.jiff-instance
     * @instance
     * @param {number} secret - the number to share (this party's input).
     * @param {number} threshold - the minimimum number of parties needed to reconstruct the secret, defaults to all the recievers. [optional]
     * @param {array} receivers_list - array of party ids to share with, by default, this includes all parties. [optional]
     * @param {array} senders_list - array of party ids to receive from, by default, this includes all parties. [optional]
     * @param {number} Zp - the modulos (if null then the default Zp for the instance is used). [optional]
     * @param {string/number} share_id - the tag used to tag the messages sent by this share operation, this tag is used
     *                                   so that parties distinguish messages belonging to this share operation from other
     *                                   share operations between the same parties (when the order of execution is not
     *                                   deterministic). An automatic id is generated by increasing a local counter, default
     *                                   ids suffice when all parties execute all sharing operations with the same senders
     *                                   and receivers in the same order. [optional]
     * @param {number}  decimal_digits - number of digits for the decimal (after the decimal point) part for which the share and result of
     *                                   operating on the share is guaranteed accuracy. Must be the same accros all parties. [optional]
     * @param {number}  integer_digits - number of digits for the integer part for which accuracy is preserved. Must be the same accros all parties. [optional]
     * @returns {object} a map (of size equal to the number of parties)
     *          where the key is the party id (from 1 to n)
     *          and the value is the share object that wraps
     *          the value sent from that party (the internal value maybe deferred).
     */
    base_instance.share = function(secret, threshold, receivers_list, senders_list, Zp, share_id, decimal_digits, integer_digits) {
      // Compute the digit allocation
      var allocation = base_instance.helpers.allocate_digits(Zp, decimal_digits, integer_digits);
      var free_digits = allocation.free_digits;
      decimal_digits = allocation.decimal_digits;
      integer_digits = allocation.integer_digits;
      // Detect if digit allocation satisfies the given Zp and secret
      if(free_digits < 0) throw "Fixedpoint share: not enough bits in Zp!";
      if(!base_instance.helpers.fits_in_digits(secret, decimal_digits, integer_digits)) throw "Fixedpoint share: number does not match given digit paramters";

      // Transform secret
      var magnitude = base_instance.helpers.magnitude(decimal_digits);
      secret = magnitude.times(secret).floor();

      // Share
      var result = old_share(secret, threshold, receivers_list, senders_list, Zp, share_id);

      // Track digits allocation inside each share
      for(var key in result) {
        if(!result.hasOwnProperty(key)) continue;
        result[key].decimal_digits = decimal_digits;
        result[key].integer_digits = integer_digits;
        result[key].free_digits = free_digits;
      }
      return result;
    };

    var old_open = base_instance.open;
    /**
     * Open a secret share to reconstruct secret, resulting value will be a floating number with accuracy matching that of the share.
     * @method open
     * @memberof jiff.jiff-instance
     * @instance
     * @param {share-object} share - this party's share of the secret to reconstruct.
     * @param {array} parties - an array with party ids (1 to n) of receiving parties. [optional]
     * @param {string/number/object} op_ids - an optional mapping that specifies the ID/Tag associated with each
     *                                        open message sent.
     *                                        If this is an object, then it should map an id of a receiving parties
     *                                        to the op_id that should be used to tag the message sent to that party.
     *                                        Parties left unmapped by this object will get an automatically generated id.
     *                                        If this is a number/string, then it will be used as the id tagging all messages
     *                                        sent by this open to all parties.
     *                                        You can saftly ignore this unless you have multiple opens each containing other opens.
     *                                        In that case, the order by which these opens are executed is not fully deterministic
     *                                        and depends on the order of arriving messages. In this case, use this parameter
     *                                        with every nested_open, to ensure ids are unique and define a total ordering on
     *                                        the execution of the opens (check implementation of sgteq for an example).
     * @returns {promise} a (JQuery) promise to the open value of the secret.
     * @throws error if share does not belong to the passed jiff instance.
     */
    base_instance.open = function(share, parties, op_ids) {
      var promise = old_open(share, parties, op_ids);
      if(promise == null) return null;

      // TODO: think whether this is appropriate as a hook (as well as share)
      return promise.then(function(v) {
        var max_value = base_instance.helpers.magnitude(share.decimal_digits + share.integer_digits);
        if(v.gte(max_value))
          throw "Fixedpoint: open result is not accurate: integer part grew too big.";

        var magnitude = base_instance.helpers.magnitude(share.decimal_digits);
        return v / magnitude;
      });
    };

    var old_receive_open = base_instance.receive_open;
    /**
     * Receive shares from the specified parties and reconstruct their secret.
     * Use this function in a party that will receive some answer/value but does not have a share of it.
     * @method receive_open
     * @memberof jiff.jiff-instance
     * @instance
     * @param {array} parties - an array with party ids (1 to n) specifying the parties sending the shares.
     * @param {number} threshold - the minimimum number of parties needed to reconstruct the secret, defaults to all the senders. [optional]
     * @param {number} Zp - the modulos (if null then the default Zp for the instance is used). [optional]
     * @param {string/number/object} op_ids - same as jiff.jiff-instance.open(..)
     * @param {number} decimal_digits - number of digits for the decimal (after the decimal point) part for which the share and result of
     *                                  operating on the share is guaranteed accuracy. Must be the same accros all parties. [optional]
     * @returns {promise} a (JQuery) promise to the open value of the secret.
     */
    base_instance.receive_open = function(parties, threshold, Zp, op_ids, decimal_digits, integer_digits) {
      // Compute the digit allocation
      var allocation = base_instance.helpers.allocate_digits(Zp, decimal_digits, integer_digits);
      var free_digits = allocation.free_digits;
      decimal_digits = allocation.decimal_digits;
      integer_digits = allocation.integer_digits;

      // Detect if digit allocation satisfies the given Zp
      if(free_digits < 0) throw "Fixedpoint: receive open: not enough bits in Zp!";

      // Carry out open
      var promise = old_receive_open(parties, threshold, Zp, op_ids);
      return promise.then(function(v) {
        var max_value = base_instance.helpers.magnitude(decimal_digits + integer_digits);
        if(v.gte(max_value))
          throw "Fixedpoint: open result is not accurate: integer part grew too big.";

        var magnitude = base_instance.helpers.magnitude(decimal_digits);
        return v / magnitude;
      });
    };

    base_instance.hooks.createSecretShare.push(createFixedpointSecretShare);
    return base_instance;
  }

  // Expose the functions that consitute the API for this module.
  exports.make_jiff = make_jiff;
}((typeof exports == 'undefined' ? this.jiff_fixedpoint = {} : exports), typeof exports != 'undefined'));
