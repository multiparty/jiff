const GMW=require('./gmw_share.js');
const GMW_OPEN=require('./gmw_open.js');
const GMW_OT=require('./gmw_OT.js');
const GMW_xor=require('./gmw_xor.js');

(function (exports, node) {
  var saved_instance;
  var seeds = {};
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
    //console.log('id',jiff_instance.id);
    if (jiff_instance == null) {
      jiff_instance = saved_instance;

    }
    // if (seeds[jiff_instance.id] == null) {
    //   seeds[jiff_instance.id] = 0;
    // }
    // var seed = seeds[jiff_instance.id]++;
    // jiff_instance.seed_ids(seed);
    // console.log('check test in mpc',jiff_instance.id,'seed=',seed);
    var deferred = $.Deferred();
    var promise = deferred.promise();
    // var rels=[];
    // for ( var i=1;i<=jiff_instance.party_count;i++) {
    //   rels.push(i);
    // }
    // xor bwteen which  two parties.
    var sendls=[2,3];
    // for xor, other =0; for and other=1;
    var other=1;
    var shares;

    if (jiff_instance.id===sendls[0]||jiff_instance.id===sendls[1]) {
      shares=GMW.gmw_jiff_share(jiff_instance,input);
    } else {
      shares=GMW.gmw_jiff_share(jiff_instance,other);
    }
    // get ci promise
    var ci=GMW_OT.gmw_and (jiff_instance, shares,sendls);

    // open the ci among all party including broadcast and reconstruct phase
    return GMW_OPEN.gmw_jiff_open(jiff_instance,ci);
    /*
    var final_deferred = $.Deferred();
    var final_promise = final_deferred.promise();
    var re;
    Promise.all(allPromises).then( function (v) {
      console.log('v=',v);
      //jiff_instance.seed_ids(seed);
      // console.log('mm',jiff_instance.id,'seed',seed);
      //var re=GMW_OT.gmw_and(jiff_instance,v,sendls);
      //console.log('rrrr',re);
      var myls=[];
      for (var i=1;i<=rels.length;i++) {
        myls.push(GMW_OPEN.gmw_jiff_open(jiff_instance,re[i]));
      }
     // return  Promise.all(myls);
      final_deferred.resolve(myls);
          });
    //return GMW_OPEN.gmw_jiff_open(jiff_instance,re[1])
    return final_promise;
      re.then(function (v) {
        //console.log('ci=',v);
        //seed = seeds[jiff_instance.id]++;
        //jiff_instance.seed_ids(seed);
        final_deferred.resolve(v);
      });
    } );
    */
    //return final_promise;
    /*
    final_promise.then(function (v) {
      //seed = seeds[jiff_instance.id]++;
      //jiff_instance.seed_ids(seed);
      console.log('!!start',jiff_instance.id,'seed=',seed);
      var c_shares=GMW.gmw_jiff_share(jiff_instance,v,null,rels,rels);
      console.log('!!end',jiff_instance.id,'seed=',seed);
      var and_re;
      var ap=[];
      //return GMW_OPEN.gmw_jiff_open(jiff_instance,c_shares,rels);  
      for (var k = 0; k <rels.length; k++) {
        ap.push(GMW_OPEN.gmw_jiff_open(jiff_instance,c_shares[rels[k]],rels));
      }
      // for (var k = 1; k <=Object.keys(c_shares).length; k++) {
      //   ap.push(GMW_OPEN.gmw_jiff_open(jiff_instance,c_shares[k],rels));
      // }
      Promise.all(ap).then(function (v) {
        //and_re=v[0]^v[1];// v[2]
        //seed = seeds[jiff_instance.id]++;
        jiff_instance.seed_ids(seed);
        console.log('mm222c',jiff_instance.id,seed);
        and_re=v[0];
        for ( var i=1;i<v.length;i++) {
          and_re=and_re^v[i];
        }

        //console.log('and_re',v,and_re);
        deferred.resolve(and_re);

      });
   */
  }
//});

}((typeof exports === 'undefined' ? this.mpc = {} : exports), typeof exports !== 'undefined'));

/* !!open test use
    var allPromises=[];
    for (var k = 1; k <=Object.keys(shares).length; k++) {
      allPromises.push(GMW_OPEN.gmw_jiff_open(jiff_instance,shares[k]));
    }
    return Promise.all(allPromises);
    //eg.[1,0]
    */
