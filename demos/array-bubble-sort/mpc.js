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

  function bubblesort(arr) {

    for (var i = 0; i < arr.length; i++) {
      for (var j = 0; j < (arr.length - i - 1); j++) {
      
        var a = arr[j];
        var b = arr[j+1];
        var c = a.lt(b);
        var d = c.not();
  
        arr[j] = (a.mult(c)).add((b.mult(d)));
        arr[j+1] = (a.mult(d)).add((b.mult(c)));
      }
    }
  
    return arr;
  }

  /**
   * The MPC computation
   */
  exports.compute = function (arr, jiff_instance) {
    if(jiff_instance == null) jiff_instance = saved_instance;

    var final_deferred = $.Deferred();
    var final_promise = final_deferred.promise();

    jiff_instance.share_array(arr, arr.length).then(function(arr_shares) {
      var addedArray = [];
      for (var i = 0; i < arr_shares[1].length; i++) {
        var accumulator = null;
        for(var party in arr_shares) {
          if(!accumulator)
            accumulator = arr_shares[party][i];
          else
            accumulator = accumulator.add(arr_shares[party][i]);
        }
        addedArray.push(accumulator);
      }
      
      var sorted = bubblesort(addedArray);

      var allPromises = [];
      for (var i = 0; i < sorted.length; i++) {
        var p = sorted[i].open(function(result) {
          Promise.resolve(result);
        });
        allPromises.push(p)
      }
    
      return Promise.all(allPromises).then(function(results) {
        final_deferred.resolve(results);
      });
    });

    return final_promise;
  };
}((typeof exports == 'undefined' ? this.mpc = {} : exports), typeof exports != 'undefined'));
