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
    //console.log('id',jiff_instance.id);
    if (jiff_instance == null) {
      jiff_instance = saved_instance;

    }
    var shares=GMW.gmw_jiff_share(jiff_instance,input);
    var allPromises=[];
    for (var k = 1; k <=Object.keys(shares).length; k++) {
      allPromises.push(shares[k].value);
    }
    var final_deferred = $.Deferred();
    var final_promise = final_deferred.promise();
    Promise.all(allPromises).then( function (v) {
      var csec={'1':v[0],'2':v[1]};
      //console.log('csec=',csec);
      var re=GMW_OT.gmw_and(jiff_instance,csec);
      re.then(function (v) {
        final_deferred.resolve(v);
      });
    } );
    //return final_promise;
    //---- till now return ci for each party

    // --- from now test for reconstruct and gmw_and result

    var deferred = $.Deferred();
    var promise = deferred.promise();

    final_promise.then(function (v) {
      var c_shares=GMW.gmw_jiff_share(jiff_instance,v);
      //console.log('v=',v);
      var and_re;
      var ap=[];
      for (var k = 1; k <=Object.keys(shares).length; k++) {
        ap.push(GMW_OPEN.gmw_jiff_open(jiff_instance,c_shares[k]));
      }
      Promise.all(ap).then(function (v) { 
        and_re=v[0]^v[1];
        //console.log('ap',v,'are',and_re);
        deferred.resolve(and_re);

      });
      // xor to resonstruct and result
      // if (typeof(c_shares[1].value) === 'number') {
      //   GMW_OPEN.gmw_jiff_open(jiff_instance,c_shares[2]).then( function (re) {
      //     and_re =re^v;
      //     console.log('xx',and_re,'2',re,v);
      //     deferred.resolve(and_re);
      //   });
      // } else {
      //   GMW_OPEN.gmw_jiff_open(jiff_instance,c_shares[1]).then( function (re) {
      //     and_re =re^v;
      //     console.log('xx',and_re,'1',re,v);
      //     deferred.resolve(and_re);
      //   });
      // }
      // jiff_instance.open(and_re).then(function (v) {
      //   console.log('and_re',v);
      //   deferred.resolve(v);
      // });

    });
    // return gmw_and result
    //console.log('cc');
    return promise;


    /*
    // xor test
    if (typeof(shares[1].value) === 'number') {
      var xor_share;
      xor_share =shares[2].cxor_bit(shares[1].value);
    } else {
      xor_share =shares[1].cxor_bit(shares[2].value);
    }
    var xor_re=GMW_OPEN.gmw_jiff_open(jiff_instance,xor_share);
    return xor_re;
    */



    /* !!open test use
    var allPromises=[];
    for (var k = 1; k <=Object.keys(shares).length; k++) {
      allPromises.push(GMW_OPEN.gmw_jiff_open(jiff_instance,shares[k]));
    }
    return Promise.all(allPromises);
    //eg.[1,0]
    */

  }

}((typeof exports === 'undefined' ? this.mpc = {} : exports), typeof exports !== 'undefined'));

