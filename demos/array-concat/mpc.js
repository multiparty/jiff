(function (exports, node) {
  var saved_instance;
  var seeds = {};

  /**
   * Connect to the server and initialize the jiff instance
   */
  exports.connect = function (hostname, computation_id, options) {
    var opt = Object.assign({}, options);
    // Added options goes here
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

    // Convert the input string into an array of numbers
    // each number is the ascii encoding of the character at the same index
    var arr = [];
    for (var p= 0; p < input.length; p++) {
      arr.push(input.charCodeAt(p));
    }

    var final_deferred = $.Deferred();
    var final_promise = final_deferred.promise();

    var promise = jiff_instance.share_array(arr);
    promise.then(function (shares) {
      jiff_instance.seed_ids(seed);

      var result = [];
      for (var p = 1; p <= jiff_instance.party_count; p++) {
        result = result.concat(shares[p]);
      }

      var promises = [];
      for (var i = 0; i < result.length; i++) {
        promises.push(jiff_instance.open(result[i]));
      }

      // Handle the results
      Promise.all(promises).then(function (results) {
        // convert each opened number to a character
        // and add it to the final strings
        var string = '';
        for (var i = 0; i < results.length; i++) {
          string += String.fromCharCode(results[i]);
        }

        final_deferred.resolve(string);
      });
    });

    return final_promise;
  };
}((typeof exports === 'undefined' ? this.mpc = {} : exports), typeof exports !== 'undefined'));
