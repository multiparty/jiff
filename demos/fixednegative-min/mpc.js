(function (exports, node) {
  var saved_instance;

  /**
   * Connect to the server and initialize the jiff instance
   */
  exports.connect = function (hostname, computation_id, options) {
    var opt = Object.assign({}, options);
    opt.warn = false;
    opt.crypto_provider = true;

    // Added options goes here
    if (node) {
      JIFFClient = require('../../lib/jiff-client');
      jiff_bignumber = require('../../lib/ext/jiff-client-bignumber');
      jiff_fixedpoint = require('../../lib/ext/jiff-client-fixedpoint');
      jiff_negativenumber = require('../../lib/ext/jiff-client-negativenumber');
    }

    opt.autoConnect = false;
    saved_instance = new JIFFClient(hostname, computation_id, opt);
    saved_instance.apply_extension(jiff_bignumber, opt);
    saved_instance.apply_extension(jiff_fixedpoint, opt); // Max bits after decimal allowed
    saved_instance.apply_extension(jiff_negativenumber, opt); // Max bits after decimal allowed
    saved_instance.connect();

    return saved_instance;
  };

  /**
   * The MPC computation
   */
  exports.compute = function (input, jiff_instance) {
    if (jiff_instance == null) {
      jiff_instance = saved_instance;
    }

    var shares = jiff_instance.share(input);

    var min = shares[1];
    for (var i = 2; i <= jiff_instance.party_count; i++) {
      var cmp = min.slt(shares[i]);
      min = cmp.if_else(min, shares[i]);
    }

    return min.open();
  };
}((typeof exports === 'undefined' ? this.mpc = {} : exports), typeof exports !== 'undefined'));
