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
    // if you need any extensions, put them here

    return saved_instance;
  };

  exports.computeRoleX = (values, jiff_instance) => {
    if(jiff_instance == null) jiff_instance = saved_instance;
    let final_deferred = $.Deferred();
    let final_promise = final_deferred.promise();


    let sum_x = values.reduce((a,c) => a + c);
    let sum_xx = values.reduce((a,c) => a+c*c, 0);

    let sum_xy = shareAndCalculateSumXY(values, jiff_instance);
    let c__sum_xy = sum_xy.mult(values.length);

    let sum_x__sum_y = jiff_instance.share(sum_x);
    sum_x__sum_y = sum_x__sum_y[1].mult(sum_x__sum_y[2]);

    let mNumerator = c__sum_xy.sub(sum_x__sum_y);

    let denom = values.length*sum_xx-sum_x*sum_x;
    denom = jiff_instance.share(denom);
    denom = denom[1].add(denom[2]);
    let m = mNumerator.div(denom);

    m.open(function(m_opened) {
      console.info("Slope:", m_opened);
      let m_sum_x_d_count = Math.floor(-1*(m_opened*sum_x)/values.length);
      console.info("-1*(m*sum_x/count)=", m_sum_x_d_count);
      m_sum_x_d_count = jiff_instance.share(m_sum_x_d_count);
      let b = m_sum_x_d_count[1].add(m_sum_x_d_count[2]);
      b.open(function(b_opened) {
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

    let sum_xy = shareAndCalculateSumXY(values, jiff_instance);
    let c__sum_xy = sum_xy.mult(values.length);

    let sum_x__sum_y = jiff_instance.share(sum_y);
    sum_x__sum_y = sum_x__sum_y[1].mult(sum_x__sum_y[2]);

    let mNumerator = c__sum_xy.sub(sum_x__sum_y);

    let denom = jiff_instance.share(0);
    denom = denom[1].add(denom[2]);
    let m = mNumerator.div(denom);

    m.open(function(m_opened) {
      console.info("Slope:", m_opened);
      let sum_y_d_count = Math.floor(sum_y/values.length);
      console.info("sum_y/count=", sum_y_d_count);
      sum_y_d_count = jiff_instance.share(sum_y_d_count);
      let b = sum_y_d_count[1].add(sum_y_d_count[2]);
      b.open(function(b_opened) {
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
  const shareAndCalculateSumXY = (values, jiff_instance) => {
    let sum_xy_res;
    for(let i = 0; i < values.length; i++) {
      let t = jiff_instance.share(values[i]);
      t = t[1].mult(t[2]);
      if(sum_xy_res)
        sum_xy_res = sum_xy_res.add(t);
      else
        sum_xy_res = t;
    }
    return sum_xy_res;
  }

}((typeof exports == 'undefined' ? this.mpc = {} : exports), typeof exports != 'undefined'));
