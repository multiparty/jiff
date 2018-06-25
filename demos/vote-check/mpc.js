(function(exports, node) {
  var saved_instance;

  /**
   * Connect to the server and initialize the jiff instance
   */
  exports.connect = function (hostname, computation_id, options) {
    var opt = Object.assign({}, options);
    // Added options goes here

    if(node)
      jiff = require('../../lib/jiff-client');

    saved_instance = jiff.make_jiff(hostname, computation_id, opt);
    // if you need any extensions, put them here

    return saved_instance;
  };

  /**
   * The MPC computation
   */
  exports.compute = function (inputs, jiff_instance) {
    if(jiff_instance == null) jiff_instance = saved_instance;

    var shares = [];
    for(var i = 0; i < inputs.length; i++)
      shares.push(jiff_instance.share(inputs[i]));

    // Check that the sum of the number of votes one party sends (across all options)
    // is less than 2.
    var sum_per_party = [];
    for(var i = 1; i <= jiff_instance.party_count; i++) {
      var sum = shares[0][i];
      for(var j = 1; j < shares.length; j++) {
        sum = sum.sadd(shares[j][i]);
      }
      sum_per_party[i] = sum.clt(2);
    }
    
    // Check that no party has votes greater or equal to 2.
    var prod_all_parties = sum_per_party[1]; 
    for(var i = 2; i <= jiff_instance.party_count; i++) {
      prod_all_parties = prod_all_parties.smult(sum_per_party[i]);
    }

    // Aggregate votes
    for(var i = 0; i < shares.length; i++) {
      var sum = shares[i][1];
      for(var j = 2; j <= jiff_instance.party_count; j++)
        sum = sum.sadd(shares[i][j]);
      shares[i] = sum.smult(prod_all_parties);
    }

    return jiff_instance.open_all(shares, [1]);
  };
}((typeof exports == 'undefined' ? this.mpc = {} : exports), typeof exports != 'undefined'));
