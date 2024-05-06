(function (exports, node) {
  /**
   * Connect to the server and initialize the jiff instance
   */
  exports.connect = function (hostname, computation_id, options) {
    const opt = Object.assign({}, options);
    // Added options goes here
    opt.crypto_provider = true;

    if (node) {
      // eslint-disable-next-line no-undef
      JIFFClient = require('../../lib/jiff-client');
      // eslint-disable-next-line no-undef,no-global-assign
      $ = require('jquery-deferred');
      // eslint-disable-next-line no-undef
      jiff_websockets = require('../../lib/ext/jiff-client-websockets.js');
    }

    // eslint-disable-next-line no-undef
    const jiff_instance = new JIFFClient(hostname, computation_id, opt);
    // eslint-disable-next-line no-undef
    jiff_instance.apply_extension(jiff_websockets, opt);

    return jiff_instance;
  };

  /**
   * The MPC computation
   */

  function oddEvenSort(a, lo, n) {
    if (n > 1) {
      const m = Math.floor(n / 2);
      oddEvenSort(a, lo, m);
      oddEvenSort(a, lo + m, m);
      oddEvenMerge(a, lo, n, 1);
    }
  }

  // lo: lower bound of indices, n: number of elements, r: step
  function oddEvenMerge(a, lo, n, r) {
    const m = r * 2;
    if (m < n) {
      oddEvenMerge(a, lo, n, m);
      oddEvenMerge(a, lo + r, n, m);

      for (let i = lo + r; i + r < lo + n; i += m) {
        compareExchange(a, i, i + r);
      }
    } else {
      compareExchange(a, lo, lo + r);
    }
  }

  function compareExchange(a, i, j) {
    if (j >= a.length || i >= a.length) {
      return;
    }

    const x = a[i];
    const y = a[j];

    const cmp = x.lt(y);
    a[i] = cmp.if_else(x, y);
    a[j] = cmp.if_else(y, x);
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
    oddEvenSort(array, 0, array.length);

    // Open the array
    return jiff_instance.open_array(array);
  };
})(typeof exports === 'undefined' ? (this.mpc = {}) : exports, typeof exports !== 'undefined');
