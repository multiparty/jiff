
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
  function fixedpoint_secret_share(fixedpoint_jiff, int_part, fraction_part) {
    var self = this;

    /** @member {jiff-instance} */
    this.jiff = fixedpoint_jiff;
    
    /** @member {share-object} */
    this.int_part = int_part;
    
    /** @member {share-object} */
    this.fraction_part = fraction_part;

    /** @member {boolean} */
    this.ready = (int_part.ready && fraction_part.ready);

    /** @member {promise} */
    this.promise = null;
    if(!int_part.ready && !fraction_part.ready) this.promise = Promise.all([int_part.promise, fraction_part.promise]);
    else if(!int_part.ready) this.promise = int_part.promise;
    else if(!fraction_part.ready) this.promise = fraction_part.promise;
    
    /** @member {array} */
    this.holders = int_part.holders;
    
    /** @member {array} */
    this.threshold = int_part.threshold;
    
    /** @member {number} */
    this.Zp = int_part.Zp;
    
    /** @member {string} */
    this.id = "fixedpoint-share["+ int_part.id + "," + fraction_part.id + "]";
    
    /**
     * Gets a string representation of this share.
     * @method
     * @returns {string} the id and value of the share as a string.
     */
    this.toString = function() {
      var children = "[(" + int_part.toString() + "), (" + fraction_part.toString() + ")]";
      if(self.ready) return self.id + ": " + children;
      else return self.id + ": <deferred>" + children;
    };

    /**
     * Logs an error.
     * @method
     */
    this.error = function() { console.log("Error receiving " + self.toString()); };

    /**
     * Receives the value of this share when ready.
     * @method
     * @param {number} value - the value of the share.
     */
    this.receive_share = function() { self.ready = true; self.promise = null; };
    
    // Update ready according to promise
    if(!self.ready) this.promise.then(this.receive_share, this.error);
    
    /**
     * Addition of two fixedpoint secret shares.
     * @method
     * @param {fixedpoint-share-object} o - the share to add to this share.
     * @return {fixedpoint-share-object} this party's share of the result.
     */
    this.sadd = function(o) {
      // Add int and fraction parts
      var nint_part = self.int_part.sadd(o.int_part);
      var nfraction_part = self.fraction_part.sadd(o.fraction_part);

      // Resolve carry from fraction into int part
      var carry = nfraction_part.cgteq(self.jiff.magnitude);

      nint_part = nint_part.sadd(carry);
      nfraction_part = nfraction_part.ssub(carry.cmult(self.jiff.magnitude));
      return new fixedpoint_secret_share(self.jiff, nint_part, nfraction_part);
    };
    
    /**
     * Multiplication of two fixedpoint secret shares.
     * @method
     * @param {fixedpoint-share-object} o - the share to multiply with this share.
     * @return {fixedpoint-share-object} this party's share of the result.
     */
    this.smult = function(o) {
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
    
    /**
     * Reveals/Opens the value of this share.
     * @method
     * @param {function(number)} success - the function to handle successful open.
     * @param {function(string)} error - the function to handle errors and error messages. [optional]
     * @returns {promise} a (JQuery) promise to the open value of the secret.
     * @throws error if share does not belong to the passed jiff instance.
     */
    this.open = function(success, failure) {
      if(failure == null) failure = self.error;
      var promise = self.jiff.open(self);
      if(promise != null) promise.then(success, failure);
      return promise;
    };
  }
  
  // Take the jiff-client base instance and options for this module, and use them
  // to construct an instance for this module.
  function make_jiff(base_instance, options) {
    // Parse Options
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

    // Add module name 
    base_instance.modules.push("fixedpoint");
    
    // Handle the case if the base instance has bignumber support.
    base_instance.hasBigNumber = function() {
      return base_instance.base.modules.indexOf("bignumber") > -1;
    }

    base_instance.BigNumber = function(n) {
      if(base_instance._BigNumber == null) {
        if(node) base_instance._BigNumber = require('bignumber.js');
        else base_instance._BigNumber = BigNumber;
      }

      return new base_instance._BigNumber(n);
    }

    // This is used in arithmetic operations.
    base_instance.magnitude = function(m) {
      if(base_instance.hasBigNumber())
        base_instance.BigNumber(10).pow(m).floor()

      return Math.pow(10, m);
    }
    
    return base_instance;
  }

  // Expose the functions that consitute the API for this module.
  exports.make_jiff = make_jiff;
}((typeof exports == 'undefined' ? this.jiff_fixedpoint = {} : exports), typeof exports != 'undefined'));
