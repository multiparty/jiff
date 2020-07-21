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

    jiff_instance.listen('OT',function (id,msg) {
      msg=JSON.parse(msg);
      var opts=msg['opts'];
      var opId=msg['op_id']+'-'+msg['tag'];
      if (jiff_instance.deferreds[opId] == null) {
        jiff_instance.deferreds[opId] = {};
      }
      if (jiff_instance.deferreds[opId][id] == null) { // not ready, setup a deferred
        jiff_instance.deferreds[opId][id] = new jiff_instance.helpers.Deferred();
      }
      jiff_instance.deferreds[opId][id].resolve(opts);

    });

    var shares=jiff_instance.gmw_share(input);
    var xor_re=GMW_XOR.gmw_xor(jiff_instance,shares[1],shares[2]);
    var ci=GMW.gmw_and(jiff_instance,xor_re,shares[4]);
    return jiff_instance.gmw_open(ci);
  }


}((typeof exports === 'undefined' ? this.mpc = {} : exports), typeof exports !== 'undefined'));
