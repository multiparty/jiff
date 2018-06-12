(function (exports, node) {
  var saved_instance;

  /**
   * Connect to the server and initialize the jiff instance
   */
  exports.connect = function (hostname, computation_id, options) {
    var opt = Object.assign({}, options);
    // Added options goes here

    if (node) {
      jiff = require('../../lib/jiff-client');
    }

    saved_instance = jiff.make_jiff(hostname, computation_id, opt);
    // if you need any extensions, put them here

    return saved_instance;
  };

  /**
   * The MPC computation
   */
  exports.compute = function (input, jiff_instance) {
    if (jiff_instance == null) {
      jiff_instance = saved_instance;
    }
    // The MPC implementation should go *HERE*

    //function BGW(x, y, jiff_instance) {
    var n = jiff_instance.party_count;
    var t = Math.floor(n/2);
    var x = input;
    var y = input+4;
    var s1 = jiff_instance.share(x, t);
    var s2 = jiff_instance.share(y, t);

    var final_deferred = $.Deferred();
    var final_promise = final_deferred.promise();
    var result = jiff_instance.secret_share(jiff_instance, false, final_promise, undefined, s1[1].holders, t, jiff_instance.Zp);


    var x_sum = s1[1];
    var y_sum = s2[1];

    var x_y_promises = [];
    for (var i = 1; i <= n; i++) {
      x_y_promises.push(s1[i].promise);
      x_y_promises.push(s2[i].promise);
    }

    Promise.all(x_y_promises).then(
      function (result) {
        // sum the values of all shares of s1, s2 to form new secret x, y values

        /*for (var i = 2; i <= jiff_instance.party_count; i++) {
          x_sum = x_sum.sadd(s1[i]);
        }
        for (i = 2; i <= jiff_instance.party_count; i++) {
          y_sum = y_sum.sadd(s2[i]);
        }*/

        var r_shares;
        var r_prime;

        //Promise.all([x_sum.promise, y_sum.promise]).then(
        //function (result) {

        //var zi = x_sum.value*y_sum.value;
        var zi = x_sum.value*y_sum.value;
        //var zi = x*y;
        r_shares = jiff_instance.share(zi, t);

        var promises = [];
        for (var i = 1; i <= n; i++) {
          promises.push(r_shares[i].promise);
        }

        //shamir reonstruct takes an array of objects
        //has attributes: {value: x, sender_id: y, Zp: jiff_instance.Zp}
        var reconstruct_parts = new Array(n);
        Promise.all(promises).then(
          function (result) {
            //TODO make this for-loop a map so it's cleaner and cooler
            for (var i = 1; i <= n; i++) {
              reconstruct_parts[i-1] = {value: r_shares[i].value, sender_id: i, Zp: jiff_instance.Zp};

            }
            r_prime = jiff.sharing_schemes.shamir_reconstruct(jiff_instance, reconstruct_parts);
            //return r_prime;
            // this is a share of z
            //var final_result = jiff_instance.coerce_to_share(r_prime);
            var final_result = r_prime;


            final_deferred.resolve(final_result);
            // Return a promise to the final output(s)
            //final_deferred.resolve(r_prime);
            /*if (final_result.ready) {
            /*} else {  //Resolve the deferred when ready.
              final_result.promise.then(function () {
                final_deferred.resolve(final_result);
              });
            }*/
          });
      },
      function (err) {
        console.log(err);
      });

    return jiff_instance.open(result);
    //return result; //share of z
  };
}((typeof exports === 'undefined' ? this.mpc = {} : exports), typeof exports !== 'undefined'));
