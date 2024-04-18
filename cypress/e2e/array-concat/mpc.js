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
    // eslint-disable-next-line no-undef
    jiff_instance.apply_extension(jiff_websockets, opt);

    return jiff_instance;
  };

  /**
   * The MPC computation
   */
  exports.compute = async function (input, jiff_instance) {
    const char_arr = Array.from(input, (char) => char.charCodeAt(0));

    return new Promise((resolve, reject) => {
      jiff_instance.wait_for([1, 2], async () => {
        const shares = await jiff_instance.share_array(char_arr);
        const allShares = Object.values(shares).flat();
        const openPromises = allShares.map((share) => jiff_instance.open(share));

        Promise.all(openPromises)
          .then((results) => {
            const res_string = results.map((charCode) => String.fromCharCode(charCode)).join('');
            resolve(res_string);
          })
          .catch(reject);
      });
    });
  };
})(typeof exports === 'undefined' ? (this.mpc = {}) : exports, typeof exports !== 'undefined');
