(function (exports, node) {
  var saved_instance;

  /**
   * Connect to the server and initialize the jiff instance
   */
  exports.connect = function (hostname, computation_id, options) {
    var opt = Object.assign({}, options);
    opt['autoConnect'] = false;

    if (node) {
      // eslint-disable-next-line no-undef
      jiff = require('../../lib/jiff-client');
      // eslint-disable-next-line no-undef
      jiffRestAPI = require('../../lib/ext/jiff-client-restful');
    }

    // eslint-disable-next-line no-undef
    saved_instance = jiff.make_jiff(hostname, computation_id, opt);
    // eslint-disable-next-line no-undef
    saved_instance.apply_extension(jiffRestAPI, opt);
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

    // The MPC implementation should go *HERE*
    var shares = jiff_instance.share(input);
    var sum = shares[1];
    for (var i = 2; i <= jiff_instance.party_count; i++) {
      sum = sum.sadd(shares[i]);
    }

    // Return a promise to the final output(s)
    return jiff_instance.open(sum);
  };
}((typeof exports === 'undefined' ? this.mpc = {} : exports), typeof exports !== 'undefined'));
