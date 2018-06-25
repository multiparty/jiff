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
    saved_instance = jiff_bignumber.make_jiff(saved_instance, opt)
    saved_instance = jiff_fixedpoint.make_jiff(saved_instance, opt); // Max bits after decimal allowed
    saved_instance.connect();

    return saved_instance;
  };

  /**
   * The MPC computation
   */
  exports.compute = function (input, jiff_instance) {
    if(jiff_instance == null) jiff_instance = saved_instance;

    var shares = jiff_instance.share(input);

    var min = shares[1];
    for(var i = 2; i <= jiff_instance.party_count; i++) {
      var cmp = min.slt(shares[i]);
      min = min.smult(cmp).sadd(shares[i].smult(cmp.not()));
    }

    return min.open();
  };
}((typeof exports == 'undefined' ? this.mpc = {} : exports), typeof exports != 'undefined'));
