var fs = require('fs'); 
/**
 * Contains utility functions (higher order combinators)
 * @see {@link module:jiff-client~JIFFClient#utils}
 * @name utils
 * @alias utils
 * @namespace
 */

module.exports = function (jiffClient) {
  /**
   * Create an array of secret shares and associated deferred.
   * @method
   * @memberof utils
   * @param {number} count - number of secret shares
   * @param {Array} holders - the parties that hold all the corresponding shares (must be sorted)
   * @param {number} threshold - the min number of parties needed to reconstruct the secret
   * @param {number} Zp - the mod under which this share was created
   * @return {object} the secret share object containing the give value
   *
   */
  jiffClient.utils.many_secret_shares = function (count, holders, threshold, Zp) {
    var deferreds = [];
    var shares = [];
    for (var i = 0; i < count; i++) {
      var deferred = new jiffClient.helpers.Deferred();
      shares.push(new jiffClient.SecretShare(deferred.promise, holders, threshold, Zp));
      deferreds.push(deferred);
    }

    return {shares: shares, deferreds: deferreds};
  };

  /**
   * Resolve the array of deferreds with the values of the given shares when ready, matched by index
   * @method
   * @memberof utils
   * @param {Deferred[]} deferreds - the deferred to resolve
   * @param {SecretShare[]} shares - the shares to resolve with
   */
  jiffClient.utils.resolve_many_secrets = function (deferreds, shares) {
    for (var i = 0; i < deferreds.length; i++) {
      shares[i].wThen(deferreds[i].resolve);
    }
  };

  /**
   * Combines all the promises of the given share into a single promise that is resolved when
   * all shares are resolved
   * @method
   * @methodof utils
   * @param {SecretShare[]} shares - the shares whose promises should be joined
   */
  jiffClient.utils.all_promises = function (shares) {
    var promises = [];
    for (var i = 0; i < shares.length; i++) {
      promises.push(shares[i].value);
    }
    return Promise.all(promises);
  };

  /**
   * A high level combinator for iteration of bit arrays
   * It executes a round of (func) starting from index start to the length (supports backwards if start > length) excluding length
   * Every round is blocked until the previous one finishes and the promise produced by it
   * is resolved
   * The final value is used to resolve deferred
   * @method
   * @memberof utils
   * @param {!Deferred} deferred - the deferred to resolve with the final output
   * @param {!number} start - the index to start from
   * @param {!number} length - the index to stop at (excluding it)
   * @param {?object} initial - an initial aggregator value
   * @param {!function(number, object)} func - the aggregator function to apply to the elements in order, takes the index and the aggregator value so far
   * @param {?function(object)} [promisify] - if initial is not null, this is called prior to starting combinator, to turn initial
   *                                        into a promise of the actually used initial value(in case it has to be resolved),
   *                                        defaults to promisifying a SecretShare with .wThen
   * @param {?function(object)} [valufy] - applied to the final result to turn it into a value, which is then used to resolve deferred,
   *                                       defaults to getting value of a SecretShare
   */
  jiffClient.utils.bit_combinator = function (deferred, start, length, initial, func, promisify, valufy) {
    if (promisify == null) {
      promisify = function (share) {
        return {then: share.wThen.bind(share)};
      }
    }

    if (valufy == null) {
      valufy = function (share) {
        return share.value;
      }
    }

    var next = start <= length ? 1 : -1;
    var __bit_combinator = function (start, val) {
      if (start === length) {
        // done
        deferred.resolve(valufy(val));
        return;
      }

      // execute func once
      val = func(start, val);

      // when done, do next iteration
      promisify(val).then(function () {
        __bit_combinator(start + next, val);
      });
    };

    // start combinator
    if (initial == null) {
      __bit_combinator(start, initial);
    } else {
      promisify(initial).then(function () {
        __bit_combinator(start, initial);
      });
    }
  }

    /**
   * A method that will write the current preprocessing table to a json file
   * It will also clear the table afterwards to preserve memory
   * @method
   * @memberof utils
   */

  jiffClient.utils.writeFilePreprocessing = function() {
    // stringify the preprocessing obj 
    var stringifyTable = JSON.stringify(this.preprocessing_table); 
    fs.writeFile('./preprocess.json', stringifyTable, err => {
      if (err) {
        console.log(err); 
        throw err; 
      }
      // clear preprocessing table
      for (var key in this.preprocessing_table) {
        delete this.preprocessing_table[key]; 
      }
    })
  }

  /**
   * A method that will read the preprocess.json file which contains preprocessed values and map that to the preprocessing table
   * @method
   * @memberof utils
   */
  
  jiffClient.utils.readFilePreprocessing = function() {
    try {
      var preprocessData = JSON.parse(fs.readFileSync('./preprocess.json'));
      // iterate through JSON data and create a SecretShare object for each 
      for (var key in preprocessData) {
        if (preprocessData.hasOwnProperty(key)) {
          var individualShare = preprocessData[key];
          // check to see if object value is a triplet
          if (preprocessData[key][0]) {
            // iterate through the array of triplets 
            for (var i = 0; i < preprocessData[key].length; i++) {
              preprocessData[key][i] = new this.SecretShare(individualShare[i]['value'], individualShare[i]['holders'], individualShare[i]['threshold'], individualShare[i]['Zp']);
            }
          }
          else {
            if (!preprocessData[key]["ondemand"]) {
              preprocessData[key] = new this.SecretShare(individualShare['value'], individualShare['holders'], individualShare['threshold'], individualShare['Zp']);
            }
          }
        }
      }
      this.preprocessing_table = preprocessData;
    }
    catch(err) {
      throw err; 
    }
  }
};