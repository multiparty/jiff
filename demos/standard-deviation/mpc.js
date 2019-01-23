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
      jiff_bignumber = require('../../lib/ext/jiff-client-bignumber');
      jiff_fixedpoint = require('../../lib/ext/jiff-client-fixedpoint');
    }

    opt.autoConnect = false;
    // eslint-disable-next-line no-undef
    saved_instance = jiff.make_jiff(hostname, computation_id, opt);
    // if you need any extensions, put them here
    saved_instance.apply_extension(jiff_bignumber, opt);
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

    /**
     *
     *  sample variance:
     *  Variance = 1/(n-1) * Sum_(1 to n) (input_i - mean)^2.
     *           = 1/(n-1) * Sum_(1 to n) [input_i^2 - 2*input_i*mean + mean^2]
     *           = 1/(n-1) * [Sum_(1 to n) [input_i^2] + Sum_(1 to n) [mean^2] - 2 * Sum_(1 to n) [input_i * mean]]
     *           = 1/(n-1) * [n * mean^2 + Sum_(1 to n) [input_i^2] - 2 * Sum_(1 to n) [input_i * mean]]
     */

    var shares = jiff_instance.share(input);
    var in_sum = shares[1];
    var in_squared = jiff_instance.share(Math.pow(input,2));
    var in_squared_sum = in_squared[1];

    console.log(input);

    for (var i = 2; i <= jiff_instance.party_count; i++) {    // sum all inputs and sum all inputs squared
      in_sum = in_sum.sadd(shares[i]);
      in_squared_sum = in_squared_sum.sadd(in_squared[i]);
    }
    var one_over_n = Number.parseFloat((1/jiff_instance.party_count).toFixed(15)); // convert 1/n to fixed point number
    console.log(one_over_n);
    //var mean = in_sum.cmult(one_over_n);                        // mean = sum of inputs times 1/n
    var mean = in_sum;
    // var mean_squared = mean.smult(mean);
    //
    // var out = mean_squared.cmult(jiff_instance.party_count);   // out = n * mean^2
    // out = out.sadd(in_squared_sum);                            // out = n * mean^2 + Sum_(1 to n) [input_i^2]
    //
    // var to_subtract = mean.smult(shares[1]);
    // for (var k = 2; k <= jiff_instance.party_count; k++) {    // to_subtract = Sum_(1 to n) [input_i * mean]
    //   var x = mean.smult(shares[k]);
    //   to_subtract = to_subtract.sadd(x);
    // }
    //
    // to_subtract = to_subtract.cmult(2);                       // to_subtract = 2 * Sum_(1 to n) [input_i * mean]
    // out = out.ssub(to_subtract);                              // out = n * mean^2 + Sum_(1 to n) [input_i^2] - 2 * Sum_(1 to n) [input_i * mean]
    //
    // // Create a promise of output
    // var promise = jiff_instance.open(out);
    //
    // var promise2 = promise.then(function(v){
    //    var variance = v/(jiff_instance.party_count - 1);
    //    return Math.sqrt(variance);       // Return standard deviation.
    // });
    //
    // return promise2;

    return jiff_instance.open(mean);
  };
}((typeof exports === 'undefined' ? this.mpc = {} : exports), typeof exports !== 'undefined'));
