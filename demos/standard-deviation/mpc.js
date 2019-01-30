(function (exports, node) {
  var saved_instance;

  /**
   * Connect to the server and initialize the jiff instance
   */
  exports.connect = function (hostname, computation_id, options) {
    var opt = Object.assign({}, options);
    opt.warn = false;

    // Added options goes here
    if (node) {
      // eslint-disable-next-line no-undef
      jiff = require('../../lib/jiff-client');
      // eslint-disable-next-line no-undef
      jiff_bignumber = require('../../lib/ext/jiff-client-bignumber');
      // eslint-disable-next-line no-undef
      jiff_fixedpoint = require('../../lib/ext/jiff-client-fixedpoint');
    }

    opt.autoConnect = false;
    // eslint-disable-next-line no-undef
    saved_instance = jiff.make_jiff(hostname, computation_id, opt);
    // eslint-disable-next-line no-undef
    saved_instance.apply_extension(jiff_bignumber, opt)
    // eslint-disable-next-line no-undef
    saved_instance.apply_extension(jiff_fixedpoint, opt); // Max bits after decimal allowed
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
    var in_sum = shares[1];
    var in_squared_fixed = Number.parseFloat((Math.pow(input, 2)).toFixed(3)); //convert input^2 to fixed point number
    var in_squared = jiff_instance.share(in_squared_fixed);
    var in_squared_sum = in_squared[1];

    for (var i = 2; i <= jiff_instance.party_count; i++) {    // sum all inputs and sum all inputs squared
      in_sum = in_sum.sadd(shares[i]);
      in_squared_sum = in_squared_sum.sadd(in_squared[i]);
    }

    var one_over_n = Number.parseFloat((1/jiff_instance.party_count).toFixed(3)); // convert 1/n to fixed point number
    var in_sum_squared = in_sum.smult(in_sum);
    var intermediary = in_sum_squared.cmult(one_over_n);
    var out = in_squared_sum.ssub(intermediary);

    //Create a promise of output
    var promise = jiff_instance.open(out);

    var promise2 = promise.then(function (v) {
      var variance = v/(jiff_instance.party_count - 1);
      return Math.sqrt(variance);       // Return standard deviation.
    });

    return promise2;
  };
}((typeof exports === 'undefined' ? this.mpc = {} : exports), typeof exports !== 'undefined'));
