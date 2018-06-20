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

  function BGW(x, y, jiff_instance) {
    // x, y both shares
    // z = x*y but also shared

    var final_deferred = $.Deferred();
    var final_promise = final_deferred.promise();
    var result = jiff_instance.secret_share(jiff_instance, false, final_promise, undefined, x.holders, x.threshold, jiff_instance.Zp);

    Promise.all([x.promise, y.promise]).then(
      function () {
        var zi = x.value * y.value;
        var zi_shares = jiff_instance.share(zi, x.threshold, null, null, null);

        var promises = [];
        for (var i = 1; i <= jiff_instance.party_count; i++) {
          promises.push(zi_shares[i].promise);
        }

        //shamir reonstruct takes an array of objects
        //has attributes: {value: x, sender_id: y, Zp: jiff_instance.Zp}
        Promise.all(promises).then(
          function () {
            var reconstruct_parts = [];
            for (var i = 0; i < x.holders.length; i++) {
              var party_id = x.holders[i];
              reconstruct_parts[i] = { value: zi_shares[party_id].value, sender_id: party_id, Zp: jiff_instance.Zp };
            }

            // zi prime is my share of the product x*y, it is just like zi, but the polynomial is now of degree n/2
            var zi_prime = jiff.sharing_schemes.shamir_reconstruct(jiff_instance, reconstruct_parts);
            final_deferred.resolve(zi_prime);
          });
      });

    return result;
  }

  /**
   * The MPC computation
   */
  exports.compute = function (input, jiff_instance) {
    if (jiff_instance == null) {
      jiff_instance = saved_instance;
    }

    // The MPC implementation should go *HERE*
    var threshold = Math.floor((jiff_instance.party_count - 1)/2) + 1;
    var shares = jiff_instance.share(input, threshold);

    var product = shares[1];
    for(var i = 2; i <= jiff_instance.party_count; i++) {
      //product = BGW(product, shares[i], jiff_instance);
      product = product.smult_bgw(shares[i]);
    }
    return jiff_instance.open(product, null);
  };
}((typeof exports === 'undefined' ? this.mpc = {} : exports), typeof exports !== 'undefined'));
