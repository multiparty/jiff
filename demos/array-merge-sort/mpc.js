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
    // if you need any extensions, put them here

    return saved_instance;
  };

  /**
   * The MPC computation
   */

  function oddEvenSort(a, lo, n) {
    if (n > 1) {
      var m = Math.floor(n/2);
      oddEvenSort(a, lo, m);
      oddEvenSort(a, lo+m, m);
      oddEvenMerge(a, lo, n, 1);
    }
  }

  // lo: lower bound of indices, n: number of elements, r: step
  function oddEvenMerge(a, lo, n, r) {
    var m = r * 2;
    if (m < n) {
      oddEvenMerge(a, lo, n, m);
      oddEvenMerge(a, lo+r, n, m);

      for (var i = (lo+r); (i+r)<(lo+n); i+=m)  {
        compareExchange(a, i, i+r);
      }
    } else {
      compareExchange(a,lo,lo+r);
    }
  }

  function compareExchange(a, i, j) {
    if (j >= a.length || i >= a.length) {
      return;
    }

    var x = a[i];
    var y = a[j];

    var c = x.lt(y);
    var d = c.not();

    a[i] = (x.mult(c)).add((y.mult(d)));
    a[j] = (x.mult(d)).add((y.mult(c)));
  }

  exports.compute = function (input, jiff_instance) {
    try {
      if (jiff_instance == null) {
        jiff_instance = saved_instance;
      }

      var final_deferred = $.Deferred();
      var final_promise = final_deferred.promise();

      // Share the arrays
      jiff_instance.share_array(input, input.length).then(function (shares) {
        try {
          // sum all shared input arrays element wise
          var array = shares[1];
          for (var p = 2; p <= jiff_instance.party_count; p++) {
            for (var i = 0; i < array.length; i++) {
              array[i] = array[i].sadd(shares[p][i]);
            }
          }
          // sort new array
          oddEvenSort(array, 0, array.length);

          // Open the array
          var allPromises = [];
          for (var k = 0; k < array.length; k++) {
            allPromises.push(jiff_instance.open(array[k]));
          }

          Promise.all(allPromises).then(function (results) {
            final_deferred.resolve(results);
          });
        } catch (err) {
          console.log(err);
        }
      });

    } catch (err) {
      console.log(err);
    }

    return final_promise;
  };
}((typeof exports === 'undefined' ? this.mpc = {} : exports), typeof exports !== 'undefined'));
