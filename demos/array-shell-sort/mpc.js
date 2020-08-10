(function (exports, node) {
  var saved_instance;

  /**
   * Connect to the server and initialize the jiff instance
   */
  exports.connect = function (hostname, computation_id, options) {
    var opt = Object.assign({}, options);
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
    return saved_instance;
  };

  /**
   * The MPC computation
   */
  var C = 4; // number of region compare-exchange repetitions
  var count = {}; // counts how many test_cases, used to generate unique IDs.

  /*******************Pre-generation of randomness in the clean by party 1 for performance*********/
  // Swap elements at location i and j in array
  function exchange(arr, i, j) {
    var temp = arr[i];
    arr[i] = arr[j];
    arr[j] = temp;
  }

  // Returns random integer j st min <= j < max.
  function getRndInteger(min, max) {
    return Math.floor(Math.random() * (max - min) ) + min;
  }

  //Knuth random permutation algorithm
  function permuteRandom(a) {
    for (var i = 0; i < a.length; i++) {
      exchange(a,i,getRndInteger(i,a.length));
    }
  }

  //Does C compare-exchanges for i < offset and stores them.
  function compareRegionsPreprocess(offset) {
    var mate = [];
    var mates = [];
    for (var count = 0; count < C; count++) { // Do C amount of compare-exchanges
      for (var i = 0; i < offset; i++) {
        mate[i] = i;
      }
      permuteRandom(mate);
      mates.push(mate);
    }
    return mates;
  }

  // Generates all permutations needed for sorting process
  function permutations(offsets) {
    var matesByOffset = [];
    for (var i = 0; i<offsets.length; i++) {
      var offset = offsets[i];
      var mates = compareRegionsPreprocess(offset);
      matesByOffset.push(mates);
    }
    return matesByOffset;
  }

  // Generates all offsets needed for sorting process
  function generateOffsets(n) {
    var offsets = [];
    for (var offset = Math.floor(n/2); offset > 0; offset = Math.floor(offset / 2)) {
      offsets.push(offset);
    }
    return offsets;
  }

  /***********************************Content-dependent********************************************/
  // Check if order of values in array at indexes i, j is correct using MPC, if not, swap.
  function compareExchange(arr, i, j) {
    var a = arr[i];
    var b = arr[j];
    var cmp = a.slt(b);
    if (i < j) {
      arr[i] = cmp.if_else(a, b);
      arr[j] = cmp.if_else(b, a);
    } else {
      arr[i] = cmp.if_else(b, a);
      arr[j] = cmp.if_else(a, b);
    }
  }

  /**************************************Content-agnostic functions**************************************/
  // compare exchange two regions of length offset each
  function compareRegions(a, s, t, offset, mates) {
    for (var count = 0; count < C; count++) { // Do C amount of compare-exchanges
      for (var i = 0; i < offset; i++) {
        var n = a.length;
        var index1 = s+i;
        var index2 = t+mates[count][i];
        if (index1 < n && index2 < n) {
          compareExchange(a, index1, index2);
        }
      }
    }
  }

  //Main sorting function
  function randomizedShellSort(a, offsets, permutationsByOffset) {
    var n = a.length;
    for (var j = 0; j < offsets.length; j++) {
      var offset = offsets[j];
      var mates = permutationsByOffset[j];
      // do a shaker pass
      for (var i = 0; i < n - offset; i += offset) { // compare-exchange up
        compareRegions(a, i, i + offset, offset, mates);
      }
      for (i = n - offset; i >= offset; i -= offset) { // compare-exchange down
        compareRegions(a, i - offset, i, offset, mates);
      }
      // do extended brick pass
      for (i = 0; i < n - 3 * offset; i += offset) { // compare 3 hops up
        compareRegions(a, i, i + 3 * offset, offset, mates);
      }
      for (i = 0; i < n - 2 * offset; i += offset) { // compare 2 hops up
        compareRegions(a, i, i + 2 * offset, offset, mates);
      }
      for (i = 0; i < n; i += 2 * offset) { // compare odd-even regions
        compareRegions(a, i, i + offset, offset, mates);
      }
      for (i = offset; i < n - offset; i += 2 * offset) { // compare even-odd regions
        compareRegions(a, i, i + offset, offset, mates);
      }
    }
  }

  /*********************************** Main Computation ********************************************/
  exports.compute = function (input, jiff_instance) {
    if (jiff_instance == null) {
      jiff_instance = saved_instance;
    }

    if (count[jiff_instance.id] == null) {
      count[jiff_instance.id] = 1;
    }

    // determine which test case is this (which computation)
    var this_count = count[jiff_instance.id];
    count[jiff_instance.id]++;

    // This will resolve to the final result
    var final_deferred = $.Deferred();
    var final_promise = final_deferred.promise();

    // Set-up stage (No MPC here)
    var offsets = [];
    var permutationsByOffset = [];

    // Party 1 sends message with offsets and permutation values to all parties.
    if (jiff_instance.id === 1) {
      var n = input.length;

      offsets = generateOffsets(n);
      permutationsByOffset = permutations(offsets);
      var toSend = [offsets, permutationsByOffset];

      jiff_instance.emit('preprocess' + this_count, null, JSON.stringify(toSend));
    }

    // All parties listen for the message with offsets and permutation values, and store the information in it.
    jiff_instance.listen('preprocess' + this_count, function (sender_id, message) {
      jiff_instance.remove_listener('preprocess' + this_count);
      jiff_instance.seed_ids(this_count);

      var received = JSON.parse(message);
      offsets = received[0];
      permutationsByOffset = received[1];

      // Share the arrays
      var shares = jiff_instance.share_array(input, input.length);

      // Sum all shared input arrays element wise
      var array = shares[1];
      for (var p = 2; p <= jiff_instance.party_count; p++) {
        for (var i = 0; i < array.length; i++) {
          array[i] = array[i].sadd(shares[p][i]);
        }
      }

      // Sort new array
      randomizedShellSort(array, offsets, permutationsByOffset);

      // Open the array
      jiff_instance.open_array(array).then(function (results) {
        final_deferred.resolve(results);
      });
    });

    return final_promise;
  };
}((typeof exports === 'undefined' ? this.mpc = {} : exports), typeof exports !== 'undefined'));
