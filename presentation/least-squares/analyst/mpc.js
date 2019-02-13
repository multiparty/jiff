(function (exports) {
  var jiff_instance;
  var computes;

  /**
   * Connect to the server and initialize the jiff instance
   */
  exports.connect = function (hostname, computation_id, options, _computes, schema_callback) {
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
  };

  /**
   * The MPC computation
   */
  exports.compute = function () {
    var promise1 = jiff_instance.receive_open(computes);
    var promise2 = jiff_instance.receive_open(computes);

    return Promise.all([promise1, promise2]).then(function (res) {
      return {slope: res[0], yIntercept: res[1]};
    });
  };
}(this.mpc = {}));
