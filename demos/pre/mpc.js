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
      var id = jiff_instance.counters.gen_op_id('*', [1,2,3]);
      try{
        jiff_instance.preprocessing('triplet', '*', jiff_instance.protocols.generate_beaver_bgw, 300, []);
      }catch(e){
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
    for (var k = 0; k < values.length; k++) {
      var result = values[k][1];
      for (var l = 2; l <= jiff_instance.party_count; l++) {
        result = result.smult(values[k][l], null , jiff_instance.preprocessing_table);
      }
      results.push(result);
    }

    // Return a promise to the final output(s)
    return jiff_instance.open_array(results);
  };
}((typeof exports == 'undefined' ? this.mpc = {} : exports), typeof exports != 'undefined'));
