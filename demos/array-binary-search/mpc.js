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
      // eslint-disable-next-line no-undef
      jiff_websockets = require('../../lib/ext/jiff-client-websockets.js');
    }

    // eslint-disable-next-line no-undef
    saved_instance = new JIFFClient(hostname, computation_id, opt);
    // if you need any extensions, put them here
    // eslint-disable-next-line no-undef
    saved_instance.apply_extension(jiff_websockets, opt);

    return saved_instance;
  };

  exports.compute = function (input, jiff_instance) {
    if (jiff_instance == null) {
      jiff_instance = saved_instance;
    }

    // Unique prefix seed for op_ids
    if (seeds[jiff_instance.id] == null) {
      seeds[jiff_instance.id] = 0;
    }
    var seed = seeds[jiff_instance.id]++;

    var element = null;
    var array = null;
    if (jiff_instance.id === 1) {
      array = input;
      array.sort(function (a, b) {
        // sorts array: note that the sort function without comparison function inside it will interpret numbers as strings
        // (e.g. 100 smaller than 25)
        return a - b;
      });
    } else {
      element = input;
    }

    var deferred = $.Deferred();
    var promise = deferred.promise();

    element = jiff_instance.share(element, 2, [1, 2], [ 2 ])[2];
    jiff_instance.share_array(array, null, 2, [1, 2], [ 1 ]).then(function (array) {
      jiff_instance.seed_ids(seed);

      array = array[1];
      var result = binary_search(array, element);
      result.open().then(function (result) {
        deferred.resolve(result);
      });
    });

    return promise;
  };

  function binary_search(array, element) {
    if (array.length === 1) {
      return array[0].seq(element);
    }

    // comparison
    var mid = Math.floor(array.length/2);
    var cmp = element.slt(array[mid]);

    // Slice array in half, choose slice depending on cmp
    var nArray = [];
    for (var i = 0; i < mid; i++) {
      var c1 = array[i];
      var c2 = array[mid+i];
      nArray[i] = cmp.if_else(c1, c2);
    }

    // watch out for off by 1 errors if length is odd.
    if (2*mid < array.length) {
      nArray[mid] = array[2*mid];
    }

    return binary_search(nArray, element);
  }

}((typeof exports === 'undefined' ? this.mpc = {} : exports), typeof exports !== 'undefined'));
