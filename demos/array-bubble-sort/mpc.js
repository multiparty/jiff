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
    exports.saved_instance = saved_instance;
    // if you need any extensions, put them here

    return saved_instance;
  };

  /**
   * The MPC computation
   */

  function bubblesort(arr) {
    for (var i = 0; i < arr.length; i++) {
      for (var j = 0; j < (arr.length - i - 1); j++) {
        var a = arr[j];
        var b = arr[j+1];
        var cmp = a.slt(b);
        arr[j] = cmp.if_else(a, b);
        arr[j+1] = cmp.if_else(b, a);
      }
    }

    return arr;
  }

  exports.compute = function (input, jiff_instance) {
    if (jiff_instance == null) {
      jiff_instance = saved_instance;
    }

    var final_deferred = $.Deferred();
    var final_promise = final_deferred.promise();

    // Share the arrays
    jiff_instance.share_ND_array(input).then(function (shares) {
      var full_array = [];


      // join arrays
      for (var p = 1; p <= jiff_instance.party_count; p++) {
        full_array = full_array.concat(shares[p]);
      }

      // sort new array
      var sorted = bubblesort(full_array);

      // Open the array
      var allPromises = [];
      for (var k = 0; k < sorted.length; k++) {
        allPromises.push(jiff_instance.open(sorted[k]));
      }

      Promise.all(allPromises).then(function (results) {
        final_deferred.resolve(results);
      });
    });

    return final_promise;
  };
}((typeof exports === 'undefined' ? this.mpc = {} : exports), typeof exports !== 'undefined'));
