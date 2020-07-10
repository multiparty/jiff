const GMW_SHARE=require('./gmw_share.js');
const GMW_OPEN=require('./gmw_open.js');
const GMW_AND=require('./gmw_and.js');
const GMW_XOR=require('./gmw_xor.js');
const GMW=require('./update_gmw_and.js');

(function (exports, node) {
  var saved_instance;
  // Unique prefix seed for op_ids
  /**
   * Connect to the server and initialize the jiff instance
   */
  exports.connect = function (hostname, computation_id, options) {
    var opt = Object.assign({}, options);
    opt.crypto_provider = true;

    if (node) {
      // eslint-disable-next-line no-undef
      JIFFClient = require('../../lib/jiff-client');
      $ = require('jquery-deferred');
    }

    // eslint-disable-next-line no-undef
    saved_instance = new JIFFClient(hostname, computation_id, opt);
    return saved_instance;
  };

  exports.compute = function (input,jiff_instance) {
    if (jiff_instance == null) {
      jiff_instance = saved_instance;

    }
    var shares=GMW_SHARE.gmw_share(jiff_instance,input);
    //var ci=GMW_XOR.gmw_xor(jiff_instance, shares[1],shares[2]);
    var c2=GMW.gmw_and(jiff_instance,shares[1],shares[2]);
    return GMW_OPEN.gmw_open(jiff_instance,c2);
  }

}((typeof exports === 'undefined' ? this.mpc = {} : exports), typeof exports !== 'undefined'));
