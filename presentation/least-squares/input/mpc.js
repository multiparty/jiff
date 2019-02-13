/* global BigNumber */
(function (exports) {
  var jiff_instance;
  var computes;

  /**
   * Connect to the server and initialize the jiff instance
   */
  exports.connect = function (hostname, computation_id, options, _computes) {
    computes = _computes;
    var opt = Object.assign({}, options);
    opt.Zp = '4503599627370449';
    opt.integer_digits = 9;
    opt.decimal_digits = 3;

    // eslint-disable-next-line no-undef
    jiff_instance = jiff.make_jiff(hostname, computation_id, opt);
    // eslint-disable-next-line no-undef
    jiff_instance.apply_extension(jiff_bignumber, opt);
    // eslint-disable-next-line no-undef
    jiff_instance.apply_extension(jiff_fixedpoint, opt);
    // eslint-disable-next-line no-undef
    jiff_instance.apply_extension(jiff_negativenumber, opt);
    return jiff_instance;
  };

  /**
   * The MPC computation
   */
  exports.compute = function (data) {
    var avg = 0;
    for (var i = 0; i < data.length; i++) {
      avg += data[i];
    }
    avg = new BigNumber(avg.toString()).div(data.length);

    // Secret share average
    jiff_instance.share(avg, computes.length, computes, [computes.length + 2, computes.length + 3]);

    var bar = [];
    var squared = new BigNumber(0);
    for (var j = 0; j < data.length; j++) {
      bar[j] = new BigNumber(data[j].toString()).minus(avg);
      squared = squared.plus(bar[j].times(bar[j]));
    }

    // Secret share array of (avg - diff)
    jiff_instance.share_array(bar, null, computes.length, computes, [ jiff_instance.id ]);

    // Secret share sum of difference square (denumerator), only used for x.
    jiff_instance.share(squared, computes.length, computes, [ jiff_instance.id ]);
  };
}(this.mpc = {}));
