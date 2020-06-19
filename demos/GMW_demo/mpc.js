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

  exports.compute = function (input,rels,jiff_instance) {
    //console.log('id',jiff_instance.id, rels);
    if (jiff_instance == null) {
      jiff_instance = saved_instance;

    }
    console.log('check test in mpc',jiff_instance.id);
    var deferred = $.Deferred();
    var promise = deferred.promise();
    // for (var k = 1; k <=Object.keys(shares).length; k++) {
    //   allPromises.push(shares[k].value);
    // }
    if (jiff_instance.id===rels[0]||jiff_instance.id===rels[1]) {//rels.indexOf(jiff_instance.id)>-1
      //console.log('vvbb',rels,'my',jiff_instance.id);
      var shares=GMW.gmw_jiff_share(jiff_instance,input,null,rels,rels);
      var allPromises=[];
      console.log('shares1',shares);
      for (var k = 0; k <rels.length; k++) {
        allPromises.push(shares[rels[k]].value);
      }
      var final_deferred = $.Deferred();
      var final_promise = final_deferred.promise();
      Promise.all(allPromises).then( function (v) {
      //var csec={'1':v[0],'2':v[1]};
      //var rels=jiff_instance.receiving_list;
      //csec=v;
        var ssid=rels[1];
        if (jiff_instance.id===rels[1]) {
          ssid=rels[0];
        }
        //console.log('v=',v,'ssid',ssid);
        var re=GMW_OT.gmw_and(jiff_instance,v,ssid);
        re.then(function (v) {
          console.log('ci=',v);
          final_deferred.resolve(v);
        });
      } );
      //return final_promise;
      //---- till now return ci for each party

      // --- from now test for reconstruct and gmw_and result

      final_promise.then(function (v) {

        var c_shares=GMW.gmw_jiff_share(jiff_instance,v,null,rels,rels);
        var and_re;
        var ap=[];
        for (var k = 0; k <rels.length; k++) {
          ap.push(GMW_OPEN.gmw_jiff_open(jiff_instance,c_shares[rels[k]],rels));
        }
        // for (var k = 1; k <=Object.keys(c_shares).length; k++) {
        //   ap.push(GMW_OPEN.gmw_jiff_open(jiff_instance,c_shares[k],rels));
        // }
        Promise.all(ap).then(function (v) {
          and_re=v[0]^v[1];// v[2]
          //console.log('are',v,and_re,jiff_instance.party_count);
          var a=[];
          for (var i=1;i<=jiff_instance.party_count;i++) {
            if (!( i===rels[0]||i ===rels[1])) {
              a.push( i );
            }

          }
          //console.log('aa',a);
          //var to_broadcast= $(a).not(rels).toArray();
          jiff_instance.emit('rec_open',a,and_re.toString(),true);
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
    } else {
      var pp_id=rels [0];
      jiff_instance.listen('rec_open',function (pp_id,msg) {
        deferred.resolve(parseInt(msg));
      });
    }
    // return gmw_and result
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

