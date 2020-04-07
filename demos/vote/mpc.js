(function (exports, node) {
  var saved_instance;
  var seeds = {};

  /**
   * Connect to the server and initialize the jiff instance
   */
  exports.connect = function (hostname, computation_id, options) {
    var opt = Object.assign({}, options);
    // Added options goes here
    opt.Zp = 13;
    opt.crypto_provider = true;

    if (node) {
      // eslint-disable-next-line no-undef
      JIFFClient = require('../../lib/jiff-client');
      // eslint-disable-next-line no-undef, no-global-assign
      $ = require('jquery-deferred');
    }

    // eslint-disable-next-line no-undef
    saved_instance = new JIFFClient(hostname, computation_id, opt);
    // if you need any extensions, put them here

    return saved_instance;
  };

  /**
   * The MPC computation
   */
  exports.compute = function (inputs, jiff_instance) {
    if (jiff_instance == null) {
      jiff_instance = saved_instance;
    }

    // Unique prefix seed for op_ids
    if (seeds[jiff_instance.id] == null) {
      seeds[jiff_instance.id] = 0;
    }
    var seed = seeds[jiff_instance.id]++;

    var deferred = $.Deferred();

    // This array holds the shares for each option in the voting
    jiff_instance.share_array(inputs).then(function (option_shares) {
      jiff_instance.seed_ids(seed);

      var results = option_shares[1];
      //Get a partial tally for each option in the vote by adding the shares across parties together.
      for (var j = 2; j <= jiff_instance.party_count; j++) {
        for (var i = 0; i < option_shares[j].length; i++) {
          results[i] = results[i].sadd(option_shares[j][i]);
        }
      }

      jiff_instance.open_array(results).then(function (results) {
        deferred.resolve(results);
      });
    });

    return deferred.promise();
  };
}((typeof exports === 'undefined' ? this.mpc = {} : exports), typeof exports !== 'undefined'));
