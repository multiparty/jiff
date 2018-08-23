(function (exports, node) {
  var saved_instance;

  /**
   * Connect to the server and initialize the jiff instance
   */
  exports.connect = function (hostname, computation_id, options) {
    var opt = Object.assign({}, options);

    if (node) {
      jiff = require('../../lib/jiff-client');
    }

    saved_instance = jiff.make_jiff(hostname, computation_id, opt);
    return saved_instance;
  };

  /**
   * The MPC computation
   */
  exports.compute = function (input, jiff_instance) {
    if (jiff_instance == null) {
      jiff_instance = saved_instance;
    }


    for (var i = 0; i < 100; i++) {
      // generate beaver triple
      var id = jiff_instance.counters.gen_op_id('lt_hp', [1,2,3]);
      try {
        // TODO build generate_bit_sequences (mpdify to actually work) instead of using server_generate_and_share.
        jiff_instance.preprocessing('bit_sequences', 'lt_hp', jiff_instance.server_generate_and_share({bit: true,
          count: 8
        }, ['1','2','3'], jiff_instance.threshold, jiff_instance.Zp, id +':number:' ), 1, []);
      } catch (e) {
        console.log(e);
      }
    }

    jiff_instance.counters.op_count['1,2,3'] = 0;

    var values = [];
    // generate values to multiply
    for (var j = 0; j < 100; j++) {
      values.push(jiff_instance.share(j));
    }

    var results = [];
    for (var k = 0; k < values.length - 1; k++) {
      var result = values[k].slt(values[k+1]);
      results.push(result);
    }

    // Return a promise to the final output(s)
    return jiff_instance.open_array(results);
  };
}((typeof exports == 'undefined' ? this.mpc = {} : exports), typeof exports != 'undefined'));
