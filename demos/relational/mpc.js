(function (exports, node) {
  var saved_instance;

  /**
   * Connect to the server and initialize the jiff instance
   */
  exports.connect = function (hostname, computation_id, options) {
    var opt = Object.assign({}, options);

    if (node) {
      // eslint-disable-next-line no-undef
      jiff = require('../../lib/jiff-client');
      jiff_relational = require('../../lib/ext/jiff-client-relational');
      $ = require('jquery-deferred');
    }

    // eslint-disable-next-line no-undef
    saved_instance = jiff.make_jiff(hostname, computation_id, opt);
    saved_instance.apply_extension(jiff_relational, opt);
    return saved_instance;
  };

  /**
   * Testing relational functions
   */
  function test_map(arr, jiff_instance, fun) {
    var deferred = $.Deferred();
    var allPromisedResults = [];

    jiff_instance.share_array(arr, arr.length).then( function(shares) {
        var sums = shares[1];
        for (var i=0; i<sums.length; i++) {
          for (var p=2; p<jiff_instance.party_count; p++) {
            sums[i] = sums[i].sadd( shares[p][i] );
          }
        }
        // apply map to first array
        var result = jiff_instance.helpers.map(sums, fun);
 
        // process array of outputs
        for(var i = 0; i<result.length; i++){
          allPromisedResults.push(jiff_instance.open(result[i]));
        }

        Promise.all(allPromisedResults).then(function (results) {
            deferred.resolve(results);
        });
    });
    return deferred.promise();;

  }

  exports.test_map_eq = function(arr, jiff_instance) {
    eq_f = function(s) { return s.eq(s); };
    return test_map(arr, jiff_instance, eq_f);
  }

  exports.test_map_square = function(arr, jiff_instance) {
    square_f = function(s) { return s.smult(s); };
    return test_map(arr, jiff_instance, square_f);
  }

  function test_filter(arr, jiff_instance, fun) {
    var deferred = $.Deferred();
    var allPromisedResults = [];

    jiff_instance.share_array(arr, arr.length).then( function(shares) {
        var sums = shares[1];
        // pairwise addition
        for (var i=0; i<sums.length; i++) {
          for (var p=2; p<jiff_instance.party_count; p++) {
            sums[i] = sums[i].sadd( shares[p][i] );
          }
        }
        // apply filter
        var zero = sums[0].cmult(0);
        var result = jiff_instance.helpers.filter(sums, fun, zero);
 
        // process array of outputs
        for(var i = 0; i<result.length; i++){
          allPromisedResults.push(jiff_instance.open(result[i]));
        }

        Promise.all(allPromisedResults).then(function (results) {
            deferred.resolve(results);
        });
    });
    return deferred.promise();;
  }

  exports.test_filter_none = function(arr, jiff_instance) {
    var true_f = function(s) { return s.eq(s); };
    return test_filter(arr, jiff_instance, true_f);
  }

  exports.test_filter_all = function(arr, jiff_instance) {
    var false_f = function(s) { return s.neq(s); };
    return test_filter(arr, jiff_instance, false_f);
  }

  exports.test_filter_some = function(arr, jiff_instance) {
    var big_f = function(s) { 
      return s.cgt(50);
    };
    return test_filter(arr, jiff_instance, big_f);
  }

}((typeof exports === 'undefined' ? this.mpc = {} : exports), typeof exports !== 'undefined'));
