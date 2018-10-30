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

  exports.computeRoleX = (values, jiff_instance) => {
    if (jiff_instance == null) {
      jiff_instance = saved_instance;
    }
    var final_deferred = $.Deferred();
    var final_promise = final_deferred.promise();

    var sum_x = values.reduce((a,c) => a + c);
    var sum_xx = values.reduce((a,c) => a+c*c, 0);

    var sum_xy = shareAndCalculateSumXY(values, jiff_instance);
    var c__sum_xy = sum_xy.mult(values.length);

    var sum_x__sum_y = jiff_instance.share(sum_x);
    sum_x__sum_y = sum_x__sum_y[1].mult(sum_x__sum_y[2]);

    var mNumerator = c__sum_xy.sub(sum_x__sum_y);

    var denom = values.length*sum_xx-sum_x*sum_x;
    denom = jiff_instance.share(denom);
    denom = denom[1].add(denom[2]);
    var m = mNumerator.div(denom);

    m.open(function (m_opened) {
      m_opened = m_opened.toNumber();
      console.info('Slope:', m_opened);
      var m_sum_x_d_count = (-1*(m_opened*sum_x)/values.length).toFixed(5);
      console.info('-1*(m*sum_x/count)=', m_sum_x_d_count);
      m_sum_x_d_count = jiff_instance.share(m_sum_x_d_count);
      var b = m_sum_x_d_count[1].add(m_sum_x_d_count[2]);
      b.open(function (b_opened) {
        b_opened = b_opened.toNumber();
        console.info('Y intercept:', b_opened);
        final_deferred.resolve({m:m_opened, b:b_opened});
      });
    });

    return final_promise;
  }

  exports.computeRoleY = (values, jiff_instance) => {
    if (jiff_instance == null) {
      jiff_instance = saved_instance;
    }
    var final_deferred = $.Deferred();
    var final_promise = final_deferred.promise();

    var sum_y = values.reduce((a,c) => a + c);

    var sum_xy = shareAndCalculateSumXY(values, jiff_instance);
    var c__sum_xy = sum_xy.mult(values.length);

    var sum_x__sum_y = jiff_instance.share(sum_y);
    sum_x__sum_y = sum_x__sum_y[1].mult(sum_x__sum_y[2]);

    var mNumerator = c__sum_xy.sub(sum_x__sum_y);

    var denom = jiff_instance.share(0);
    denom = denom[1].add(denom[2]);
    var m = mNumerator.div(denom);

    m.open(function (m_opened) {
      m_opened = m_opened.toNumber();
      console.info('Slope:', m_opened);
      var sum_y_d_count = (sum_y/values.length).toFixed(5);
      console.info('sum_y/count=', sum_y_d_count);
      sum_y_d_count = jiff_instance.share(sum_y_d_count);
      var b = sum_y_d_count[1].add(sum_y_d_count[2]);
      b.open(function (b_opened) {
        b_opened = b_opened.toNumber();
        console.info('Y intercept:', b_opened);
        final_deferred.resolve({m:m_opened, b:b_opened});
      });
    });

    return final_promise;
  }

  var shareAndCalculateSumXY = (values, jiff_instance) => {
    var sum_xy_res;
    for (var i = 0; i < values.length; i++) {
      var t = jiff_instance.share(values[i]);
      t = t[1].smult(t[2]);
      if (sum_xy_res) {
        sum_xy_res = sum_xy_res.add(t);
      } else {
        sum_xy_res = t;
      }
    }
    return sum_xy_res;
  }

}((typeof exports === 'undefined' ? this.mpc = {} : exports), typeof exports !== 'undefined'));
