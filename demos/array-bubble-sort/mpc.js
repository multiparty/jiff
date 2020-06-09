(function (exports, node) {
  var saved_instance;

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

    // Share the arrays
    var shares = jiff_instance.share_array(input, input.length);

    // Sum all shared input arrays element wise
    var array = shares[1];
    for (var p = 2; p <= jiff_instance.party_count; p++) {
      for (var i = 0; i < array.length; i++) {
        array[i] = array[i].sadd(shares[p][i]);
      }
    }

    // Sort new array
    var sorted = bubblesort(array);

    // Open the array
    return jiff_instance.open_array(sorted);
  };
}((typeof exports === 'undefined' ? this.mpc = {} : exports), typeof exports !== 'undefined'));
