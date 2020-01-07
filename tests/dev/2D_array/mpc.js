/* global JIFFClient */

(function (exports, node) {
  var saved_instance;

  /**
   * Connect to the server and initialize the jiff instance
   */
  exports.connect = function (hostname, computation_id, options) {
    var opt = Object.assign({}, options);

    if (node) {
      // eslint-disable-next-line no-global-assign
      JIFFClient = require('../../../lib/jiff-client');
    }

    saved_instance = new JIFFClient(hostname, computation_id, opt);
    return saved_instance;
  };

  /**
   * The MPC computation
   */
  exports.compute = function (jiff_instance) {
    if (jiff_instance == null) {
      jiff_instance = saved_instance;
    }

    var my_input = [ [1, 2, 3], [2, 3, 4], [3, 4, 5, 6]];

    var x = jiff_instance.share_2D_array(my_input, { 1: { rows: 3, cols: 3, 2: 4 }, 2: { rows: 3, cols: 2 } } );

    return x.then(function (arrays) {
      try {
        var arr = arrays[1];
        var arr2 = arrays[2];

        var result = [];
        for (var i = 0; i < Math.min(arr.length, arr2.length); i++) {
          result[i] = [];
          for (var j = 0; j < Math.min(arr[i].length, arr2[i].length); j++) {
            result[i][j] = arr[i][j].sadd(arr2[i][j]);
          }
        }

        var parties = {
          parties: [ 2 ], // default for all elements
          0: { parties: [ 1 ] }, // for first row
          2: { parties: [ 1, 2 ], 0: [ 1 ] } // last row, by default to 1, 2 except first element to 1 only.
        };

        var op_ids = 'custom me';

        return jiff_instance.open_2D_array(result, parties, op_ids);
      } catch (err) {
        console.log(err);
      }
    });
  };
}((typeof exports === 'undefined' ? this.mpc = {} : exports), typeof exports !== 'undefined'));
