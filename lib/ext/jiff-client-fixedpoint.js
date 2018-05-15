
/**
 * This defines a library module for for fixed point arithmetic in JIFF.
 * This wraps and exposes the jiff_fixedpoint API. Exposed members can be accessed with jiff_fixedpoint.&lt;member-name&gt;
 * in browser JS, or by using require('./modules/jiff-client-fixedpoint').&lt;member-name&gt; as usual in nodejs.
 * @namespace jiff
 * @version 1.0
 *
 * DISCLAIMER: can only support 8 bits after the decimal point. This is because the integer divison algorithm used 
 *             requires that twice the number of bits fit within the prime used. Our primse is about 20 bits long,
 *             increasing the prime beyond this point causes javascript to commit crazy arithmetic errors. Hence, the 
 *             8 bits limit. This may be solved by (a) using a better integer divison algorithm (b) using some BigInt 
 *             library with fast arithmetic operations to allow for an increase in the prime size.
 *
 * NOTICE: some additional functions needs to be overriden in order for this to be fully functional, in particular:
 *                  jiff_instance.[coerce_to_share, generate_and_share_random, generate_and_share_zero, server_generate_and_share ]
 *         The modification to those functions is similar to how jiff_instance.share was modified: namely, use the 
 *         original version of the function twice to generate both integer and fractional part, and combine them into
 *         a fixedpoint_secret_share.
 *
 * FEATURES: currently supports secert addition and multiplication only.
 *
 * TO BE IMPLEMENTED: Direct/easy modifications: comparisons and constant versions.
 *                    Harder: fixed-point division.
 *
 * TO MAKE THIS USEFUL: modify jiff-client to allow for either BigInt library/operations or regular javascript numbers,
 *                      and use the BigInt version for this module to increase bit length.
 *
 * MODULE DESIGN INSTRUCTIONS AND EXPLANATION:
 *     1) write a top-level function like the one here: [i.e. (function(exports, node) { .... })(typeof(exports) ....)]
 *        this function acts as a scope for the module, which forbids name conflicts as well as forbid others from
 *        modifying or messing around with the functions and constants inside. Additionally, it makes the code useable 
 *        from the browsers and nodejs
 *
 *     2) In the very last line replace this.jiff_fixedpoint = {} with this.jiff_<module_name> = {}. This is the defacto
 *        name space for this module. Calling code on the user-side will use that name (jiff_<module_name>) to access the
 *        functions you choose to expose. For nodejs the name space will be ignored and calling code can use the object
 *        returned by the require() call corresponding to this module.
 *
 *     3) Inside the top-level function, create a function called make_jiff. The function should take two parameters: 
 *            (a) base_instance, (b) options. 
 *        base_instance: is a basic jiff-client.js instance, you can use this instance
 *            to perform the basic operation that build your modules (sharing of integers, simple operations on ints, etc)
 *        options: should be an object that provides your module with whatever options it requires. The options for
 *            the base_instance will be passed to it prior to calling your modules and will not be inside the options 
 *            object, but you can access them using base_instance.
 *
 *     4) Inside make_jiff, create an empty object that is returned at the end of the function (this will be the instance
 *        your module returns), parse your options, and add a for loop that copies all functions and properties of base_instance 
 *        similar to the one in this file's make_jiff. It is very useful to also store the base_instance inside this object
 *        for ease of access.
 *
 *     5) If you need to override any feature in jiff (change how share work, or how open work, or how beaver_triplets 
 *        work etc), then implement your changes in a sub-function and store it inside your instance. Make sure to 
 *        store it under the same name in the base_instance and documentation so that it overrides the basic implementation.
 *        Dont worry, you will still have access to the basic implementation through the same name but using the base_instance.
 *        MAKE SURE TO USE THE SAME PARAMTERES (ORDER, NAME, TYPE) as in the base_instance and documentation. You may 
 *        use extra parameters at the end (but only if it is a SUPER MUST).
 *
 *     6) If you want to add additional feature that does not override any other feature in jiff, implement that in a
 *        function under a new appropriate name, make sure to document the function properly.
 *
 *     7) If you need any additional helpers or sub-functions, you can implement them either inside make_jiff (without
 *        storing them in the jiff instance), or outside make_jiff and inside the top-level function (similar to
 *        fixedpoint_secret_share here).
 *
 *     4) at the end of the top-level function and after make_jiff is done, make sure to have an 
 *        if(node) { ... } else { ... } block, in which you expose the make_jiff function.
 *
 * If you do the module design carefully, users should be able to mix in different modules together. For example: the
 * client can start with the simple jiff-client instance, pass it to the make_jiff of this fixedpoint library, and
 * pass the resulting instance to make_jiff of a signed numbers library (or vice-versa). The last instance will encompess
 * both the fixedpoint and signed numbers features and effectively allow the client to get support for negative fixedpoint
 * numbers.
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
    var jiff = {};
    jiff.base = base_instance;
        
    // Parse Options
    if(options == null) options = {};
    if(options.bits == null && options.digits == null) options.bits = 8;
    if(options.digits == null) options.digits = Math.floor(options.bits / (Math.log(10) / Math.log(2)));
    if(options.bits == null) options.bits = Math.floor(options.digits * (Math.log(10) / Math.log(2)));
    jiff.options = options;

    // Copy all functions and memebers from base to jiff.
    // The functions that need to be modified will be overriden later.
    for(var key in base_instance) {
      if(!base_instance.hasOwnProperty(key)) continue;
      jiff[key] = base_instance[key];
    }

    // Add module name
    jiff.modules.push('fixedpoint');
    
    // Handle the case if the base instance has bignumber support.
    jiff.hasBigNumber = function() {
      return jiff.base.modules.indexOf("bignumber") > -1;
    }

    jiff.BigNumber = function(n) {
      if(jiff._BigNumber == null) {
        if(node) jiff._BigNumber = require('bignumber.js');
        else jiff._BigNumber = BigNumber;
      }

      return new jiff._BigNumber(n);
    }

    // This is used in arithmetic operations.
    jiff.magnitude = jiff.hasBigNumber() ? jiff.BigNumber(10).pow(jiff.options.digits).floor() : Math.pow(10, jiff.options.digits);

    // Override functions according to this module's functionality.
    jiff.share = function(secret, threshold, receivers_list, senders_list, Zp) {
      // Compute Parts
      var int_part, fraction_part;

      if(jiff.hasBigNumber()) { 
        secret = new BigNumber(secret);     
        int_part = secret.floor();
        fraction_part = secret.minus(int_part).times(jiff.magnitude).floor();
      } else {
        int_part = Math.floor(secret);
        fraction_part = Math.floor((secret - int_part) * jiff.magnitude);
      }

      // Share parts
      var int_parts = base_instance.share(int_part, threshold, receivers_list, senders_list, Zp);
      var fraction_parts = base_instance.share(fraction_part, threshold, receivers_list, senders_list, Zp);
      
      var shares = {};
      for(var i in int_parts) {
        if(!int_parts.hasOwnProperty(i)) continue;
        shares[i] = new fixedpoint_secret_share(jiff, int_parts[i], fraction_parts[i]);
      }
      
      return shares;
    };
    
    jiff.open = function(share, parties) {
      var p1 = base_instance.open(share.int_part, parties);
      var p2 = base_instance.open(share.fraction_part, parties);
      
      return Promise.all([p1, p2]).then(function(results) {
        if(jiff.hasBigNumber)
          return results[0].plus(results[1].div(jiff.magnitude));
        else
          return results[0] + (results[1] / jiff.magnitude);
      });
    };
    
    return jiff;
  }

  // Expose the functions that consitute the API for this module.
  exports.make_jiff = make_jiff;
}((typeof exports == 'undefined' ? this.jiff_fixedpoint = {} : exports), typeof exports != 'undefined'));
