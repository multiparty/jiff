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

    var skeletons = {};
    for (p = 1; p <= jiff_instance.party_count; p++) {
      skeletons[p] = Array(input.length).fill(Array(input.length).fill(null));  // square matricies
    }
    var shares = jiff_instance.share_ND_array(input, skeletons);

    var result = shares[1];
    for (var i = 0; i < input.length; i++) {
      for (var j = 0; j < input.length; j++) {
        for (var p = 1; p <= jiff_instance.party_count; p++) {
          result[i][j] = result[i][j].sor_bit(shares[p][i][j]);
        }
      }
    }

    return jiff_instance.open_ND_array(result);
  };
}((typeof exports === 'undefined' ? this.mpc = {} : exports), typeof exports !== 'undefined'));
