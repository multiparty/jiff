(function (exports, node) {
  var saved_instance;

  /**
   * Connect to the server and initialize the jiff instance
   */
  exports.connect = function (hostname, computation_id, options) {
    var opt = Object.assign({}, options);
    // Added options goes here

    if (node) {
      // eslint-disable-next-line no-undef
      jiff = require('../../lib/jiff-client');
      // eslint-disable-next-line no-undef,no-global-assign
      $ = require('jquery-deferred');
    }

    // eslint-disable-next-line no-undef
    saved_instance = jiff.make_jiff(hostname, computation_id, opt);
    exports.saved_instance = saved_instance;
    // if you need any extensions, put them here

    return saved_instance;
  };

  /** Shuffle using Bubblesort
   * Reorders shares in array by sorting (using bubblesort) generated y shares
   */

  function bubble-shuffle(arr) {
    for (var i = 0; i < arr.length; i++) {
      for (var j = 0; j < (arr.length - i - 1); j++) {
        var a = arr[j][1];
        var b = arr[j+1][1];
        var a2 = arr[j][0];
        var b2 = arr[j+1][0];
        var cmp = a.slt(b);

        // swap Y values
        arr[j][1] = cmp.if_else(a, b);
        arr[j+1][1] = cmp.if_else(b, a);
        // swap X values
        arr[j][0] = cmp.if_else(a2, b2);
        arr[j+1][0] = cmp.if_else(b2, a2);
      }
    }

    // Throw away Y values
    for (var i = 0; i < arr.length; i++){
      arr[i] = arr[i][0];
    }
    return arr;
  }

  /** Shuffle using Mergesort
   * Reorders shares in array by sorting (using bubblesort) generated y shares
   */

  function merge-shuffle(arr){
    oddEvenSort(arr, 0, arr.length);

    // Throw away Y values
    for (var i = 0; i < arr.length; i++){
      arr[i] = arr[i][0];
    }
    return arr;
  }

  function oddEvenSort(arr, lo, n) {
    if (n > 1) {
      var m = Math.floor(n/2);
      oddEvenSort(arr, lo, m);
      oddEvenSort(arr, lo+m, m);
      oddEvenMerge(arr, lo, n, 1);
    }
  }

  // lo: lower bound of indices, n: number of elements, r: step
  function oddEvenMerge(arr, lo, n, r) {
    var m = r * 2;
    if (m < n) {
      oddEvenMerge(arr, lo, n, m);
      oddEvenMerge(arr, lo+r, n, m);

      for (var i = (lo+r); (i+r)<(lo+n); i+=m)  {
        compareExchange(arr, i, i+r);
      }
    } else {
      compareExchange(arr,lo,lo+r);
    }
  }

  function compareExchange(arr, i, j) {
    if (j >= arr.length || i >= arr.length) {
      return;
    }

    var a = arr[i][1];
    var b = arr[j][1];
    var a2 = arr[i][0];
    var b2 = arr[j][0];

    var cmp = a.lt(b);

    // swap Y values
    arr[i][1] = cmp.if_else(a, b);
    arr[j][1] = cmp.if_else(b, a);
    // swap X values
    arr[i][0] = cmp.if_else(a2,b2);
    arr[j][0] = cmp.if_else(b2,a2);
  }

  /**
   * The MPC computation
   */
  exports.compute = function (input, jiff_instance) {
    if (jiff_instance == null) {
      jiff_instance = saved_instance;
    }

    var final_deferred = $.Deferred();
    var final_promise = final_deferred.promise();

    // Share the arrays
    jiff_instance.share_array(input, input.length).then(function (shares) {
      // sum all shared input arrays element wise

      /*var array = shares[1];
      for (var p = 2; p <= jiff_instance.party_count; p++) {
        for (var i = 0; i < array.length; i++) {
          array[i] = array[i].sadd(shares[p][i]);
        }
      }
      */
      var array = [];
      for (var p = 1; p <= jiff_instance.party_count; p++){
        for (var i = 0; i < (shares[p].length); i++) {
          array.push(shares[p][i]);
        }
      }

      var arr2 = jiff_instance.server_generate_and_share({count: array.length});

      for (var i = 0; i < array.length; i++){
        array[i] = [array[i],arr2[i]]
      }

      // shuffle the new array
      var shuffled = bubble-shuffle(array);
      // var shuffled = merge-shuffle(array);

      var allPromises = [];
      for (var k = 0; k < shuffled.length; k++) {
        allPromises.push(jiff_instance.open(shuffled[k]));
      }

      Promise.all(allPromises).then(function (results) {
        final_deferred.resolve(results);
      });
    });

    return final_promise;

    // The MPC implementation should go *HERE*

    // Return a promise to the final output(s)
    /// return jiff_instance.open(result);
  };
}((typeof exports === 'undefined' ? this.mpc = {} : exports), typeof exports !== 'undefined'));
