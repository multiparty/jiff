/**
 * Do not modify this file unless you have to.
 * This file has UI handlers.
 */

// eslint-disable-next-line no-unused-vars
var computes = [];
function connect(party_id, party_count, compute_count, computation_id) {
  // Compute parties ids
  for (var c = 1; c <= compute_count; c++) {
    computes.push(c);
  }

  // jiff options
  var options = { party_count: party_count, party_id: party_id };
  options.onError = function (error) {
    $('#output').append('<p class=\'error\'>'+error+'</p>');
  };
  options.onConnect = function () {
    $('#output').append('<p>Connected!</p>');
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
  mpc.connect(hostname, computation_id, options, computes, function (id, cols) {
    var schema = 'Party ' + (id - computes.length - 1) + ': ' + cols.join(' | ') + '<br/>';
    document.getElementById('schema').innerHTML += schema;
  });
}

// eslint-disable-next-line no-unused-vars
function submit() {
  $('#output').append('<p>Starting...</p>');
  $('#submit').attr('disabled', true);

  // eslint-disable-next-line no-undef
  generateTable(mpc.compute());
}

/**
 * Helpers for HTML data generation and parsing
 */
function generateTable(result) {
  result.promise.then(function (data) {
    var cols = result.cols;

    var table = '<br/><table>';
    // Header
    table += '<tr>';
    for (var i = 0; i < cols.length; i++) {
      table += '<th><input type="text" disabled="disabled" value="'+cols[i]+'"></th>';
    }
    table += '</tr>';

    // Generate Body
    for (var j = 0; j < data.length; j++) {
      table += '<tr>';
      for (var k = 0; k < cols.length; k++) {
        var val = data[j][cols[k]];
        var input = '<input type="text" disabled="disabled" value="'+val+'">';
        table += '<td>' + input + '</td>';
      }
      table += '</tr>';
    }

    table += '</table>';
    $('#output').html(table);
  });
}