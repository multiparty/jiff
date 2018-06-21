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

    //This array holds the shares for each option in the voting
    var option_shares = [];

    //save shares across parties for each option 
    for(var i = 0; i < inputs.length; i++)
      option_shares.push(jiff_instance.share(inputs[i]));

    //Get a patial tally for each option in the vote by adding the shares across parties together.
    for(var i = 0; i < option_shares.length; i++) {
      var sum = option_shares[i][1];
      for(var j = 2; j <= jiff_instance.party_count; j++)
        sum = sum.sadd(option_shares[i][j]);
      option_shares[i] = sum;
    }

    //Now finally redistribute the partial tallys to compute a total tally across each client.
    return jiff_instance.open_all(option_shares, [1]);
  };
}((typeof exports == 'undefined' ? this.mpc = {} : exports), typeof exports != 'undefined'));
