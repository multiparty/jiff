
/**
 * This defines a library module for for fixed point arithmetic in JIFF.
 * This wraps and exposes the jiff_fixedpoint API. Exposed members can be accessed with jiff_fixedpoint.&lt;member-name&gt;
 * in browser JS, or by using require('./modules/jiff-client-fixedpoint').&lt;member-name&gt; as usual in nodejs.
 * 
 * @namespace jiff
 * @version 1.0
 */
(function(exports, node) {
  // int_part, fraction_part should both be secert shares.
  function createFixedpointSecretShare(jiff_instance, share) {
    share.integral_digits = null; // set right outside this function
    share.decimal_digits = null; // set right outside this function
    share.free_digits = null; // set right outside this function

    

    var old_cadd = share.cadd;
    var old_sadd = share.sadd;
    
    share.cadd = function(cst) {
      if (!(share.isConstant(cst))) throw "parameter should be a number (+)";

      var magnitude = jiff_instance.helpers.magnitude(share.decimal_digits);
      cst = jiff_instance.helpers._floor(jiff_instance.helpers._mult(magnitude, cst));

      var result = old_cadd(cst);
      result.integral_digits = share.integral_digits;
      result.decimal_digits = share.decimal_digits;
      result.free_digits = share.free_digits;
      return result;
    }

    share.sadd = function(o) {
      var result = old_sadd(o);
      result.integral_digits = share.integral_digits;
      result.decimal_digits = share.decimal_digits;
      result.free_digits = share.free_digits;
      return result;
    }

/*
    share.smult = function(o) {
      // Multiply int and fraction parts
      var nint_part = self.int_part.smult(o.int_part);
      
      var nfraction_part = self.fraction_part.smult(o.fraction_part).cdiv(self.jiff.magnitude, 2 * self.jiff.options.bits);
      nfraction_part = nfraction_part.sadd(self.int_part.smult(o.fraction_part));
      nfraction_part = nfraction_part.sadd(self.fraction_part.smult(o.int_part));
      
      var carry = nfraction_part.cdiv(self.jiff.magnitude, 2 * self.jiff.options.bits);
      nint_part = nint_part.sadd(carry);
      nfraction_part = nfraction_part.ssub(carry.cmult(self.jiff.magnitude));

      return new fixedpoint_secret_share(self.jiff, nint_part, nfraction_part);
    };
*/
  
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
      options.decimal_digits = Math.floor(base_instance.total_digits / 2);
      options.integral_digits = Math.ceil(base_instance.total_digits / 2);
    }
    else if(options.decimal_digits == null) options.decimal_digits = base_instance.total_digits - options.integral_digits;
    else if(options.integral_digits == null) options.integral_digits = base_instance.total_digits - options.decimal_digits;

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
    
    /* ALTERNATE IMPLEMENTATIONS OF JIFF PRIMTIVES */
    // TODO: coerce_share, server_generate_and_share, etc
    // TODO: check if server extension is needed (probably not)
    // var old_coerce = base_instance.coerce_to_share;
    // base_instance.coerce_to_share = function(number, holders, Zp, share_id) { return old_coerce(new BigNumber(number), holders, Zp, share_id); };

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
      if(decimal_digits == null && integral_digits == null) {
        decimal_digits = base_instance.decimal_digits;
        integral_digits = base_instance.integral_digits;
      }
      else if(decimal_digits == null) decimal_digits = base_instance.total_digits - integral_digits;
      else if(integral_digits == null) integral_digits = base_instance.total_digits - decimal_digits;

      if(Zp == null) Zp = base_instance.Zp;
      free_digits = base_instance.helpers.bLog(Zp) - decimal_digits - integral_digits;

      // Detect if digit allocation satisfies the given Zp and secret
      if(free_digits < 0) throw "Fixedpoint Share: not enough bits in Zp!";
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
     *                                        TODO: automate this for the described scenario.
     * @returns {promise} a (JQuery) promise to the open value of the secret.
     * @throws error if share does not belong to the passed jiff instance.
     */
    base_instance.open = function(share, parties, op_ids) {
      var promise = old_open(share, parties, op_ids);
      return promise.then(function(v) {
        var magnitude = base_instance.helpers.magnitude(share.decimal_digits);
        return base_instance.helpers._div(v, magnitude);
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
    base_instance.receive_open = function(parties, threshold, Zp, op_ids, decimal_digits) {
      if(decimal_digits == null) decimal_digits = base_instance.decimal_digits;
      var promise = old_receive_open(parties, threshold, Zp, op_ids);
      return promise.then(function(v) {
        var magnitude = base_instance.helpers.magnitude(share.decimal_digits);
        return base_instance.helpers._div(v, magnitude);
      });
    };

    base_instance.hooks.createSecretShare.push(createFixedpointSecretShare);
    return base_instance;
  }

  // Expose the functions that consitute the API for this module.
  exports.make_jiff = make_jiff;
}((typeof exports == 'undefined' ? this.jiff_fixedpoint = {} : exports), typeof exports != 'undefined'));
