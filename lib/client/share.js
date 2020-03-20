var genericProtocols = require('./protocols/generic.js');
var arithmetic = require('./protocols/numbers/arithmetic.js');
var comparison = require('./protocols/numbers/comparison.js');
var protocols = require('./protocols/numbers/protocols.js');
var booleans = require('./protocols/booleans/boolean.js');

// a metaclass that creates SecretShare classes when given a jiff instance
// alternatively, we can think of this as a factory for a secret share prototypes/constructors given a jiff instance
module.exports = function (jiff) {
  // Look at jiff-client#SecretShare
  function SecretShare(value, holders, threshold, Zp) {
    // sort holders
    jiff.helpers.sort_ids(holders);

    /**
     * Indicates if the secret share's value is ready or still a promise
     * @member {boolean} ready
     * @memberof module:jiff-client~JIFFClient#SecretShare
     * @instance
     */
    this.ready = (value.then == null);

    /**
     * The value of the share (or a promise to it)
     * @member {number|promise} value
     * @memberof module:jiff-client~JIFFClient#SecretShare
     * @instance
     */
    this.value = value;

    /**
     * Array of party ids who hold shares of the corresponding secret
     * @member {Array} holders
     * @memberof module:jiff-client~JIFFClient#SecretShare
     * @instance
     */
    this.holders = holders;
    /**
     * The sharing threshold
     * @member {number} threshold
     * @memberof module:jiff-client~JIFFClient#SecretShare
     * @instance
     */
    this.threshold = threshold;

    /**
     * The field prime under which the corresponding secret is shared
     * @member {number} Zp
     * @memberof module:jiff-client~JIFFClient#SecretShare
     * @instance
     */
    this.Zp = Zp;

    // when the promise is resolved, acquire the value of the share and set ready to true
    if (!this.ready) {
      this.value = this.value.then(this.promise_handler.bind(this), this.error.bind(this));
      this.jiff.add_to_barriers(this.value);
    }

    // return the share
    return jiff.hooks.execute_array_hooks('createSecretShare', [jiff, this], 1);
  }

  /**
   * The jiff client instance this share belongs to
   * @member {module:jiff-client~JIFFClient} jiff
   * @memberof module:jiff-client~JIFFClient#SecretShare
   * @instance
   */
  SecretShare.prototype.jiff = jiff;

  // Basic operations in prototype of SecretShare
  /**
   * Gets the value of this share
   * @method valueOf
   * @returns {number} the value (undefined if not ready yet)
   * @memberof module:jiff-client~JIFFClient#SecretShare
   * @instance
   */
  SecretShare.prototype.valueOf = function () {
    if (this.ready) {
      return this.value;
    } else {
      return undefined;
    }
  };

  /**
   * Gets a string representation of this share
   * @method toString
   * @returns {string} the id and value of the share as a string
   * @memberof module:jiff-client~JIFFClient#SecretShare
   * @instance
   */
  SecretShare.prototype.toString = function () {
    var val = this.ready ? this.value : '<promise>';
    return 'share: ' + val + '. Holders: ' + JSON.stringify(this.holders) + '. Threshold: ' + this.threshold + '. Zp: ' + this.Zp.toString() + '.';
  };

  /**
   * Logs an error. Passes the error on to the associated jiff client instance's {@link handlers.error}
   * @method error
   * @memberof module:jiff-client~JIFFClient#SecretShare
   * @instance
   * @param {string|error} error - the error to log
   */
  SecretShare.prototype.error = function (error) {
    this.jiff.handlers.error('SecretShare', error);
  };

  /**
   * Logs the value represented by this share to the console
   * WARNING: THIS LEAKS INFORMATION AND MUST BE USED ONLY TO DEBUG ON FAKE DATA
   * @method logLEAK
   * @memberof module:jiff-client~JIFFClient#SecretShare
   * @instance
   * @param {string} tag - accompanying tag to display in the console
   * @param {Array<number|string>} [parties=[holders[0]] - the parties which will display the log
   * @param {string|number|object} [op_id=auto_gen()] - same as {@link module:jiff-client:JIFFClient#open}
   * @return {?promise} a promise to the value represented by this share after logging it, null if party is not in parties
   */
  SecretShare.prototype.logLEAK = function (tag, parties, op_id) {
    if (parties == null) {
      parties = [this.holders[0]];
    }
    var promise = this.open(parties, tag, op_id);
    if (promise != null) {
      promise = promise.then(function (result) {
        console.log(tag, result.toString());
        return result;
      }, this.error);
    }
    return promise;
  };

  /**
   * Handler for when this share's promise (if any) is resolved
   * @method promise_handler
   * @memberof module:jiff-client~JIFFClient#SecretShare
   * @instance
   * @param {number} value - the value of the share after it was resolved
   */
  SecretShare.prototype.promise_handler = function (value) {
    this.value = value;
    this.ready = true;
    return this.value;
  };

  /**
   * Executes callback when both this share and o are ready and returns the result (or a promise to the result)
   * @method when_both_ready
   * @memberof module:jiff-client~JIFFClient#SecretShare
   * @instance
   * @param {SecretShare} o - the other share object.
   * @param {function()} cb - the callback to execute.
   * @returns {value|promise} either the return value of cb() or a promise to it
   */
  SecretShare.prototype.when_both_ready = function (o, cb) {
    if (this.ready && o.ready) {
      return cb();
    }

    if (this.ready) {
      return o.value.then(cb, this.error);
    } else if (o.ready) {
      return this.value.then(cb, this.error);
    } else {
      return Promise.all([this.value, o.value]).then(cb, this.error);
    }
  };

  /**
   * Shortcut for opening/revealing the value of this share. Alias for open in jiff-instance
   * @see jiff-instance#open
   * @method open
   * @memberof module:jiff-client~JIFFClient#SecretShare
   * @instance
   * @param {Array} [parties=all_parties] - an array with party ids (1 to n) of receiving parties
   * @param {string|number|object} [op_id=auto_gen()] - same as {@link module:jiff-client:JIFFClient#open}
   * @returns {?promise} a (JQuery) promise to the open value of the secret, null if the party is not specified in
   *                         the parties array as a receiver
   */
  SecretShare.prototype.open = function (parties, op_id) {
    return this.jiff.open(this, parties, op_id);
  };

  /**
   * Wrapper around share.value.then.
   * In case share is ready (its promise is resolved and cleared)
   * The callback is executed immediately.
   * Does not support chaining
   * @method wThen
   * @memberof module:jiff-client~JIFFClient#SecretShare
   * @instance
   * @param {function} onFulfilled - callback for success, called with this.value as parameter
   * @param {function} [onRejected=this.error] - callback for errors
   * @return {promise|value} either the result of executing onFulfilled or a promise to it
   */
  SecretShare.prototype.wThen = function (onFulfilled, onRejected) {
    if (this.ready) {
      return onFulfilled(this.value);
    } else {
      if (onRejected == null) {
        onRejected = this.error;
      }
      return this.value.then(onFulfilled, onRejected);
    }
  };

  // Complex protocols in prototype of SecretShare
  genericProtocols(SecretShare);
  arithmetic(SecretShare);
  comparison(SecretShare);
  protocols(SecretShare);
  booleans(SecretShare);

  // internal variant of primitives, to use internally by other primitives
  var internals = ['cadd', 'csub', 'cmult', 'sadd', 'ssub', 'smult', 'smult_bgw',
    'cxor_bit', 'sxor_bit', 'cor_bit', 'sor_bit',
    'slt', 'slteq', 'sgt', 'sgteq', 'seq', 'sneq',
    'clt', 'clteq', 'cgt', 'cgteq', 'ceq', 'cneq',
    'sdiv', 'cdiv', 'not', 'cpow', 'lt_halfprime', 'if_else'];
  for (var i = 0; i < internals.length; i++) {
    var key = internals[i];
    SecretShare.prototype['i' + key] = SecretShare.prototype[key];
  }

  return SecretShare;
};