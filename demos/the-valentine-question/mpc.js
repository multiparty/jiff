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
      jiff_websockets = require('../../lib/ext/jiff-client-websockets.js');
    }

    const jiff_instance = new JIFFClient(hostname, computation_id, opt);
    jiff_instance.apply_extension(jiff_websockets, opt);

    return jiff_instance;
  };

  /**
   * The MPC computation
   */
  exports.compute = function (input, jiff_instance) {
    let shares = jiff_instance.share(input);

    shares = shares[1].mult(shares[2]);

    return shares.open();
  };
})(typeof exports === 'undefined' ? (this.mpc = {}) : exports, typeof exports !== 'undefined');