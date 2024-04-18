(function (exports, node) {
  /**
   * Connect to the server and initialize the jiff instance
   */
  exports.connect = function (hostname, computation_id, options) {
    let opt = Object.assign({}, options);
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
    let jiff_instance = new JIFFClient(hostname, computation_id, opt);
    // if you need any extensions, put them here
    // eslint-disable-next-line no-undef
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
    let mid = Math.floor(array.length / 2);
    let cmp = element.slt(array[mid]);

    // Slice array in half, choose slice depending on cmp
    let nArray = [];
    for (let i = 0; i < mid; i++) {
      let c1 = array[i];
      let c2 = array[mid + i];
      nArray[i] = cmp.if_else(c1, c2);
    }

    // watch out for off by 1 errors if length is odd.
    if (2 * mid < array.length) {
      nArray[mid] = array[2 * mid];
    }

    return binary_search(nArray, element);
  }
})(typeof exports === 'undefined' ? (this.mpc = {}) : exports, typeof exports !== 'undefined');
