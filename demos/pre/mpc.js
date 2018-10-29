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
    /*var my_input = jiff_instance.id;
    var shares = jiff_instance.share(my_input, 3);
    console.log(my_input);

    var more_secure_share = shares[1].change_threshold(4);
    console.log(more_secure_share);

    return jiff_instance.open(more_secure_share);*/
    try {
      //  TODO build generate_bit_sequences (mpdify to actually work) instead of using server_generate_and_share.
      for (var i = 0; i < 100; i++) {
        jiff_instance.preprocessing('bit_sequences', 'lt_hp', jiff_instance.protocols.generate_random_bit_sequence, 100);
      }
    } catch (e) {
      console.log(e);
    }

    jiff_instance.counters.op_count['lt_hp'] = 0;

    try {
      jiff_instance.counters.op_count['1,2,3'] = 0;

      var values = [];
      //    generate values to multiply
      for (var j = 0; j < 100; j++) {
        values.push(jiff_instance.share(j));
      }

      var results = [];
      for (var k = 1; k < values.length - 2; k++) {
        //console.log("comparing values:", k, k+1);
        var result = values[k][1].slt(values[k+1][1]);
        results.push(result);
      }

      // Return a promise to the final output(s)
      return jiff_instance.open_array(results);
    } catch (e) {
      console.log(e);
    }
  };
}((typeof exports == 'undefined' ? this.mpc = {} : exports), typeof exports != 'undefined'));
