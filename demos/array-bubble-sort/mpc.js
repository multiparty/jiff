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
    exports.saved_instance = saved_instance;
    // if you need any extensions, put them here

    return saved_instance;
  };

  /**
   * The MPC computation
   */

  function bubblesort(arr) {
    for (var i = 0; i < arr.length; i++) {
      for (var j = 0; j < (arr.length - i - 1); j++) {
        var a = arr[j];
        var b = arr[j+1];
        var c = a.slt(b);
        var d = c.not();
  
        arr[j] = a.sadd(d.smult(b.ssub(a)));
        arr[j+1] = a.sadd(c.smult(b.ssub(a)));
      }
    }

    return arr;
  }

  exports.compute = function (input, jiff_instance) {
    if(jiff_instance == null) jiff_instance = saved_instance;

    var final_deferred = $.Deferred();
    var final_promise = final_deferred.promise();

    // Share the arrays
    jiff_instance.share_array(input, input.length).then(function(shares) { 
      // sum all shared input arrays element wise
      var array = shares[1];
      for(var p = 2; p <= jiff_instance.party_count; p++) {
        for(var i = 0; i < array.length; i++) {
          array[i] = array[i].sadd(shares[p][i]);
        }
      }

      // sort new array
      var sorted = bubblesort(array);

      // Open the array
      var allPromises = [];
      for (var i = 0; i < sorted.length; i++)
        allPromises.push(jiff_instance.open(sorted[i]));
    
      Promise.all(allPromises).then(function(results) {
        final_deferred.resolve(results);
      });
    });

    return final_promise;
  };
}((typeof exports == 'undefined' ? this.mpc = {} : exports), typeof exports != 'undefined'));
