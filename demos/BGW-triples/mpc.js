(function (exports, node) {
  var saved_instance;

  /**
   * Connect to the server and initialize the jiff instance
   */
  exports.connect = function (hostname, computation_id, options) {
    var opt = Object.assign({}, options);
    // Added options goes here

    if (node) {
      jiff = require('../../lib/jiff-client');
    }

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

    // The MPC implementation should go *HERE*
    var threshold = Math.floor((jiff_instance.party_count - 1)/2) + 1;
    var shares = jiff_instance.share(input, threshold);

    var product = shares[1];
    /*
    for(var i = 2; i <= jiff_instance.party_count; i++) {
      //product = BGW(product, shares[i], jiff_instance);
      product = product.smult_bgw(shares[i]);
    }
    */
    return jiff_instance.open(product);
  };
}((typeof exports === 'undefined' ? this.mpc = {} : exports), typeof exports !== 'undefined'));
