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

  exports.compute = function (input, jiff_instance) {
    if (jiff_instance == null) {
      jiff_instance = saved_instance;
    }

    var final_deferred = $.Deferred();
    var final_promise = final_deferred.promise();

    // Share the arrays
    jiff_instance.share_array(input, input.length).then(function (shares) {
      // sum all shared input arrays element wise
      var array = shares[1];
      for (var p = 2; p <= jiff_instance.party_count; p++) {
        for (var i = 0; i < array.length; i++) {
          array[i] = array[i].sadd(shares[p][i]);
        }
      }

      // shuffle new array
      var shuffled = shuffle(array, jiff_instance);

      // Open the array
      var allPromises = [];
      for (var k = 0; k < shuffled.length; k++) {
        allPromises.push(jiff_instance.open(shuffled[k]));
      }

      Promise.all(allPromises).then(function (results) {
        final_deferred.resolve(results);
      });
    });

    return final_promise;
  };

  function shuffle(array, jiff_instance) {
    for (var i = array.length - 1; i > 0; i--) {
      var bits = jiff_instance.protocols.bits.rejection_sampling(null, i+1);
      var random = jiff_instance.protocols.bits.bit_composition(bits);
      array = search_and_swap(array, random, i);
    }

    return array;
  }

  function search_and_swap(array, random, i) {
    for (var j = 0; j < array.length; j++) {
      var c1 = array[j];
      var cmp = random.ceq(j);
      array[j] = cmp.if_else(array[i], c1);
      array[i] = cmp.if_else(c1, array[i]);
    }
    return array;
  }

}((typeof exports === 'undefined' ? this.mpc = {} : exports), typeof exports !== 'undefined'));
