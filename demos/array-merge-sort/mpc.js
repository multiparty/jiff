(function (exports, node) {
  var saved_instance;
  var seeds = {};

  /**
   * Connect to the server and initialize the jiff instance
   */
  exports.connect = function (hostname, computation_id, options) {
    var opt = Object.assign({}, options);
    // Added options goes here
    opt.crypto_provider = true;

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

    var cmp = x.lt(y);
    a[i] = cmp.if_else(x, y);
    a[j] = cmp.if_else(y, x);
  }

  exports.compute = function (input, jiff_instance) {
    if (jiff_instance == null) {
      jiff_instance = saved_instance;
    }

    // Unique prefix seed for op_ids
    if (seeds[jiff_instance.id] == null) {
      seeds[jiff_instance.id] = 0;
    }
    var seed = seeds[jiff_instance.id]++;

    var final_deferred = $.Deferred();
    var final_promise = final_deferred.promise();

    // Share the arrays
    jiff_instance.share_array(input, input.length).then(function (shares) {
      jiff_instance.seed_ids(seed);

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
    });

    return final_promise;
  };
}((typeof exports === 'undefined' ? this.mpc = {} : exports), typeof exports !== 'undefined'));
