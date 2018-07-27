(function (exports, node) {
  var saved_instance;

  /**
   * Connect to the server and initialize the jiff instance
   */
  exports.connect = function (hostname, computation_id, options) {
    var opt = Object.assign({}, options);
    opt.Zp = 2049;

    if (node) {
      jiff = require('../../lib/jiff-client');
      $ = require('jquery-deferred');
    }

    saved_instance = jiff.make_jiff(hostname, computation_id, opt);
    exports.saved_instance = saved_instance;
    return saved_instance;
  };

  /**
   * The MPC computation
   */
  exports.compute = function (input, jiff_instance) {
    if (jiff_instance == null) {
      jiff_instance = saved_instance;
    }

    if (jiff_instance.id !== 1) {
      input = 1;
    }

    var final_deferred = $.Deferred();

    // The MPC implementation should go *HERE*

    var shares = jiff_instance.share(input);
    var element = shares[1].sdiv(shares[2]);

    var c = 0;
    element.promise.then(function one_div() {
      console.log('div', c);
      if (c > 3) {
        jiff_instance.open(element).then(final_deferred.resolve);
      } else {
        c++;
        element = element.sdiv(shares[2]);
        element.promise.then(one_div);
      }
    });

    // Return a promise to the final output(s)
    return final_deferred.promise();
  };
}((typeof exports == 'undefined' ? this.mpc = {} : exports), typeof exports != 'undefined'));
