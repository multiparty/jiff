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
      // eslint-disable-next-line no-undef
      JIFFClient = require('../lib/jiff-client');
      // eslint-disable-next-line no-undef
      jiff_bignumber = require('../lib/ext/jiff-client-bignumber');
      // eslint-disable-next-line no-undef
      jiff_fixedpoint = require('../lib/ext/jiff-client-fixedpoint');
      // eslint-disable-next-line no-undef
      jiff_negativenumber = require('../lib/ext/jiff-client-negativenumber');
    }

    opt.autoConnect = false;
    // eslint-disable-next-line no-undef
    saved_instance = new JIFFClient(hostname, computation_id, opt);
    // eslint-disable-next-line no-undef
    saved_instance.apply_extension(jiff_bignumber, opt);
    // eslint-disable-next-line no-undef
    saved_instance.apply_extension(jiff_fixedpoint, opt); // Max bits after decimal allowed
    // eslint-disable-next-line no-undef
    saved_instance.apply_extension(jiff_negativenumber, opt); // Max bits after decimal allowed
    saved_instance.connect();

    return saved_instance;
  };

  /**
   * The MPC computation
   */
  exports.compute = async function (input, jiff_instance) {
    if (jiff_instance == null) {
      jiff_instance = saved_instance;
    }

    var shares = await jiff_instance.share_array(input);
    shares = shares[1].concat(shares[2]).concat(shares[3]);

    var min = shares[0];
    for (var i = 1; i < jiff_instance.party_count; i++) {
      var cmp = min.sgt(shares[i]);
      min = cmp.if_else(min, shares[i]);
    }

    return min.open();
  };
}((typeof exports === 'undefined' ? this.mpc = {} : exports), typeof exports !== 'undefined'));
