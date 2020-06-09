(function (exports, node) {
  var saved_instance;

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
    exports.saved_instance = saved_instance;
    // if you need any extensions, put them here

    return saved_instance;
  };

  exports.compute = function (input, jiff_instance) {
    if (jiff_instance == null) {
      jiff_instance = saved_instance;
    }

    // Share the arrays
    var shares = jiff_instance.share_array(input, input.length);

    // Concatenate input arrays
    var full_array = [];
    for (var p = 1; p <= jiff_instance.party_count; p++) {
      full_array = full_array.concat(shares[p]);
    }

    // Shuffle new array
    var shuffled = shuffle(full_array, jiff_instance);

    // Open the array
    return jiff_instance.open_array(shuffled);
  };

  function shuffle(array, jiff_instance) {
    var result = [];
    var n = array.length-1;
    for (var i = n; i > 0; i--) {
      array = array.slice(0, i+1);

      var bits = jiff_instance.protocols.bits.rejection_sampling(0, i+1);
      var random = jiff_instance.protocols.bits.bit_composition(bits);

      array = binary_swap(array, random, array[i]);
      // swap element found into last position of array
      var tmp = array[1];
      array = array[0];
      array[i] = tmp;
      result[i] = array[i];
    }

    result[0] = array[0];
    return result;
  }

  function binary_swap(array, element, last) {
    if (array.length === 1) {
      var tmp = array[0];
      array[0] = last;
      return [array, tmp];
    }

    // comparison
    var mid = Math.floor(array.length/2);
    var cmp = element.clt(mid);


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
    // change element to search for depending on array split decision
    element = cmp.if_else(element, element.csub(mid));
    var result = binary_swap(nArray, element, last);

    for (i = 0; i < mid; i++) {
      array[i] = cmp.if_else(result[0][i], array[i]);
      array[mid+i] = cmp.if_else(array[mid+i], result[0][i]);
    }

    if (2*mid < array.length) {
      array[array.length-1] = cmp.if_else(array[array.length-1], result[0][mid]);
    }

    return [array, result[1]];
  }

}((typeof exports === 'undefined' ? this.mpc = {} : exports), typeof exports !== 'undefined'));
