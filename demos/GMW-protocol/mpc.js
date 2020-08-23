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
    var re = shares[1];
    for (var i = 2; i <= jiff_instance.party_count; i++) {
      re = re.gmw_and(shares[i]);
    }
    return jiff_instance.gmw_open(re);
  }


}((typeof exports === 'undefined' ? this.mpc = {} : exports), typeof exports !== 'undefined'));
