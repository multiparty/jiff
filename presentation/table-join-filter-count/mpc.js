(function (exports, node) {
  var saved_instance;

  /**
   * Connect to the server and initialize the jiff instance
   */
  exports.connect = function (hostname, computation_id, options) {
    var opt = Object.assign({}, options);

    if (node) {
      // eslint-disable-next-line no-undef
      jiff = require('../../lib/jiff-client');
    }

    // eslint-disable-next-line no-undef
    saved_instance = jiff.make_jiff(hostname, computation_id, opt);
    return saved_instance;
  };

  var binary_search = function (jiff_instance, element, keys, values) {
    if (keys.length === 0) {
      var found = keys[0].seq(element);
      var val = found.if_else(values[0], jiff_instance.Zp - 1);
      return { found: found, val: val };
    }

    // comparison
    var mid = Math.floor(keys.length/ 2);
    var cmp = element.slt(keys[mid]);

    // Slice array in half, choose slice depending on cmp
    var nKeys = [], nVals = values;
    for (var i = 0; i < mid; i++) {
      nKeys[i] = cmp.if_else(keys[i], keys[mid+i]);
      nVals[i] = cmp.if_else(values[i], values[mid+i]);
    }

    // watch out for off by 1 errors if length is odd.
    if (2*mid < keys.length) {
      nKeys[mid] = keys[2*mid];
      nVals[mid] = values[2*mid]
    }

    return binary_search(jiff_instance, element, nKeys, nVals);
  };

  var join = function (jiff_instance, SSNs1, vals1, SSNs2, vals2, ind1, ind2) {
    var data = [];
    for (var i = 0; i < SSNs1.length; i++) {
      var res = binary_search(SSNs1[i], SSNs2, vals2);

      var obj = {};
      obj[ind1] = res.found.if_else(vals1[i], jiff_instance.Zp - 1);
      obj[ind2] = res.val;
      data.push(obj);
    }

    return data;
  };

  /**
   * The MPC computation
   */
  exports.compute = function (data, jiff_instance) {
    if (jiff_instance == null) {
      jiff_instance = saved_instance;
    }

    // Sort by SSN
    data.sort(function (x, y) {
      return x.SSN - y.SSN;
    });

    // Split Array
    var SSNs = [];
    var vals = [];
    for (var d = 0; d < data.length; d++) {
      SSNs.push(data[d].SSN);
      vals.push(data[d].value);
    }

    var promise1 = jiff_instance.share_array(SSNs);
    var promise2 = jiff_instance.share_array(vals);
    Promise.all([promise1, promise2]).then(function (shares) {
      var SSNs1 = shares[0][1];
      var SSNs2 = shares[0][2];
      var vals1 = shares[0][1];
      var vals2 = shares[0][2];

      var data = [];
      if (SSNs1.length < SSNs2.length) {
        data = join(jiff_instance, SSNs1, vals1, SSNs2, vals2, 1, 2);
      } else {
        data = join(jiff_instance, SSNs2, vals2, SSNs1, vals1, 2, 1);
      }
    });

    // Return a promise to the final output(s)
    return jiff_instance.open();
  };
}((typeof exports === 'undefined' ? this.mpc = {} : exports), typeof exports !== 'undefined'));
