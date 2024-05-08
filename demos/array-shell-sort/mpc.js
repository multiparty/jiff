(function (exports, node) {
  /**
   * Connect to the server and initialize the jiff instance
   */
  exports.connect = function (hostname, computation_id, options) {
    const opt = Object.assign({}, options);
    opt.crypto_provider = true;

    if (node) {
      JIFFClient = require('../../lib/jiff-client');
      $ = require('jquery-deferred');
      jiff_websockets = require('../../lib/ext/jiff-client-websockets.js');
    }

    const jiff_instance = new JIFFClient(hostname, computation_id, opt);
    jiff_instance.apply_extension(jiff_websockets, opt);

    return jiff_instance;
  };

  /**
   * The MPC computation
   */
  const C = 4; // number of region compare-exchange repetitions
  const count = {}; // counts how many test_cases, used to generate unique IDs.

  /*******************Pre-generation of randomness in the clean by party 1 for performance*********/
  // Swap elements at location i and j in array
  function exchange(arr, i, j) {
    const temp = arr[i];
    arr[i] = arr[j];
    arr[j] = temp;
  }

  // Returns random integer j st min <= j < max.
  function getRndInteger(min, max) {
    return Math.floor(Math.random() * (max - min)) + min;
  }

  //Knuth random permutation algorithm
  function permuteRandom(a) {
    for (var i = 0; i < a.length; i++) {
      exchange(a, i, getRndInteger(i, a.length));
    }
  }

  //Does C compare-exchanges for i < offset and stores them.
  function compareRegionsPreprocess(offset) {
    const mate = [];
    const mates = [];
    for (var count = 0; count < C; count++) {
      // Do C amount of compare-exchanges
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
    const matesByOffset = [];
    for (let i = 0; i < offsets.length; i++) {
      const offset = offsets[i];
      const mates = compareRegionsPreprocess(offset);
      matesByOffset.push(mates);
    }
    return matesByOffset;
  }

  // Generates all offsets needed for sorting process
  function generateOffsets(n) {
    const offsets = [];
    for (let offset = Math.floor(n / 2); offset > 0; offset = Math.floor(offset / 2)) {
      offsets.push(offset);
    }
    return offsets;
  }

  /***********************************Content-dependent********************************************/
  // Check if order of values in array at indexes i, j is correct using MPC, if not, swap.
  function compareExchange(arr, i, j) {
    const a = arr[i];
    const b = arr[j];
    const cmp = a.slt(b);
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
    for (let count = 0; count < C; count++) {
      // Do C amount of compare-exchanges
      for (let i = 0; i < offset; i++) {
        const n = a.length;
        const index1 = s + i;
        const index2 = t + mates[count][i];
        if (index1 < n && index2 < n) {
          compareExchange(a, index1, index2);
        }
      }
    }
  }

  //Main sorting function
  function randomizedShellSort(a, offsets, permutationsByOffset) {
    const n = a.length;
    for (let j = 0; j < offsets.length; j++) {
      const offset = offsets[j];
      const mates = permutationsByOffset[j];
      // do a shaker pass
      for (let i = 0; i < n - offset; i += offset) {
        // compare-exchange up
        compareRegions(a, i, i + offset, offset, mates);
      }
      for (let i = n - offset; i >= offset; i -= offset) {
        // compare-exchange down
        compareRegions(a, i - offset, i, offset, mates);
      }
      // do extended brick pass
      for (let i = 0; i < n - 3 * offset; i += offset) {
        // compare 3 hops up
        compareRegions(a, i, i + 3 * offset, offset, mates);
      }
      for (let i = 0; i < n - 2 * offset; i += offset) {
        // compare 2 hops up
        compareRegions(a, i, i + 2 * offset, offset, mates);
      }
      for (let i = 0; i < n; i += 2 * offset) {
        // compare odd-even regions
        compareRegions(a, i, i + offset, offset, mates);
      }
      for (let i = offset; i < n - offset; i += 2 * offset) {
        // compare even-odd regions
        compareRegions(a, i, i + offset, offset, mates);
      }
    }
  }

  /*********************************** Main Computation ********************************************/
  exports.compute = function (input, jiff_instance) {
    if (count[jiff_instance.id] == null) {
      count[jiff_instance.id] = 1;
    }

    // determine which test case is this (which computation)
    const this_count = count[jiff_instance.id];
    count[jiff_instance.id]++;

    // Set-up stage (No MPC here)
    let offsets = [];
    let permutationsByOffset = [];

    // Party 1 sends message with offsets and permutation values to all parties.
    if (jiff_instance.id === 1) {
      const n = input.length;

      offsets = generateOffsets(n);
      permutationsByOffset = permutations(offsets);
      const toSend = [offsets, permutationsByOffset];

      jiff_instance.emit('preprocess' + this_count, null, JSON.stringify(toSend));
    }

    return new Promise((resolve, reject) => {
      // All parties listen for the message with offsets and permutation values, and store the information in it.
      jiff_instance.listen('preprocess' + this_count, async function (sender_id, message) {
        jiff_instance.remove_listener('preprocess' + this_count);
        jiff_instance.seed_ids(this_count);

        try {
          const received = JSON.parse(message);
          offsets = received[0];
          permutationsByOffset = received[1];

          // Share the arrays
          const shares = await jiff_instance.share_array(input, input.length);

          // Sum all shared input arrays element wise
          const array = shares[1];
          for (let p = 2; p <= jiff_instance.party_count; p++) {
            for (let i = 0; i < array.length; i++) {
              array[i] = await array[i].sadd(shares[p][i]);
            }
          }

          // Sort new array
          randomizedShellSort(array, offsets, permutationsByOffset);

          // Open the array
          const result = await jiff_instance.open_array(array);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
    });
  };
})(typeof exports === 'undefined' ? (this.mpc = {}) : exports, typeof exports !== 'undefined');
