const BMW=require('./bmw_share.js');
const BMW_OPEN=require('./bmw_open.js');
const BMW_OT=require('./bmw_OT.js');

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
    }

    // eslint-disable-next-line no-undef
    saved_instance = new JIFFClient(hostname, computation_id, opt);
    return saved_instance;
  };

/*
  //reconstruct no use
  function ooo(ls) {
    var re=ls[1];
    for (var i=2;i<=Object.keys(ls).length;i++) {
      re=re^ls[i];

    }
    return re;

  }
*/
  exports.compute = function (input,jiff_instance) {
    if (jiff_instance == null) {
      jiff_instance = saved_instance;

    }
    //console.log("input="+input+" myid="+jiff_instance.id);
    var shares;
    shares=BMW.bmw_jiff_share(jiff_instance,input);
    //console.log("final_share"+shares);
    //console.log(shares);
    var allPromises=[];
    for (var k = 1; k <=Object.keys(shares).length; k++) {
      allPromises.push(BMW_OPEN.bmw_jiff_open(jiff_instance,shares[k]));
    }

    return Promise.all(allPromises);

    /*
	Promise.all(allPromises).then (function(re){
		//console.log("open up!",re);
		//console.log(my);
		var csec={'1':shares[1].value,'2':shares[2].value};
		//var csec={'1':my[1],'2':my[2]};
	   // console.log(csec);
	// console.log("recons"+ooo(csec));
	   // var ss=BMW_OT.send_opts(jiff_instance,csec);
	});
	*/

    /*

      var final_deferred = $.Deferred();
       var final_promise = final_deferred.promise();
    var allPromises = [];
      for (var k = 1; k <=Object.keys(shares).length; k++) {
        allPromises.push(shares[k].value);

      }
	   Promise.all(allPromises).then(function (results) {
		   console.log(allPromises);
     Promise.all(allPromises).then(function (results) {
       console.log(allPromises);

        final_deferred.resolve(results);

      });
   	final_promise.then(function (v) {
	console.log("ff");
	console.log(v);
	var csec={'1':v[0],'2':v[1]};
  });


	console.log(csec);
	console.log("recons"+ooo(csec));
	var ss=BMW_OT.send_opts(jiff_instance,csec);
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
  var ss=BMW_OT.send_opts(jiff_instance,csec);
  */

    /*
      var final_deferred = $.Deferred();
       var final_promise = final_deferred.promise();
    var allPromises = [];
      for (var k = 1; k <=Object.keys(shares).length; k++) {
        allPromises.push(BMW_OPEN.bmw_jiff_open(jiff_instance,shares[k]));
      }


	   Promise.all(allPromises).then(function (results) {
        final_deferred.resolve(results);
      });
    return final_promise;
    */

  }


  /**
   * The MPC computation

  exports.compute = function (input, jiff_instance) {
    if (jiff_instance == null) {
      jiff_instance = saved_instance;
    }

  // The MPC implementation should go *HERE*
    var shares = jiff_instance.share(input);
    var sum = shares[1];
    for (var i = 2; i <= jiff_instance.party_count; i++) {
      sum = sum.sadd(shares[i]);
    }

  // Return a promise to the final output(s)
    return jiff_instance.open(sum);
  };


  */

}((typeof exports === 'undefined' ? this.mpc = {} : exports), typeof exports !== 'undefined'));


// return final_promise;


// jiff_instance.disconnect(true, true);
