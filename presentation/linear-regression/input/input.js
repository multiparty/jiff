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
  mpc.compute(parsed);

  $('#output').append('<p>Shared data successfully!</p>');
}

/**
 * Helpers for HTML data generation and parsing
 */
function generateTable(points, id) {
  $('#generate').attr('disabled', true);
  $('#submit').attr('disabled', false);

  var table = '<br/><table id="input_table">';
  // Header
  table += '<tr>';
  table += '<th><input type="text" value="' + (id === 4 ? 'X' : 'Y') +'"></th>';
  table += '</tr>';

  // Generate Body
  for (var j = 0; j < points; j++) {
    table += '<tr>';
    var input = '<input type="text" value="'+def[j]+'">';
    table += '<td>' + input + '</td>';
    table += '</tr>';
  }

  table += '</table>';
  $('#input_area').html(table);
}
function parseInput() {
  var data = [];

  var table = document.getElementById('input_table');

  // body
  for (var i = 1; i < table.rows.length; i++) {
    var row = table.rows[i];
    data.push(parseInt(row.getElementsByTagName('input')[0].value));
  }

  return data;
}

var defaults = {
  4: [ 1, 2, 3 ],
  5: [ 2, 4, 6 ]
};
var def;