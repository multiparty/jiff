(function (exports, node) {
  /**
   * Connect to the server and initialize the jiff instance
   */
  exports.connect = function (hostname, computation_id, options) {
    // Added options goes here
    const opt = Object.assign({}, options);
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
    // eslint-disable-next-line no-undef
    jiff_instance.apply_extension(jiff_websockets, opt);

    return jiff_instance;
  };

  /**
   * The MPC computation
   */
  exports.compute = function (input, jiff_instance) {
    // First, turn the string into an array of numbers
    const asciiCodes = Array.from(input).map((char) => char.charCodeAt(0));

    return new Promise((resolve, reject) => {
      jiff_instance.wait_for([1, 2], async () => {
        // Now secret share the array of numbers
        const shares = await jiff_instance.share_array(asciiCodes);

        // Party 1 provides the haystack in which to look
        const haystack = shares[1];

        // Party 2 provides the needle to find
        const needle = shares[2];

        // Store a promise to the result of looking for the needle in every index
        const results = [];

        // Look for needle at every index in the haystack
        for (let i = 0; i <= haystack.length - needle.length; i++) {
          // Compare all the characters till the end of the substring
          let comparison = await haystack[i].seq(needle[0]);
          for (let j = 1; j < needle.length; j++) {
            const _comp = await haystack[i + j].seq(needle[j]);
            comparison = await comparison.smult(_comp);
          }
          results.push(comparison.open());
        }
        Promise.all(results).then(resolve).catch(reject);
      });
    });
  };
})(typeof exports === 'undefined' ? (this.mpc = {}) : exports, typeof exports !== 'undefined');
