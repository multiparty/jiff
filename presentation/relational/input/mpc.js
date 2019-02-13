(function (exports) {
  var jiff_instance;
  var computes;

  /**
   * Connect to the server and initialize the jiff instance
   */
  exports.connect = function (hostname, computation_id, options, _computes) {
    computes = _computes;
    var opt = Object.assign({}, options);

    opt.Zp = '16381';
    opt.integer_digits = 2;
    opt.decimal_digits = 2;

    // eslint-disable-next-line no-undef
    jiff_instance = jiff.make_jiff(hostname, computation_id, opt);
    // eslint-disable-next-line no-undef
    jiff_instance.apply_extension(jiff_bignumber, opt);
    // eslint-disable-next-line no-undef
    jiff_instance.apply_extension(jiff_fixedpoint, opt);

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

    // Parsing
    var l;
    for (l = 0; l < data.length; l++) {
      data[l][cols[0]] = data[l][cols[0]].toUpperCase().trim();
      data[l][cols[0]] = data[l][cols[0]].charCodeAt(0) - 'A'.charCodeAt(0) + 1;
    }

    if (jiff_instance.id === 5 || jiff_instance.id === 6) {
      for (l = 0; l < data.length; l++) {
        data[l][cols[1]] = Number(data[l][cols[1]]);
      }
    } else if (jiff_instance.id === 7) {
      for (l = 0; l < data.length; l++) {
        data[l][cols[1]] = data[l][cols[1]].toLowerCase() === 'true' ? 1 : 2;
      }
    } else if (jiff_instance.id === 8) {
      for (l = 0; l < data.length; l++) {
        data[l][cols[1]] = data[l][cols[1]].toUpperCase().trim();
        var ln = data[l][cols[1]].length;
        data[l][cols[1]] = data[l][cols[1]].charCodeAt(ln-1) - 'A'.charCodeAt(0) + 1;
      }
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
