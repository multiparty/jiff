(function (exports, node) {
  var saved_instance;
  var seeds = {};

  /**
   * Connect to the server and initialize the jiff instance
   */
  exports.connect = function (hostname, computation_id, options) {
    // Added options goes here
    var opt = Object.assign({}, options);
    opt.crypto_provider = true;

    if (node) {
      // eslint-disable-next-line no-undef
      JIFFClient = require('../../lib/jiff-client');
      // eslint-disable-next-line no-undef,no-global-assign
      $ = require('jquery-deferred');
    }

    // eslint-disable-next-line no-undef
    saved_instance = new JIFFClient(hostname, computation_id, opt);
    // if you need any extensions, put them here

    return saved_instance;
  };

  /**
   * The MPC computation
   */
  exports.compute = function (input, jiff_instance) {
    if (jiff_instance == null) {
      jiff_instance = saved_instance;
    }

    // Unique prefix seed for op_ids
    if (seeds[jiff_instance.id] == null) {
      seeds[jiff_instance.id] = 0;
    }
    var seed = seeds[jiff_instance.id]++;

    // The MPC implementation should go *HERE*
    var final_deferred = $.Deferred(); // this will resolve to the final result
    var final_promise = final_deferred.promise(); // which is an array of 0/1 values for every index in the haystack

    // First, turn the string into an array of numbers
    var asciiCodes = [];
    for (var i = 0; i < input.length; i++) {
      asciiCodes.push(input.charCodeAt(i));
    }

    // Now secret share the array of numbers
    var inputPromise = jiff_instance.share_array(asciiCodes);

    // Perform the computation
    inputPromise.then(function (shares) {
      jiff_instance.seed_ids(seed);

      // Party 1 provides the haystack in which to look
      var haystack = shares[1];

      // Party 2 provides the needle to find
      var needle = shares[2];

      // Store a promise to the result of looking for the needle in every index
      var results = [];

      // Look for needle at every index in the haystack
      for (var i = 0; i <= haystack.length - needle.length; i++) {
        // Compare all the characters till the end of the substring
        var comparison = haystack[i].seq(needle[0]);
        for (var j = 1; j < needle.length; j++) {
          comparison = comparison.smult(haystack[i+j].seq(needle[j]));
        }

        results[i] = comparison.open();
      }

      // Combine the promises for every index, when the result is ready, pass it to the final_promise
      Promise.all(results).then(function (results) {
        final_deferred.resolve(results);
      });
    });

    // Return a promise to the final output(s)
    return final_promise;
  };
}((typeof exports === 'undefined' ? this.mpc = {} : exports), typeof exports !== 'undefined'));

