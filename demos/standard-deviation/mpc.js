(function (exports, node) {
  var saved_instance;

  function truncate(num, accuracy) {
    var numStr = num.toString();
    var numParts = numStr.split('.');
    var truncdNum;
    if (numParts.length > 1) {
      truncdNum = numParts[0] + '.' + numParts[1].substring(0, accuracy);
    } else {
      truncdNum = numParts[0]
    }
    return truncdNum;
  }

  /**
   * Connect to the server and initialize the jiff instance
   */
  exports.connect = function (hostname, computation_id, options) {
    var opt = Object.assign({}, options);
    opt.crypto_provider = true;
    opt.warn = false;

    // Added options goes here
    if (node) {
      // eslint-disable-next-line no-undef
      JIFFClient = require('../../lib/jiff-client');
      // eslint-disable-next-line no-undef
      jiff_bignumber = require('../../lib/ext/jiff-client-bignumber');
      // eslint-disable-next-line no-undef
      jiff_fixedpoint = require('../../lib/ext/jiff-client-fixedpoint');
      // eslint-disable-next-line no-undef
      jiff_negativenumber = require('../../lib/ext/jiff-client-negativenumber');
    }

    opt.autoConnect = false;
    // eslint-disable-next-line no-undef
    saved_instance = new JIFFClient(hostname, computation_id, opt);
    // eslint-disable-next-line no-undef
    saved_instance.apply_extension(jiff_bignumber, opt);
    // eslint-disable-next-line no-undef
    saved_instance.apply_extension(jiff_fixedpoint, opt); // Max bits after decimal allowed
    // eslint-disable-next-line no-undef
    saved_instance.apply_extension(jiff_negativenumber, opt);
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

    // All operations are fixed point with this precision.
    // Everything is floored down to the closest fixed point
    // number.
    var n = jiff_instance.party_count;
    var precision = jiff_instance.decimal_digits;
    input = jiff_instance.helpers.BigNumber(input);

    // We need to building blocks:
    // 1) input --> used to compute the average of the inputs (squared).
    // 2) n * input^2 --> used to compute the average of the squared inputs.
    var input_squared = truncate(input.times(input), precision);
    input_squared = jiff_instance.helpers.BigNumber(input_squared);

    // Secret share the two building blocks!
    var shares = jiff_instance.share(input);
    var squared_shares = jiff_instance.share(input_squared);

    // Sum both kinds of building blocks.
    var sum = shares[1];
    var sum_squares = squared_shares[1];
    for (var i = 2; i <= jiff_instance.party_count; i++) {
      sum = sum.sadd(shares[i]);
      sum_squares = sum_squares.sadd(squared_shares[i]);
    }

    // Compute square of the sum of inputs.
    // We do not need to perform expensive fixed point shift under MPC
    // We can do that in the clear after opening.
    var shift = jiff_instance.helpers.magnitude(precision);
    var squared_sum = sum.smult(sum, undefined, false);
    sum_squares = sum_squares.cmult(n, undefined, false);

    // Now, both sums have the fixed point shifted by the same amount,
    // we can operate on them consistently.
    var diff = sum_squares.ssub(squared_sum);
    return jiff_instance.open(diff).then(function (diff) {
      // diff is a BigNumber.
      // Now, we have the value of:
      // (n*Sum(input^2) - Sum(input)^2) * shift
      // We want to compute sqrt(Sum(input^2) / n - Sum(input)^2/n^2)
      diff = truncate(diff.div(shift), precision);
      diff = jiff_instance.helpers.BigNumber(diff);
      // * shift is gone, now devide by n^2.
      diff = truncate(diff.div(Math.pow(n, 2)), precision);
      diff = jiff_instance.helpers.BigNumber(diff);
      // Now we have Avg(input^2) - Avg(input)^2
      // Square root and we are done.
      diff = truncate(diff.sqrt(), precision);
      return jiff_instance.helpers.BigNumber(diff);
    });
  };
}((typeof exports === 'undefined' ? this.mpc = {} : exports), typeof exports !== 'undefined'));
