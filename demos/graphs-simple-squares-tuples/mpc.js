(function(exports, node) {
  var saved_instance;

  /**
   * Connect to the server and initialize the jiff instance
   */
  exports.connect = function (hostname, computation_id, options) {
    var opt = Object.assign({}, options);
    // Added options goes here

    if(node) {
      jiff = require('../../lib/jiff-client');
      jiff_bignumber = require('../../lib/ext/jiff-client-bignumber');
      jiff_fixedpoint = require('../../lib/ext/jiff-client-fixedpoint');
      BigNumber = require('bignumber.js');    
    }

    opt.autoConnect = false;
    saved_instance = jiff.make_jiff(hostname, computation_id, opt);
    saved_instance = jiff_bignumber.make_jiff(saved_instance, options);
    saved_instance = jiff_fixedpoint.make_jiff(saved_instance, { decimal_digits: 5, integral_digits: 5}); // Max bits after decimal allowed
    saved_instance.connect();

    return saved_instance;
  };

  /**
   * The MPC computation
   */
  exports.compute = function (values, jiff_instance) {
    if(jiff_instance == null) jiff_instance = saved_instance;

    let final_deferred = $.Deferred();
    let final_promise = final_deferred.promise();

    let sum_xy_shares = jiff_instance.share(values.reduce((acc, curr) => (curr.x*curr.y) + acc, 0));
    let sum_xy = sum_xy_shares[1];
    for(let i = 2; i <= jiff_instance.party_count; i++) {
      sum_xy = sum_xy.add(sum_xy_shares[i]);
    }

    let sum_x_shares = jiff_instance.share(values.reduce((acc, curr) => curr.x + acc, 0));
    let sum_x = sum_x_shares[1];
    for(let i = 2; i <= jiff_instance.party_count; i++) {
      sum_x = sum_x.add(sum_x_shares[i]);
    }

    let sum_xx_shares = jiff_instance.share(values.reduce((acc, curr) => (curr.x*curr.x) + acc, 0));
    let sum_xx = sum_xx_shares[1];
    for(let i = 2; i <= jiff_instance.party_count; i++) {
      sum_xx = sum_xx.add(sum_xx_shares[i]);
    }

    let sum_y_shares = jiff_instance.share(values.reduce((acc, curr) => curr.y + acc, 0));
    let sum_y = sum_y_shares[1];
    for(let i = 2; i <= jiff_instance.party_count; i++) {
      sum_y = sum_y.add(sum_y_shares[i]);
    }
    
    let n_shares = jiff_instance.share(values.length);
    let n = n_shares[1];
    for(let i = 2; i <= jiff_instance.party_count; i++) {
      n = n.add(n_shares[i]);
    }

    let m = (sum_xy.sub((sum_x.mult(sum_y)).div(n)))
      .div(sum_xx.sub((sum_x.mult(sum_x)).div(n)));

    m.open(function(m_opened) {
      m_opened = m_opened.toNumber();
      console.info("Slope:", m_opened);
      let b = (sum_y.sub(sum_x.mult(m_opened))).div(n);
      b.open(function(b_opened) {
        b_opened = b_opened.toNumber();
        console.info("Y intercept:", b_opened);
        final_deferred.resolve({m:m_opened, b:b_opened});
      });
    });

    return final_promise;
  };
}((typeof exports == 'undefined' ? this.mpc = {} : exports), typeof exports != 'undefined'));
