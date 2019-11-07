/**
 * Do not modify this file unless you have to.
 * This file has UI handlers.
 */

// eslint-disable-next-line no-unused-vars
var computes = [];
function connect(party_id, party_count, compute_count, computation_id) {
  def = defaults[party_id];
  hed = headers[party_id];
  document.getElementById('rows').value = def.length / 2;

  // Compute parties ids
  for (var c = 1; c <= compute_count; c++) {
    computes.push(c);
  }

  // jiff options
  var options = { party_count: party_count, party_id: party_id };
  options.onError = function (error) {
    $('#output').append('<p class=\'error\'>'+error+'</p>');
  };

  // host name
  var hostname = window.location.hostname.trim();
  var port = window.location.port;
  if (port == null || port === '') {
    port = '80';
  }
  if (!(hostname.startsWith('http://') || hostname.startsWith('https://'))) {
    hostname = 'http://' + hostname;
  }
  if (hostname.endsWith('/')) {
    hostname = hostname.substring(0, hostname.length-1);
  }
  if (hostname.indexOf(':') > -1 && hostname.lastIndexOf(':') > hostname.indexOf(':')) {
    hostname = hostname.substring(0, hostname.lastIndexOf(':'));
  }

  hostname = hostname + ':' + port;

  // eslint-disable-next-line no-undef
  var jiff_instance = mpc.connect(hostname, computation_id, options, computes);

  // Display connection
  jiff_instance.wait_for(computes, function () {
    $('#output').append('<p>Connected!</p>');
  });
}

// eslint-disable-next-line no-unused-vars
function submit() {
  $('#output').append('<p>Starting...</p>');
  $('#submit').attr('disabled', true);

  var parsed = parseInput();
  // eslint-disable-next-line no-undef
  mpc.compute(parsed['cols'], parsed['data']);

  $('#output').append('<p>Shared data successfully!</p>');
}

/**
 * Helpers for HTML data generation and parsing
 */
function generateTable(cols, rows) {
  $('#generate').attr('disabled', true);
  $('#submit').attr('disabled', false);

  var table = '<br/><table id="input_table">';
  // Header
  table += '<tr>';
  for (var i = 0; i < cols; i++) {
    table += '<th><input type="text" value="'+hed[i]+'"></th>';
  }
  table += '</tr><tr><td colspan="10"></td></tr>';

  // Generate Body
  for (var j = 0; j < rows; j++) {
    table += '<tr>';
    for (var k = 0; k < cols; k++) {
      var input = '<input type="text" value="'+def[j*cols+k]+'">';
      table += '<td>' + input + '</td>';
    }
    table += '</tr>';
  }

  table += '</table><br/><br/>';
  $('#input_area').html(table);
}
function parseInput() {
  var cols = [];
  var data = [];

  var table = document.getElementById('input_table');

  // headers
  for (var c = 0; c < table.rows[0].cells.length; c++) {
    var col = table.rows[0].cells[c].getElementsByTagName('input')[0].value;
    cols.push(col);
  }

  // body
  for (var i = 2; i < table.rows.length; i++) {
    var row = table.rows[i];
    var obj = {};
    for (var j = 0; j < cols.length; j++) {
      var cell = row.cells[j];
      obj[cols[j]] = cell.getElementsByTagName('input')[0].value;
    }
    data.push(obj);
  }

  return { cols: cols, data: data};
}

/* var defaults = {
  5: ['A', 10, 'B', 5, 'C', 2],
  6: ['Z', 5],
  7: ['A', 'True', 'B', 'True', 'Z', 'True'],
  8: ['A', 'Group A', 'B', 'Group B', 'Z', 'Group C']
}; */

var defaults = {
  5: [ 'Alice', 10.23, 'Lora', 20.30, 'Bob', 0.12 ],
  6: [ 'Kinan', 30, 'Caroline', 5.99 ],
  7: [ 'Alice', 'False', 'Kinan', 'True', 'John', 'True', 'Lora', 'True', 'Caroline', 'True' ],
  8: [ 'Alice', 'Group A', 'John', 'Group A', 'Kinan', 'Group B', 'Caroline', 'Group B', 'Lora', 'Group C', 'Sam', 'Group B' ]
};

var headers = {
  5: ['ID', 'VALUE'],
  6: ['ID', 'VALUE'],
  7: ['ID', 'FILTER'],
  8: ['ID', 'GROUP']
};

var def;
var hed;