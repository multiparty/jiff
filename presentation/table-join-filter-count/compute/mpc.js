var FILTER_VALUE = 1;
var GROUP_BY_DOMAIN = [1, 2, 3];

// Configurations
var config = require('../config.json');
var computes = [];
for (var c = 1; c <= config.compute; c++) {
  computes.push(c);
}
var analyst = computes.length + 1;
var inputs = [];
for (var i = config.compute + 2; i <= config.total; i++) {
  inputs.push(i);
}

// Schemas
var schemas = {};

/**
 * Connect to the server and initialize the jiff instance
 */
exports.connect = function (hostname, computation_id, options) {
  var opt = Object.assign({}, options);
  var jiff = require('../../../lib/jiff-client');

  // eslint-disable-next-line no-undef
  var jiff_instance = jiff.make_jiff(hostname, computation_id, opt);
  jiff_instance.listen('headers', function (id, cols) {
    cols = JSON.parse(cols);
    schemas[id] = cols;
  });
};

function transform(table) {
  var nTable = [];
  for (var key in table) {
    if (!table.hasOwnProperty(key)) {
      continue;
    }

    for (var i = 0; i < table[key].length; i++) {
      if (nTable[i] == null) {
        nTable[i] = {};
      }

      nTable[i][key] = table[key][i];
    }
  }
  return nTable;
}

/**
 * The MPC computation
 */
exports.compute = function (jiff_instance) {
  var join = require('./join.js');

  // ids
  var in0 = inputs[0];
  var in1 = inputs[1];
  var in2 = inputs[2];
  var in3 = inputs[3];

  // Receive shares
  var promises = [];
  for (var i = 0; i < inputs.length; i++) {
    var input_id = inputs[i];
    var party_promises = [];
    for (var c = 0; c < schemas[input_id].length; c++) {
      party_promises.push(jiff_instance.share_array([], null, null, computes, [ input_id ]));
    }

    (function scope(input_id) {
      var promise = Promise.all(party_promises).then(function (results) {

        var matrix = {};
        for (var k = 0; k < schemas[input_id].length; k++) {
          var col = schemas[input_id][k];
          matrix[col] = results[k][input_id];
        }
        return matrix;
      });
      promises.push(promise);
    }(input_id));
  }

  // Begin Work
  Promise.all(promises).then(function (results) {
    // Formatting
    var matrices = {};
    for (var i = 0; i < inputs.length; i++) {
      matrices[inputs[i]] = results[i];
    }

    // Concatenate first and second parties input
    for (var c = 0; c < schemas[in0].length; c++) {
      var col0 = schemas[in0][c];
      var col1 = schemas[in1][c];
      matrices[in1][col1] = matrices[in0][col0].concat(matrices[in1][col1]);
    }
    delete matrices[in0];
    return matrices;

  }).then(function (matrices) {

    // projections
    for (var p = 1; p < inputs.length; p++) {
      var input_id = inputs[p];
      for (var c = 2; c < schemas[input_id].length; c++) {
        delete matrices[input_id][schemas[input_id][c]];
      }

      matrices[input_id] = transform(matrices[input_id]);
    }

    return matrices;

  }).then(function (matrices) {
    // have 3 tables, each containing [id, <col>]
    var table = join(jiff_instance, matrices[in1], matrices[in2], schemas[in1], schemas[in2]);
    table = join(jiff_instance, table, matrices[in3], schemas[in1].concat([schemas[in2][1]]), schemas[in3]);
    return table;
  }).then(function (table) {
    // Output is an average and a group.
    var output_schema = [schemas[in1][1], schemas[in3][1]];

    // Filter
    var filter_key = schemas[in2][1];
    var avg_key = output_schema[0];
    var group_key = output_schema[1];
    for (var i = 0; i < table.length; i++) {
      var row = table[i];
      var outrow = {};

      var condition = row[filter_key].ceq(FILTER_VALUE);
      outrow[avg_key] = row[avg_key];
      outrow[group_key] = condition.if_else(row[group_key], 0);

      table[i] = outrow;
    }
    return table;

  }).then(function (table) {
    // Output is an average and a group.
    var output_schema = [schemas[in1][1], schemas[in3][1]];

    // Group by and average
    var avg_col = [];
    var count_col = [];

    var avg_key = output_schema[0];
    var group_key = output_schema[1];
    for (var z = 0; z < GROUP_BY_DOMAIN.length; z++) {
      avg_col.push(0);
      count_col.push(0);
    }

    for (var d = 0; d < table.length; d++) {
      var row = table[d];
      for (var g = 0; g < GROUP_BY_DOMAIN.length; g++) {
        var condition = row[group_key].ceq(GROUP_BY_DOMAIN[g]);
        var if_ = condition.if_else(row[avg_key], 0);

        avg_col[g] = if_.add(avg_col[g]);
        count_col[g] = condition.add(count_col[g]);
      }
    }

    return { avg: avg_col, count: count_col };
  }).then(function (results) {
    var output_schema = ['avg', 'count'];
    // All is done, open the result.
    for (var gi = 0; gi < GROUP_BY_DOMAIN.length; gi++) {
      for (var si = 0; si < output_schema.length; si++) {
        jiff_instance.open(results[output_schema[si]][gi], [analyst]);
      }
    }
  }).catch(function (err) {
    console.log(err);
  });
};
