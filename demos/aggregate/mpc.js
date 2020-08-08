var promises;
(function (exports, node) {
  var saved_instance;

  /**
   * Connect to the server and initialize the jiff instance
   */
  exports.connect = function (hostname, computation_id, options) {
    var opt = Object.assign({}, options);
    opt.crypto_provider = true;
    opt.crypto_provider = false;
    opt.Zp = 101;

    if (node) {
      // eslint-disable-next-line no-undef
      JIFFClient = require('../../lib/jiff-client');
    }

    // eslint-disable-next-line no-undef
    saved_instance = new JIFFClient(hostname, computation_id, opt);
    return saved_instance;
  };

  /**
   * The MPC computation
   */
  exports.compute = function (column1, column2, jiff_instance) {
    if (jiff_instance == null) {
      jiff_instance = saved_instance;
    }

    // Do not use crypto provider, perform preprocessing!
    jiff_instance.preprocessing('open', CATEGORIES_COUNT, null, null, [1, 2], [1, 2], null, null, {open_parties: [1, 2]});
    jiff_instance.preprocessing('smult', column2.length * CATEGORIES_COUNT, null, null, [1, 2], [1, 2], null, null, {div: false});

    // Create a promise to return the final output(s)
    return new Promise(function (resolve) {
      jiff_instance.executePreprocessing(function () {
        var ids = Array(column2.length).fill(Array(CATEGORIES_COUNT).fill(null));
        var values = Array(column2.length).fill(null);

        if (jiff_instance.id === 1) {
          var groups = column2;

          // Assign a numeric ID for each patient corresponding to the hospital he/she was in.
          var mapping = {};
          ids = groups.map(function (group) {
            var id = mapping[group];
            if (id === undefined) {
              var unit_vector = Array(CATEGORIES_COUNT).fill(0);
              unit_vector[Object.keys(mapping).length] = 1;
              id = unit_vector;
              mapping[group] = id;
            }
            return id;
          });
          console.log(mapping);
        } else if (jiff_instance.id === 2) {
          values = column2.map(Number);
        } else {
          throw new Error('JIFF party id must be either 1 or 2');
        }

        var secret_ids = ids.map(function (id) {
          return id.map(function (bit) {
            return jiff_instance.share(bit, null, [1, 2], [1])[1];
          });
        });
        var secret_values = values.map(function (s) {
          return jiff_instance.share(s, null, [1, 2], [2])[2];
        });

        // The MPC implementation should go *HERE*
        var totals = Array(CATEGORIES_COUNT);
        for (var i = 0; i < totals.length; i++) {
          totals[i] = jiff_instance.share(0)[1];//.protocols.generate_zero();
        }
        for (var i = 0; i < secret_values.length; i++) {
          var secret_id = secret_ids[i];
          var secret_value = secret_values[i];
          for (var id = 0; id < totals.length; id++) {
            var is_cat = secret_id[id];  // is `id` the correct category for this value?
            totals[id] = totals[id].sadd(is_cat.smult(secret_value));
          }
        }

        // Reveal the final tallies
        promises = totals.map(function (s) { return jiff_instance.open(s); });

        // Collect all promises to the final output and resolve
        Promise.all(promises).then(function (arr) {
          var obj = {};
          for (var i = 0; i < arr.length; i++) {
            obj[CATEGORIES[i]] = arr[i];
          }
          resolve(obj);
        });
      });
    });
  };
}((typeof exports === 'undefined' ? this.mpc = {} : exports), typeof exports !== 'undefined'));
