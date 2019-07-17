(function (exports, node) {
  var saved_instance;

  /**
   * Connect to the server and initialize the jiff instance
   */
  exports.connect = function (hostname, computation_id, options) {
    var opt = Object.assign({}, options);
    // Added options goes here

    if (node) {
      // eslint-disable-next-line no-undef
      jiff = require('../../lib/jiff-client');
      // eslint-disable-next-line no-undef,no-global-assign
      $ = require('jquery-deferred');
    }

    // eslint-disable-next-line no-undef
    saved_instance = jiff.make_jiff(hostname, computation_id, opt);
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

    // Convert the input string into an array of numbers
    // each number is the ascii encoding of the character at the same index
    var arr = [];
    for (var p= 0; p < input.length; p++) {
      arr.push(input.charCodeAt(p));
    }

    var final_deferred = $.Deferred();
    var final_promise = final_deferred.promise();

    jiff_instance.share_array(arr).then(function (shares) {
      var result = [];

      for (var p = 1; p <= jiff_instance.party_count; p++) {
        result = result.concat(shares[p]);
      }

      jiff_instance.open_ND_array(result).then(function (results) {
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
