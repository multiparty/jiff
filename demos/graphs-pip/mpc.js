(function(exports, node) {
  var saved_instance;

  /**
   * Connect to the server and initialize the jiff instance
   */
  exports.connect = (hostname, computation_id, options) => {
    var opt = Object.assign({}, options);
    // Added options goes here

    if(node)
      jiff = require('../../lib/jiff-client');

    saved_instance = jiff.make_jiff(hostname, computation_id, opt);
    // saved_instance = jiff_bignumber.make_jiff(saved_instance, options)
    // saved_instance = jiff_fixedpoint.make_jiff(saved_instance, { decimal_digits: 5, integral_digits: 5}); // Max bits after decimal allowed?
    // saved_instance.connect();

    return saved_instance;
  };

  /**
   * The MPC computation
   */
  exports.compute = (input, jiff_instance) => {
    if(jiff_instance == null) jiff_instance = saved_instance;

    let mx = jiff_instance.share(input.one);
    let cy = jiff_instance.share(input.two);

    let m = mx[1];
    let c = cy[1];
    let x = mx[2];
    let y = cy[2];

    let projection = (m.mult(x)).add(c);

    let result = projection.lt(y);

    return result.open();
  };
}((typeof exports == 'undefined' ? this.mpc = {} : exports), typeof exports != 'undefined'));
