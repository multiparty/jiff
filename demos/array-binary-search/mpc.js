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

  exports.compute = async function (input, jiff_instance) {
    if (jiff_instance.id === 1) {
      input.sort(function (a, b) {
        return a - b;
      });
    }
    return new Promise((resolve, reject) => {
      jiff_instance.wait_for([1, 2], async () => {
        try {
          const inputs = await jiff_instance.share_array(input);

          const array = inputs[1];
          const elem = inputs[2];

          const occurrences = await binary_search(array, elem);
          result = await jiff_instance.open(occurrences);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
    });
  };

  function binary_search(array, element) {
    if (array.length === 1) {
      return array[0].seq(element);
    }

    // comparison
    const mid = Math.floor(array.length / 2);
    const cmp = element.slt(array[mid]);

    // Slice array in half, choose slice depending on cmp
    const nArray = [];
    for (let i = 0; i < mid; i++) {
      const c1 = array[i];
      const c2 = array[mid + i];
      nArray[i] = cmp.if_else(c1, c2);
    }

    // watch out for off by 1 errors if length is odd.
    if (2 * mid < array.length) {
      nArray[mid] = array[2 * mid];
    }

    return binary_search(nArray, element);
  }
})(typeof exports === 'undefined' ? (this.mpc = {}) : exports, typeof exports !== 'undefined');
