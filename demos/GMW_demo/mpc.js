(function (exports, node) {
  var saved_instance;
  // Unique prefix seed for op_ids
  /**
   * Connect to the server and initialize the jiff instance
   */
  exports.connect = function (hostname, computation_id, options) {
    var opt = Object.assign({}, options);
    opt.crypto_provider = true;

    if (node) {
      // eslint-disable-next-line no-undef
      JIFFClient = require('../../lib/jiff-client');
      $ = require('jquery-deferred');
    }

    // eslint-disable-next-line no-undef
    saved_instance = new JIFFClient(hostname, computation_id, opt);
    return saved_instance;
  };

  exports.compute = function (input,jiff_instance) {
    if (jiff_instance == null) {
      jiff_instance = saved_instance;

    }
    var shares=jiff_instance.gmw_share(input);
    var xor_re=shares[1].gmw_xor(shares[2]);
    var ci=xor_re.gmw_and(shares[1]);
    return jiff_instance.gmw_open(ci);
  }


}((typeof exports === 'undefined' ? this.mpc = {} : exports), typeof exports !== 'undefined'));
