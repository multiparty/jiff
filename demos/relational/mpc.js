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
   * The MPC computation
   */
  exports.test_map = function(arr, jiff_instance) {
    var deferred = $.Deferred();
    var promise = deferred.promise();
    var allPromisedResults = [];

    jiff_instance.share_array(arr, arr.length).then( function(shares) {
        //var result = jiff_instance.helpers.map(shares[1], function(s) { return s; });
        // todo these are not what I expected. figure out what these are and who they belong to
        // (and why they refuse to resolve
        var real_array = shares[1];
        var empty_array = shares[2];
        var empty_array2 = shares[3];
        console.log('lens from 1 2 3:', real_array.length, empty_array.length, empty_array2.length);
 
        // process array of outputs
        for(var i = 0; i<result.length; i++){
          result[i].logLEAK("output"+i);
          allPromisedResults.push(jiff_instance.open(result[i]));
        }

        Promise.all(allPromisedResults).then(function (results) {
            deferred.resolve(results);
        });
    });

    return promise;

  }
}((typeof exports === 'undefined' ? this.mpc = {} : exports), typeof exports !== 'undefined'));
