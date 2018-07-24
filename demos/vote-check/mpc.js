(function(exports, node) {
  var saved_instance;

  /**
   * Connect to the server and initialize the jiff instance
   */
  exports.connect = function (hostname, computation_id, options) {
    var opt = Object.assign({}, options);
    // Added options goes here
    opt.Zp = 13;

    if(node) {
      jiff = require('../../lib/jiff-client');
      $ = require('jquery-deferred');
    }

    saved_instance = jiff.make_jiff(hostname, computation_id, opt);
    // if you need any extensions, put them here

    return saved_instance;
  };

  // counts how many test_cases.
  var count = 1;

  /**
   * The MPC computation
   */
  exports.compute = function (inputs, jiff_instance) {
    if(jiff_instance == null) jiff_instance = saved_instance;

    var deferred = $.Deferred();

    var this_count = count;
    count++;
    // This array holds the shares for each option in the voting
    jiff_instance.share_array(inputs).then(function(option_shares) {
      var results = option_shares[1];
      //Get a partial tally for each option in the vote by adding the shares across parties together.
      for(var j = 2; j <= jiff_instance.party_count; j++) {
        for(var i = 0; i < option_shares[j].length; i++)
          results[i] = results[i].sadd(option_shares[j][i]);
      }

      // Do Checks:
      // each single vote option must be less than or equal to 1
      var check = option_shares[1][0].clteq(1);
      for(var j = 1; j <= jiff_instance.party_count; j++) {
        for(var i = 0; i < option_shares[j].length; i++)
          check = check.smult(option_shares[j][i].clteq(1), "t"+this_count+":smult_check:"+i+":"+j);
      }
      
      // Apply Checks:
      // if some check fails, set all votes to 0
      for(var i = 0; i < results.length; i++) {
        results[i] = results[i].smult(check, "t"+this_count+":smult_apply:"+i+":"+j);
      }

      var pr = [];
      for(var i = 0; i < results.length; i++) {
        pr.push(jiff_instance.open(results[i], "t"+this_count+":open:"+i));
      }
      
      Promise.all(pr).then(function(results) {
        deferred.resolve(results);
      })

/*
      jiff_instance.open_array(results, null, "open_test_1").then(function(results) {
        deferred.resolve(results);
      });
      */
    });

    return deferred.promise();
  };
}((typeof exports == 'undefined' ? this.mpc = {} : exports), typeof exports != 'undefined'));
