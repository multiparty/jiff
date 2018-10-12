(function (exports, node) {
  var saved_instance;

  /**
   * Connect to the server and initialize the jiff instance
   */
  exports.connect = function (hostname, computation_id, options) {
    var opt = Object.assign({}, options);
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
    saved_instance = jiff_bignumber.make_jiff(saved_instance, options);
    // eslint-disable-next-line no-undef
    saved_instance = jiff_fixedpoint.make_jiff(saved_instance, { decimal_digits: 5, integral_digits: 5}); // Max bits after decimal allowed
    saved_instance.connect();

    return saved_instance;
  };

  /**
   * The MPC computation
   */
  exports.compute = function (values, jiff_instance) {
    if (jiff_instance == null) {
      jiff_instance = saved_instance;
    }

    var i;
    var final_deferred = $.Deferred();
    var final_promise = final_deferred.promise();

    var sum_xy_shares = jiff_instance.share(values.reduce((acc, curr) => (curr.x*curr.y) + acc, 0));
    var sum_xy = sum_xy_shares[1];
    for (i = 2; i <= jiff_instance.party_count; i++) {
      sum_xy = sum_xy.add(sum_xy_shares[i]);
    }

    var sum_x_shares = jiff_instance.share(values.reduce((acc, curr) => curr.x + acc, 0));
    var sum_x = sum_x_shares[1];
    for (i = 2; i <= jiff_instance.party_count; i++) {
      sum_x = sum_x.add(sum_x_shares[i]);
    }

    var sum_xx_shares = jiff_instance.share(values.reduce((acc, curr) => (curr.x*curr.x) + acc, 0));
    var sum_xx = sum_xx_shares[1];
    for (i = 2; i <= jiff_instance.party_count; i++) {
      sum_xx = sum_xx.add(sum_xx_shares[i]);
    }

    var sum_y_shares = jiff_instance.share(values.reduce((acc, curr) => curr.y + acc, 0));
    var sum_y = sum_y_shares[1];
    for (i = 2; i <= jiff_instance.party_count; i++) {
      sum_y = sum_y.add(sum_y_shares[i]);
    }

    var n_shares = jiff_instance.share(values.length);
    var n = n_shares[1];
    for (i = 2; i <= jiff_instance.party_count; i++) {
      n = n.add(n_shares[i]);
    }

    var m = (sum_xy.sub((sum_x.mult(sum_y)).div(n)))
      .div(sum_xx.sub((sum_x.mult(sum_x)).div(n)));

    m.open(function (m_opened) {
      m_opened = m_opened.toNumber();
      console.info('Slope:', m_opened);
      var b = (sum_y.sub(sum_x.mult(m_opened))).div(n);
      b.open(function (b_opened) {
        b_opened = b_opened.toNumber();
        console.info('Y intercept:', b_opened);
        final_deferred.resolve({m:m_opened, b:b_opened});
      });
    });

    return final_promise;
  };
}((typeof exports === 'undefined' ? this.mpc = {} : exports), typeof exports !== 'undefined'));
