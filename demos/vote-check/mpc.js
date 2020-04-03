(function (exports, node) {
  var saved_instance;

  /**
   * Connect to the server and initialize the jiff instance
   */
  exports.connect = function (hostname, computation_id, options) {
    var opt = Object.assign({}, options);
    // Added options goes here
    opt.Zp = 13;
    opt.crypto_provider = true;
    opt.sodium = false;

    if (node) {
      // eslint-disable-next-line no-undef
      JIFFClient = require('../../lib/jiff-client');
      // eslint-disable-next-line no-undef,no-global-assign
      $ = require('jquery-deferred');
    }

    // eslint-disable-next-line no-undef
    saved_instance = new JIFFClient(hostname, computation_id, opt);
    // if you need any extensions, put them here

    return saved_instance;
  };

  // counts how many test_cases.
  var count = {};

  /**
   * The MPC computation
   */
  exports.compute = function (inputs, jiff_instance) {
    if (jiff_instance == null) {
      jiff_instance = saved_instance;
    }

    if (count[jiff_instance.id] == null) {
      count[jiff_instance.id] = 1;
    }

    // determine which test case is this (which computation)
    var this_count = count[jiff_instance.id];
    count[jiff_instance.id]++;

    // final answer.
    var deferred = $.Deferred();

    // This array holds the shares for each option in the voting
    jiff_instance.share_array(inputs).then(function (option_shares) {
      jiff_instance.seed_ids(this_count);
      var results = option_shares[1].slice();

      var i, j;
      // Get a partial tally for each option in the vote by adding the shares across parties together.
      for (j = 2; j <= jiff_instance.party_count; j++) {
        for (i = 0; i < option_shares[j].length; i++) {
          results[i] = results[i].sadd(option_shares[j][i]);
        }
      }

      // Do Checks:
      // Check 1
      // each single vote option must be less than or equal to 1
      var check = option_shares[1][0].clteq(1);
      for (j = 1; j <= jiff_instance.party_count; j++) {
        for (i = 0; i < option_shares[j].length; i++) {
          check = check.smult(option_shares[j][i].clteq(1));
        }
      }

      // Check 2
      // Each party gets one vote only: sum of all votes of one party should be less than or equal to 1
      for (j = 1; j <= jiff_instance.party_count; j++) {
        var sum = option_shares[j][0];
        for (i = 1; i < option_shares[j].length; i++) {
          sum = sum.sadd(option_shares[j][i]);
        }
        check = check.smult(sum.clteq(1));
      }

      // Apply Checks:
      // if some check fails, set all votes to 0
      for (i = 0; i < results.length; i++) {
        results[i] = results[i].smult(check);
      }

      // Open
      jiff_instance.open_array(results).then(function (results) {
        deferred.resolve(results);
      });
    });

    return deferred.promise();
  };
}((typeof exports === 'undefined' ? this.mpc = {} : exports), typeof exports !== 'undefined'));