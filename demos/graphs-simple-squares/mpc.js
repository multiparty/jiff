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

    saved_instance = jiff.make_jiff(hostname, computation_id, opt);
    saved_instance = jiff_bignumber.make_jiff(saved_instance, options)
    saved_instance = jiff_fixedpoint.make_jiff(saved_instance, { decimal_digits: 5, integral_digits: 5}); // Max bits after decimal allowed
    saved_instance.connect();

    return saved_instance;
  };

  exports.computeRoleX = (values, jiff_instance) => {
    if(jiff_instance == null) jiff_instance = saved_instance;
    let final_deferred = $.Deferred();
    let final_promise = final_deferred.promise();

    let sum_x = values.reduce((a,c) => a + c); console.log("sum_x:", sum_x);
    let sum_xx = values.reduce((a,c) => a+c*c, 0); console.log("sum_xx:", sum_xx);

    let sum_xy = shareAndCalculateSumXY(values, jiff_instance); sum_xy.open(t => console.log("sum_xy:", t.toString()));
    let c__sum_xy = sum_xy.mult(values.length); c__sum_xy.open(t => console.log("c__sum_xy:", t.toString()));

    let sum_x__sum_y = jiff_instance.share(sum_x);
    sum_x__sum_y = sum_x__sum_y[1].mult(sum_x__sum_y[2]); sum_x__sum_y.open(t => console.log("sum_x__sum_y:", t.toString()));

    let mNumerator = c__sum_xy.sub(sum_x__sum_y); mNumerator.open(t => console.log("mNumerator:", t.toString()));

    let denom = values.length*sum_xx-sum_x*sum_x; console.log("denom:", denom);
    denom = jiff_instance.share(denom);
    denom = denom[1].add(denom[2]);
    let m = mNumerator.div(denom);

    m.open(function(m_opened) { m_opened = m_opened.toNumber();
      console.info("Slope:", m_opened);
      let m_sum_x_d_count = Math.floor(-1*(m_opened*sum_x)/values.length);
      console.info("-1*(m*sum_x/count)=", m_sum_x_d_count);
      m_sum_x_d_count = jiff_instance.share(m_sum_x_d_count);
      let b = m_sum_x_d_count[1].add(m_sum_x_d_count[2]);
      b.open(function(b_opened) { b_opened = b_opened.toNumber();
        console.info("Y intercept:", b_opened);
        final_deferred.resolve(m_opened, b_opened);
      });
    });

    return final_promise;
  }

  exports.computeRoleY = (values, jiff_instance) => {
    if(jiff_instance == null) jiff_instance = saved_instance;
    let final_deferred = $.Deferred();
    let final_promise = final_deferred.promise();

    let sum_y = values.reduce((a,c) => a + c);

    let sum_xy = shareAndCalculateSumXY(values, jiff_instance); sum_xy.open(t => console.log("sum_xy:", t.toString()));
    let c__sum_xy = sum_xy.mult(values.length); c__sum_xy.open(t => console.log("c__sum_xy:", t.toString()));

    let sum_x__sum_y = jiff_instance.share(sum_y);
    sum_x__sum_y = sum_x__sum_y[1].mult(sum_x__sum_y[2]); sum_x__sum_y.open(t => console.log("sum_x__sum_y", t.toString()));

    let mNumerator = c__sum_xy.sub(sum_x__sum_y); mNumerator.open(t => console.log("mNumerator:", t.toString()));

    let denom = jiff_instance.share(0); 
    denom = denom[1].add(denom[2]);
    let m = mNumerator.div(denom);

    m.open(function(m_opened) { m_opened = m_opened.toNumber();
      console.info("Slope:", m_opened);
      let sum_y_d_count = Math.floor(sum_y/values.length);
      console.info("sum_y/count=", sum_y_d_count);
      sum_y_d_count = jiff_instance.share(sum_y_d_count);
      let b = sum_y_d_count[1].add(sum_y_d_count[2]);
      b.open(function(b_opened) { b_opened = b_opened.toNumber();
        console.info("Y intercept:", b_opened);
        final_deferred.resolve(m_opened, b_opened);
      });
    });

    return final_promise;
  }

  /**
   * Helper function calculates sum_xy.
   * 
   * @param {Array} values - The array of values input by this party. 
   */
  const shareAndCalculateSumXY = (values, jiff_instance) => { console.log(values);
    let sum_xy_res;
    for(let i = 0; i < values.length; i++) { console.log(values[i])
      let t = jiff_instance.share(values[i]);
      t = t[1].mult(t[2]); t.open(tt => console.log(tt.toString()));
      if(sum_xy_res)
        sum_xy_res = sum_xy_res.add(t);
      else
        sum_xy_res = t;
    }
    return sum_xy_res;
  }

}((typeof exports == 'undefined' ? this.mpc = {} : exports), typeof exports != 'undefined'));
