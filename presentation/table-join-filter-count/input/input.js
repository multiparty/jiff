/**
 * Do not modify this file unless you have to.
 * This file has UI handlers.
 */

// eslint-disable-next-line no-unused-vars
var computes = [];
function connect(party_id, party_count, compute_count, computation_id) {
  def = defaults[party_id];

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
    table += '<th><input type="text" value="'+i+'"></th>';
  }
  table += '</tr>';

  // Generate Body
  for (var j = 0; j < rows; j++) {
    table += '<tr>';
    for (var k = 0; k < cols; k++) {
      var input = '<input type="text" value="'+def[j*cols+k]+'">';
      table += '<td>' + input + '</td>';
    }
    table += '</tr>';
  }

  table += '</table>';
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
  for (var i = 1; i < table.rows.length; i++) {
    var row = table.rows[i];
    var obj = {};
    for (var j = 0; j < cols.length; j++) {
      var cell = row.cells[j];
      obj[cols[j]] = parseInt(cell.getElementsByTagName('input')[0].value);
    }
    data.push(obj);
  }

  return { cols: cols, data: data};
}

var defaults = {
  5: [ 1, 10, 2, 20 ],
  6: [ 3, 30 ],
  7: [ 1, 1, 2, 2, 3, 1 ],
  8: [ 1, 1, 2, 2, 3, 1 ]
};
var def;