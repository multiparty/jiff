(function (exports, node) {
  var saved_instance;

  /**
   * Connect to the server and initialize the jiff instance
   */
  exports.connect = function (hostname, computation_id, options) {
    var opt = Object.assign({}, options);

    if (node) {
      // eslint-disable-next-line no-undef
      jiff = require('../../lib/jiff-client');
    }

    // eslint-disable-next-line no-undef
    saved_instance = jiff.make_jiff(hostname, computation_id, opt);
    return saved_instance;
  };

  /**
   * MPC Preprocessing
   */
  exports.preprocess = function (multiplication_count, jiff_instance) {
    if (jiff_instance == null) {
      jiff_instance = saved_instance;
    }

    var promise = jiff_instance.preprocessing('*', jiff_instance.protocols.generate_beaver_bgw, multiplication_count);
    promise.then(function () {
      jiff_instance.finish_preprocessing();
    });
    return promise;
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
      sum = sum.smult(shares[i]);
    }

    // Return a promise to the final output(s)
    return jiff_instance.open(sum);
  };
}((typeof exports === 'undefined' ? this.mpc = {} : exports), typeof exports !== 'undefined'));
