const GMW=require('./gmw_share.js');
const GMW_OPEN=require('./gmw_open.js');
const GMW_OT=require('./gmw_OT.js');

(function (exports, node) {
  var saved_instance;

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
    var shares=GMW.gmw_jiff_share(jiff_instance,input);

// xor test 
    if (typeof(shares[1].value) === 'number') {
      var xor_share;
      xor_share =shares[2].cxor_bit(shares[1].value);
    } else {
      xor_share =shares[1].cxor_bit(shares[2].value);
    }
    var xor_re=GMW_OPEN.gmw_jiff_open(jiff_instance,xor_share);
    return xor_re;

    // final_promise.then(function (v) {
    //   var csec={'1':v[0],'2':v[1]};
    //   console.log('secret',csec);
    //   GMW_OT.send_opts(jiff_instance,csec);

    // });


    /* !!open test use
    var allPromises=[];
    for (var k = 1; k <=Object.keys(shares).length; k++) {
      allPromises.push(GMW_OPEN.gmw_jiff_open(jiff_instance,shares[k]));
    }
    return Promise.all(allPromises);
    //eg.[1,0]
    */


    /*
	    var final_deferred = $.Deferred();
    final_promise.then(function (v) {
  console.log("ff");
  console.log(v);
  var csec={'1':v[0],'2':v[1]};
  });


  console.log(csec);
  console.log("recons"+ooo(csec));
  var ss=GMW_OT.send_opts(jiff_instance,csec);
  */

  }

}((typeof exports === 'undefined' ? this.mpc = {} : exports), typeof exports !== 'undefined'));

