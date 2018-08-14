(function(exports, node) {
  var saved_instance;

  /**
   * Connect to the server and initialize the jiff instance
   */
  exports.connect = function (hostname, computation_id, options) {
    var opt = Object.assign({}, options);
    // Added options goes here

    if(node)
      jiff = require('../../lib/jiff-client');
      jiff_BigNumber = require('../../lib/ext/jiff-client-bignumber');

    saved_instance = jiff.make_jiff(hostname, computation_id, opt);
    saved_instance = jiff_BigNumber.make_jiff(saved_instance);

    return saved_instance;
  };

  /**
   * The MPC computation
   */
  exports.compute = function (input, jiff_instance) {
    if(jiff_instance == null) jiff_instance = saved_instance;

    // Operate on received shares.
    var result = shares[1].cgteq(config.threshold);

    if (config.aggregate) {

      // Compute the total number of lower parties satisfying the threshold.
      for (var i = 2; i <= config.lower; i++) {
        result = result.sadd(shares[i].cgteq(config.threshold));
      }
    } else {

      // Compute if all of lower parties satisfy the threshold.
      for (var j = 2; j <= config.lower; j++) {
        result = result.smult(shares[j].cgteq(config.threshold));
      }
    }
    // Return a promise to the final output(s)
    /// return jiff_instance.open(result);
  };
}((typeof exports == 'undefined' ? this.mpc = {} : exports), typeof exports != 'undefined'));
