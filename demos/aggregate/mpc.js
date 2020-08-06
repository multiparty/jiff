var promises;
(function (exports, node) {
  var saved_instance;

  /**
   * Connect to the server and initialize the jiff instance
   */
  exports.connect = function (hostname, computation_id, options) {
    var opt = Object.assign({}, options);
    opt.crypto_provider = true;
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

    var ids = Array(column2.length).fill(null);
    var values = Array(column2.length).fill(null);

    if (jiff_instance.id === 1) {
      var groups = column2;

      // Assign a numeric ID for each patient corresponding to the hospital he/she was in.
      var mapping = {};
      ids = groups.map(function (group) {
        var id = mapping[group];
        if (id === undefined) {
          id = Object.keys(mapping).length;
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

    var secret_ids = ids.map(function (s) {
      return jiff_instance.share(s, null, [1, 2], [1])[1];
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
      // secret_id.logLEAK('secret_id ' + i);
      // secret_value.logLEAK('secret_value ' + i);
      for (var id = 0; id < totals.length; id++) {
        totals[id] = totals[id].sadd(secret_id.ceq(id).smult(secret_value));
      }
    }

    // Return a promise to the final output(s)
    promises = totals.map(function (s) { return jiff_instance.open(s); });
    return new Promise(function (resolve) {
      Promise.all(promises).then(function (arr) {
        var obj = {};
        for (var i = 0; i < arr.length; i++) {
          obj[CATEGORIES[i]] = arr[i];
        }
        resolve(obj);
      });
    });
  };
}((typeof exports === 'undefined' ? this.mpc = {} : exports), typeof exports !== 'undefined'));
