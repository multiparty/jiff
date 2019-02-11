(function (exports) {
  var jiff_instance;
  var computes;

  /**
   * Connect to the server and initialize the jiff instance
   */
  exports.connect = function (hostname, computation_id, options, _computes) {
    computes = _computes;
    var opt = Object.assign({}, options);

    // eslint-disable-next-line no-undef
    jiff_instance = jiff.make_jiff(hostname, computation_id, opt);
    return jiff_instance;
  };

  /**
   * The MPC computation
   */
  exports.compute = function (cols, data) {
    var scoped_cols = [];
    for (var i = 0; i < cols.length; i++) {
      scoped_cols[i] = (jiff_instance.id - computes.length - 1) + '.' + cols[i];
    }

    // Compute party and analyst ids.
    var copy = computes.slice();
    copy.push(computes.length + 1);

    // Send headers / schema
    jiff_instance.emit('headers', copy, JSON.stringify(scoped_cols), false);

    // Sort by key
    data.sort(function (x, y) {
      return x[cols[0]] - y[cols[0]];
    });

    // Split Array
    for (var c = 0; c < cols.length; c++) {
      var column = [];
      for (var d = 0; d < data.length; d++) {
        column.push(data[d][cols[c]]);
      }

      jiff_instance.share_array(column, null, computes.length, computes, [ jiff_instance.id ]);
    }
  };
}(this.mpc = {}));
