
/**
 * This defines a library module for for fixed point arithmetic in JIFF.
 * This wraps and exposes the jiff_fixedpoint API. Exposed members can be accessed with jiff_fixedpoint.&lt;member-name&gt;
 * in browser JS, or by using require('./modules/jiff-client-fixedpoint').&lt;member-name&gt; as usual in nodejs.
 *
 * @namespace jiff
 * @version 1.0
 */
(function(exports, node) {
  function max(x, y) {
    return x < y ? x : y;
  }

  function min(x, y) {
    return x > y ? x : y;
  }

  function compute_constant_digits(cst) {
    cst = cst.toString(10);
    var offset = cst.startsWith("-") ? 1 : 0;

    var index = cst.indexOf(".");
    if(index == -1) {
      return { "decimal_digits": 0, "integral_digits": cst.length - offset };
    }

    return {
      "decimal_digits": cst.substring(index+1).length - offset,
      "integral_digits": cst.substring(0, index).length - offset
    };
  }

  // int_part, fraction_part should both be secert shares.
  function createFixedpointSecretShare(jiff_instance, share) {
    share.integral_digits = null; // set right outside this function
    share.decimal_digits = null; // set right outside this function
    share.free_digits = null; // set right outside this function

    share.legacy = {};
    share.legacy.old_cadd = share.cadd;
    share.legacy.old_sadd = share.sadd;
    share.legacy.old_cmult = share.cmult;
    share.legacy.old_cdiv = share.cdiv;
    share.legacy.old_sdiv = share.sdiv;
    
    share.refresh = function(op_id) {
      return share.sadd(share.jiff.server_generate_and_share({"number": 0}, share.holders, share.threshold, share.Zp, op_id, share.decimal_digits, share.integral_digits));
    };

    share.cadd = function(cst) {
      if (!(share.isConstant(cst))) throw "Fixedpoint: parameter should be a number (+)";

      // Compute digit allocation for given constant
      var cst_digits = compute_constant_digits(cst);
      var cst_decimal = cst_digits.decimal_digits;
      var cst_integral = cst_digits.integral_digits;
      var cst_free = share.free_digits + share.decimal_digits + share.integral_digits - cst_decimal - cst_integral;
      
      // if the constant is more accurate than share, additional resolution is ignored, and addition is possible
      // However, if constant is less accurate, we need to increase its resolution if possible to match share
      if(cst_decimal < share.decimal_digits)
        if(cst_free < share.decimal_digits - cst_decimal) // we do not have enough free digits to increase resolution
          throw "Fixedpoint (constant +): Incompatible precision";

      // assertion: we have enough free digits in cst to increase resolution to share.decimal_digits

      var magnitude = jiff_instance.helpers.magnitude(share.decimal_digits);
      cst = jiff_instance.helpers._floor(jiff_instance.helpers._mult(magnitude, cst));

      var result = share.legacy.old_cadd(cst);
      result.integral_digits = share.integral_digits;
      result.decimal_digits = share.decimal_digits;
      result.free_digits = share.free_digits;
      return result;
    }

    share.csub = function(cst) {
      if (!(share.isConstant(cst))) throw "Fixedpoint: parameter should be a number (-)";
      cst = share.jiff.helpers._mult(cst, -1);
      return share.cadd(cst);
    }

    share.sadd = function(o) {
      if (!(o.jiff === share.jiff)) throw "Fixedpoint: shares do not belong to the same instance (+)";
      if (!share.jiff.helpers.Zp_equals(share, o)) throw "Fixedpoint: shares must belong to the same field (+)";

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
        share1 = share1.reduce_resolution(share2.decimal_digits); // TODO implement this: must change digit allocation variables
      }

      // assertion: share1.decimal_digits = share2.decimal_digits

      var result = share1.legacy.old_sadd(share2);
      result.decimal_digits = share1.decimal_digits;
      result.integral_digits = max(share1.integral_digits, share2.integral_digits);
      result.free_digits = min(share1.free_digits, share2.free_digits);
      return result;
    }

    share.cmult = function(cst, cst_decimal_digits) {
      if (!(share.isConstant(cst))) throw "Fixedpoint: parameter should be a number (*)";
      if(cst_decimal_digits == null) cst_decimal_digits = share.decimal_digits;

      var magnitude = jiff_instance.helpers.magnitude(cst_decimal_digits);
      cst = jiff_instance.helpers._floor(jiff_instance.helpers._mult(magnitude, cst));

      var result = share.legacy.old_cmult(cst);
      result.integral_digits = share.integral_digits;
      result.decimal_digits = share.decimal_digits + cst_decimal_digits;
      result.free_digits = share.free_digits - cst_decimal_digits;
      return result;
    }

    share.smult = function(o) {
      if (!(o.jiff === share.jiff)) throw "Fixedpoint: shares do not belong to the same instance (*)";
      if (!share.jiff.helpers.Zp_equals(share, o)) throw "Fixedpoint: shares must belong to the same field (*)";

      var result = share.legacy.old_smult(o);
      result.integral_digits = max(share.integral_digits, o.integral_digits);
      result.decimal_digits = share.decimal_digits + o.decimal_digits;
      result.free_digits = min(share.free_digits, o.free_digits) - max(share.decimal_digits, o.decimal_digits);
      return result;
    }

    return share;
  }

  // Take the jiff-client base instance and options for this module, and use them
  // to construct an instance for this module.
  function make_jiff(base_instance, options) {
    /*
     * PARSE OPTIONS
     */
    if(options == null) options = {};
    if(options.Zp != null) base_instance.Zp = options.Zp;

    base_instance.total_digits = base_instance.helpers.bLog(base_instance.Zp);
    if(base_instance.total_digits.isBigNumber === true) base_instance.total_digits = base_instance.total_digits.floor();
    else base_instance.total_digits = Math.floor(base_instance.total_digits);

    if(options.decimal_digits == null && options.integral_digits == null) {
      options.decimal_digits = Math.floor(base_instance.total_digits / 3);
      options.integral_digits = Math.floor(base_instance.total_digits / 3);
    }
    else if(options.decimal_digits == null) {
      options.decimal_digits = Math.floor((base_instance.total_digits - options.integral_digits) / 2);
    } else if(options.integral_digits == null) {
      options.integral_digits = base_instance.total_digits - 2 * options.decimal_digits;
    }

    base_instance.decimal_digits = options.decimal_digits;
    base_instance.integral_digits = options.integral_digits;
    base_instance.free_digits = base_instance.total_digits - base_instance.decimal_digits - base_instance.integral_digits;
    if(base_instance.free_digits < 0)
      throw "Fixedpoint: Zp is not large enough to fit integral and decimal parts size"

    /*
     * ADD MODULE NAME
     */
    base_instance.modules.push("fixedpoint");

    /*
     * CHECK IF WE ARE ON TOP OF BIGNUMBER.JS
     */
    base_instance.hasBigNumber = function() {
      return base_instance.modules.indexOf("bignumber") > -1;
    };

    base_instance.BigNumber = function(n) {
      if(base_instance._BigNumber == null) {
        if(node) base_instance._BigNumber = require('bignumber.js');
        else base_instance._BigNumber = BigNumber;
      }

      return new base_instance._BigNumber(n);
    };

    /*
     * HELPERS
     */
    // this extension could be built on top of bignumber or on top of plain JS numbers.
    if(!base_instance.hasBigNumber()) {
      base_instance.helpers._add = function(n1, n2) { return n1 + n2; };
      base_instance.helpers._sub = function(n1, n2) { return n1 - n2; };
      base_instance.helpers._mult = function(n1, n2) { return n1 * n2; };
      base_instance.helpers._div = function(n1, n2) { return n1 / n2; };
      base_instance.helpers._floor = function(n1, n2) { return Math.floor(n1); };
    } else {
      base_instance.helpers._add = function(n1, n2) { return (n1.isBigNumber === true ? n1 : base_instance.BigNumber(n1)).plus(n2); };
      base_instance.helpers._sub = function(n1, n2) { return (n1.isBigNumber === true ? n1 : base_instance.BigNumber(n1)).minus(n2); };
      base_instance.helpers._mult = function(n1, n2) { return (n1.isBigNumber === true ? n1 : base_instance.BigNumber(n1)).times(n2); };
      base_instance.helpers._div = function(n1, n2) { return (n1.isBigNumber === true ? n1 : base_instance.BigNumber(n1)).dividedBy(n2); };
      base_instance.helpers._floor = function(n1, n2) { return (n1.isBigNumber === true ? n1 : base_instance.BigNumber(n1)).floor(); };
    }

    base_instance.helpers.magnitude = function(m) {
      if(base_instance.hasBigNumber())
        return base_instance.BigNumber(10).pow(m).floor();

      return Math.pow(10, m);
    };

    base_instance.helpers.fits_in_digits = function(num, decimal_digits, integral_digits) {
      var dec_mag = base_instance.helpers.magnitude(decimal_digits);
      var int_mag = base_instance.helpers.magnitude(integral_digits);

      if(base_instance.hasBigNumber()) {
        var max_in_digits = dec_mag.minus(1).times(int_mag).plus(int_mag.minus(1));
        return !max_in_digits.lt(num);
      }

      else {
        var max_in_digits = (dec_mag - 1) * int_mag + (int_mag-1);
        return num <= max_in_digits;
      }
    };

    base_instance.helpers.allocate_digits = function(Zp, decimal_digits, integral_digits) {
      // Compute the digit allocation
      if(Zp == null) Zp = base_instance.Zp;

      // if Zp is the default Zp, return the default digit allocation
      if(base_instance.Zp == Zp || 
        (hasBigNumber.hasBigNumber && base_instance.Zp.eq(Zp)))
        return {
          "free_digits": base_instance.free_digits,
          "decimal_digits": base_instance.decimal_digits,
          "integral_digits": base_instance.integral_digits
        };

      // Zp is not the default, figure out a balanced digit allocation
      var total_digits = base_instance.helpers.bLog(Zp);

      if(decimal_digits == null && integral_digits) {
        integral_digits = Math.floor(total_digits / 3);
        decimal_digits = Math.floor(total_digits / 3);
      } else if(decimal_digits == null) {
        decimal_digits = Math.floor((total_digits - integral_digits) / 2);
      } else if(integral_digits == null) {
        integral_digits = total_digits - 2 * decimal_digits;
      }

      var free_digits = total_digits - decimal_digits - integral_digits;
      return { "free_digits": free_digits, "decimal_digits": decimal_digits, "integral_digits": integral_digits };
    }

    /* ALTERNATE IMPLEMENTATIONS OF JIFF PRIMTIVES */
    var old_triplet = base_instance.triplet;
    base_instance.triplet = function(receivers_list, threshold, Zp, triplet_id, decimal_digits, integral_digits) {
      // Compute the digit allocation
      var allocation = base_instance.helpers.allocate_digits(Zp, decimal_digits, integral_digits);
      var free_digits = allocation.free_digits;
      decimal_digits = allocation.decimal_digits;
      integral_digits = allocation.integral_digits;

      return old_triplet(receivers_list, threshold, Zp, triplet_id);
    };

    var old_generate_and_share_random = base_instance.generate_and_share_random;
    base_instance.generate_and_share_random = function(threshold, receivers_list, senders_list, Zp, decimal_digits, integral_digits) {
      // Compute the digit allocation
      var allocation = base_instance.helpers.allocate_digits(Zp, decimal_digits, integral_digits);
      var free_digits = allocation.free_digits;
      decimal_digits = allocation.decimal_digits;
      integral_digits = allocation.integral_digits;

      // Detect if digit allocation satisfies the given Zp
      if(free_digits < 0) throw "Fixedpoint generate_and_share_random: not enough bits in Zp!";

      var share = old_generate_and_share_random(threshold, receivers_list, senders_list, Zp);
      share.decimal_digits = decimal_digits;
      share.integral_digits = integral_digits;
      share.free_digits = free_digits;
      return share;
    };

    var old_generate_and_share_zero = base_instance.generate_and_share_zero;
    base_instance.generate_and_share_zero = function(threshold, receivers_list, senders_list, Zp, decimal_digits, integral_digits) {
      // Compute the digit allocation
      var allocation = base_instance.helpers.allocate_digits(Zp, decimal_digits, integral_digits);
      var free_digits = allocation.free_digits;
      decimal_digits = allocation.decimal_digits;
      integral_digits = allocation.integral_digits;

      // Detect if digit allocation satisfies the given Zp
      if(free_digits < 0) throw "Fixedpoint generate_and_share_zero: not enough bits in Zp!";

      var share = old_generate_and_share_zero(threshold, receivers_list, senders_list, Zp);
      share.decimal_digits = decimal_digits;
      share.integral_digits = integral_digits;
      share.free_digits = free_digits;
      return share;
    };

    var old_server_generate_and_share = base_instance.server_generate_and_share;
    base_instance.server_generate_and_share = function(options, receivers_list, threshold, Zp, number_id, decimal_digits, integral_digits) {
      // Compute the digit allocation
      var allocation = base_instance.helpers.allocate_digits(Zp, decimal_digits, integral_digits);
      var free_digits = allocation.free_digits;
      decimal_digits = allocation.decimal_digits;
      integral_digits = allocation.integral_digits;

      // Detect if digit allocation satisfies the given Zp
      if(free_digits < 0) throw "Fixedpoint server_generate_and_share: not enough bits in Zp!";

      var share = old_server_generate_and_share(options, receivers_list, threshold, Zp, number_id);
      share.decimal_digits = decimal_digits;
      share.integral_digits = integral_digits;
      share.free_digits = free_digits;
      return share;
    }
    
    var old_coerce = base_instance.coerce_to_share;
    base_instance.coerce_to_share = function(number, holders, Zp, share_id, decimal_digits, integral_digits) {
      // Compute the digit allocation
      var allocation = base_instance.helpers.allocate_digits(Zp, decimal_digits, integral_digits);
      var free_digits = allocation.free_digits;
      decimal_digits = allocation.decimal_digits;
      integral_digits = allocation.integral_digits;
      
      // Detect if digit allocation satisfies the given Zp and secret
      if(free_digits < 0) throw "Fixedpoint coerce_to_share: not enough bits in Zp!";
      if(!base_instance.helpers.fits_in_digits(number, decimal_digits, integral_digits)) throw "Fixedpoint share: number does not match given digit paramters";

      var share = old_coerce(new BigNumber(number), holders, Zp, share_id);
      share.decimal_digits = decimal_digits;
      share.integral_digits = integral_digits;
      share.free_digits = free_digits;
      return share;
    };

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
     * @param {number}  integral_digits - number of digits for the integral part for which accuracy is preserved. Must be the same accros all parties. [optional]
     * @returns {object} a map (of size equal to the number of parties)
     *          where the key is the party id (from 1 to n)
     *          and the value is the share object that wraps
     *          the value sent from that party (the internal value maybe deferred).
     */
    base_instance.share = function(secret, threshold, receivers_list, senders_list, Zp, share_id, decimal_digits, integral_digits) {
      // Compute the digit allocation
      var allocation = base_instance.helpers.allocate_digits(Zp, decimal_digits, integral_digits);
      var free_digits = allocation.free_digits;
      decimal_digits = allocation.decimal_digits;
      integral_digits = allocation.integral_digits;

      // Detect if digit allocation satisfies the given Zp and secret
      if(free_digits < 0) throw "Fixedpoint share: not enough bits in Zp!";
      if(!base_instance.helpers.fits_in_digits(secret, decimal_digits, integral_digits)) throw "Fixedpoint share: number does not match given digit paramters";

      // Transform secret
      var magnitude = base_instance.helpers.magnitude(decimal_digits);
      secret = base_instance.helpers._mult(magnitude, secret);
      secret = base_instance.helpers._floor(secret);

      // Share
      var result = old_share(secret, threshold, receivers_list, senders_list, Zp, share_id);

      // Track digits allocation inside each share
      for(var key in result) {
        if(!result.hasOwnProperty(key)) continue;
        result[key].decimal_digits = decimal_digits;
        result[key].integral_digits = integral_digits;
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
      return promise.then(function(v) {
        var mod = base_instance.helpers.magnitude(share.decimal_digits + share.integral_digits);
        var magnitude = base_instance.helpers.magnitude(share.decimal_digits);
        return base_instance.helpers._div(base_instance.helpers.mod(v, mod), magnitude);
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
    base_instance.receive_open = function(parties, threshold, Zp, op_ids, decimal_digits, integral_digits) {
      // Compute the digit allocation
      var allocation = base_instance.helpers.allocate_digits(Zp, decimal_digits, integral_digits);
      var free_digits = allocation.free_digits;
      decimal_digits = allocation.decimal_digits;
      integral_digits = allocation.integral_digits;

      // Detect if digit allocation satisfies the given Zp
      if(free_digits < 0) throw "Fixedpoint open: not enough bits in Zp!";

      // Carry out open
      var promise = old_receive_open(parties, threshold, Zp, op_ids);
      return promise.then(function(v) {
        var mod = base_instance.helpers.magnitude(decimal_digits + integral_digits);
        var magnitude = base_instance.helpers.magnitude(share.decimal_digits);
        return base_instance.helpers._div(base_instance.helpers.mod(v, mod), magnitude);
      });
    };

    base_instance.hooks.createSecretShare.push(createFixedpointSecretShare);
    return base_instance;
  }

  // Expose the functions that consitute the API for this module.
  exports.make_jiff = make_jiff;
}((typeof exports == 'undefined' ? this.jiff_fixedpoint = {} : exports), typeof exports != 'undefined'));
