(function (exports) {
  var jiff_instance;
  var computes;

  /**
   * Connect to the server and initialize the jiff instance
   */
  exports.connect = function (hostname, computation_id, options, _computes) {
    computes = _computes;
    var opt = Object.assign({}, options);
    opt.Zp = '33554393';
    opt.integer_digits = 3;
    opt.decimal_digits = 2;

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
    console.log(data);
    var avg = 0;
    for (var i = 0; i < data.length; i++) {
      avg += data[i];
    }
    avg = Math.floor(avg / data.length);

    // Secret share average
    console.log(avg);
    jiff_instance.share(avg, computes.length, computes, [computes.length + 2, computes.length + 3]);

    var bar = [];
    var squared = 0;
    for (var j = 0; j < data.length; j++) {
      bar[j] = data[j] - avg;
      squared += bar[j] * bar[j];
    }

    // Secret share array of (avg - diff)
    console.log(computes, bar);
    jiff_instance.share_array(bar, null, computes.length, computes, [ jiff_instance.id ]);

    // Secret share sum of difference square (denumerator), only used for x.
    jiff_instance.share(squared, computes.length, computes, [ jiff_instance.id ]);
  };
}(this.mpc = {}));
