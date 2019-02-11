var GROUP_BY_DOMAIN = [1, 2, 3];

(function (exports) {
  var jiff_instance;
  var computes;
  var schemas = {};

  /**
   * Connect to the server and initialize the jiff instance
   */
  exports.connect = function (hostname, computation_id, options, _computes, schema_callback) {
    computes = _computes;
    var opt = Object.assign({}, options);

    // eslint-disable-next-line no-undef
    jiff_instance = jiff.make_jiff(hostname, computation_id, opt);
    jiff_instance.listen('headers', function (id, cols) {
      cols = JSON.parse(cols);
      schemas[id] = cols;

      if (id > computes.length) {
        schema_callback(id, cols);
      }
    });
  };

  /**
   * The MPC computation
   */
  exports.compute = function (cols, data) {
    jiff_instance.emit('compute', computes, '', false);

    var inputs = [];
    for (var i = computes.length + 2; i <= jiff_instance.party_count; i++) {
      inputs.push(i);
    }

    // Schema
    var output_schema = ['GROUP BY', 'AVG'];

    // Receive result
    var promises = [];
    for (var g = 0; g < GROUP_BY_DOMAIN.length; g++) {
      var promise1 = jiff_instance.receive_open(computes);
      var promise2 = jiff_instance.receive_open(computes);

      (function scope(g) {
        promises.push(Promise.all([promise1, promise2]).then(function (res) {
          var obj = {};
          obj[output_schema[0] = GROUP_BY_DOMAIN[g];
          obj[output_schema[1]] = res[1] > 0 ? res[0] / res[1] : '-';
          return obj;
        }));
      }(g));
    }

    return { promise: Promise.all(promises), cols: output_schema };
  };
}(this.mpc = {}));
