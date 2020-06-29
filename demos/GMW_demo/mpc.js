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

    shares=GMW.gmw_jiff_share(jiff_instance,input);
    // get ci promise
    var ci=GMW_xor.gmw_xor(jiff_instance, shares[1],shares[2]);

    // open the ci among all party including broadcast and reconstruct phase
    return GMW_OPEN.gmw_jiff_open(jiff_instance,ci);
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
