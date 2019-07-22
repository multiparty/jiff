(function (exports, node) {
  var saved_instance;

  /**
   * Connect to the server and initialize the jiff instance
   */
  exports.connect = function (hostname, computation_id, options) {
    var opt = Object.assign({}, options);
    opt.warn = false;
    if (node) {
      // eslint-disable-next-line no-undef
      jiff = require('../../lib/jiff-client');
      jiff_asynchronousshare = require('../../lib/ext/jiff-client-asynchronousshare');
    }

    opt.autoConnect = false;
    // eslint-disable-next-line no-undef
    saved_instance = jiff.make_jiff(hostname, computation_id, opt);
    saved_instance.apply_extension(jiff_asynchronousshare, opt);
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

    // The MPC implementation should go *HERE*
    var bitLength = 9;
    var shares = jiff_instance.protocols.bits.share_bits(input, bitLength, null, null, null, null, null, {1: 2, 2: 2, 3: 1});
    var sum = shares[1];
    for (var i = 2; i <= jiff_instance.party_count; i++) {
      sum = sum[0].jiff.protocols.bits.sadd(sum, shares[i]);
    }




    // Return a promise to the final output(s)
    var opensum = sum[0].jiff.protocols.bits.bit_composition(sum);
    return opensum.open();
  };
}((typeof exports === 'undefined' ? this.mpc = {} : exports), typeof exports !== 'undefined'));
