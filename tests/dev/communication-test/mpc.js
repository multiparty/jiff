/* global JIFFClient, jiff_performance, $ */

(function (exports, node) {
  var saved_instance;

  /**
   * Connect to the server and initialize the jiff instance
   */
  exports.connect = function (hostname, computation_id, options) {
    var opt = Object.assign({}, options);
    opt.Zp = 11;

    if (node) {
      JIFFClient = require('../../../lib/jiff-client');
      jiff_performance = require('../../../lib/ext/jiff-client-performance');
      $ = require('jquery-deferred');
    }

    saved_instance = new JIFFClient(hostname, computation_id, opt);
    saved_instance.apply_extension(jiff_performance);

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
    var final_promise = final_deferred.promise();

    // The MPC implementation should go *HERE*
    var shares = jiff_instance.share(input);
    var i = 0;
    (function next() {
      console.log(i + 1);
      jiff_instance.start_barrier();

      for (var j = 0; j < 5; j++) {
        shares[1] = shares[1].sdiv(shares[2]);
      }
      shares[1] = shares[1].csub(1);

      i++;
      if (i < 3) {
        jiff_instance.end_barrier().then(next);
      } else {
        jiff_instance.end_barrier().then(function () {
          var promise = jiff_instance.open(shares[1]);
          promise.then(console.log).then(jiff_instance.disconnect);
          promise.then(final_deferred.resolve);
        });
      }
    })();

    return final_promise;
  };
})(typeof exports === 'undefined' ? (this.mpc = {}) : exports, typeof exports !== 'undefined');
