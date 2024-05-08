(function (exports, node) {
  /**
   * Connect to the server and initialize the jiff instance
   */
  exports.connect = function (hostname, computation_id, options) {
    const opt = Object.assign({}, options);
    // Added options goes here
    opt.crypto_provider = true;

    if (node) {
      JIFFClient = require('../../lib/jiff-client');
      $ = require('jquery-deferred');
      jiff_websockets = require('../../lib/ext/jiff-client-websockets.js');
    }

    const jiff_instance = new JIFFClient(hostname, computation_id, opt);
    jiff_instance.apply_extension(jiff_websockets, opt);

    return jiff_instance;
  };

  /**
   * The MPC computation
   */

  function bubblesort(arr) {
    for (let i = 0; i < arr.length; i++) {
      for (let j = 0; j < arr.length - i - 1; j++) {
        const a = arr[j];
        const b = arr[j + 1];
        const cmp = a.slt(b);
        arr[j] = cmp.if_else(a, b);
        arr[j + 1] = cmp.if_else(b, a);
      }
    }

    return arr;
  }

  exports.compute = function (input, jiff_instance) {
    const shares = jiff_instance.share_array(input, input.length);

    // Sum all shared input arrays element wise
    const array = shares[1];
    for (let p = 2; p <= jiff_instance.party_count; p++) {
      for (let i = 0; i < array.length; i++) {
        array[i] = array[i].sadd(shares[p][i]);
      }
    }

    // Sort new array
    const sorted = bubblesort(array);

    // Open the array
    return jiff_instance.open_array(sorted);
  };
})(typeof exports === 'undefined' ? (this.mpc = {}) : exports, typeof exports !== 'undefined');
