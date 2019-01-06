/**
 * Do not modify this file unless you have to.
 * This file has UI handlers.
 */

// eslint-disable-next-line no-unused-vars
function connect() {
  $('#connectButton').prop('disabled', true);
  var computation_id = $('#computation_id').val();
  var party_count = parseInt($('#count').val());
  var party_id = parseInt($('#role').val());

  if (isNaN(party_count)) {
    $('#output').append('<p class=\'error\'>Party count must be a valid number!</p>');
    $('#connectButton').prop('disabled', false);
  } else {
    var options = { party_count: party_count, party_id: party_id };
    options.onError = function (error) {
      $('#output').append('<p class=\'error\'>'+error+'</p>');
    };
    options.onConnect = function () {
      $('#button').attr('disabled', false);
      $('#submit').attr('disabled', false);
      $('#output').append('<p>All parties Connected!</p>');
    };

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
    mpc.connect(hostname, computation_id, options);
  }
}

// eslint-disable-next-line no-unused-vars
function submit() {
  var party_id = parseInt($('#role').val());

  var data = [];
  var table = document.getElementById('input_table');
  for (var i = 1; i < table.rows.length; i++) {
    var row = table.rows[i];
    var SSN = row.cells[0].getElementsByTagName('input')[0].value;
    var value = row.cells[1].getElementsByTagName('input')[0].value;

    SSN = parseInt(SSN.split('-').join(''));
    if (isNaN(SSN)) {
      $('#output').append('<p class=\'error\'>Make sure all SSNs are valid!</p>');
      return;
    }

    if (party_id === 1) {
      if (value !== 'M' && value !== 'F') {
        $('#output').append('<p class=\'error\'>Gender must be M or F!</p>');
        return;
      }

      value = value === 'F' ? 1 : 0;
    }
    
    data.push({ SSN: SSN, value: value });
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

  _submit(SSNS, vals);
}

function _submit(SSNs, vals) {
  $('#button').attr('disabled', true);
  $('#submit').attr('disabled', true);
  $('#output').append('<p>Starting...</p>');
  // eslint-disable-next-line no-undef
  var promise = mpc.compute(SSNs, vals);
  promise.then(handleResult);
}

function handleResult(result) {
  var HEADERS = [ 'GENDER', 'NUMBER OF PEOPLE WITH INCOME > 1000' ];

  var table = '<table>';
  // Header
  table += '<tr>';
  for (var i = 0; i < HEADERS.length; i++) {
    table += '<th>'+HEADERS[i]+'</th>';
  }
  table += '</tr>';

  // Generate Body
  for (var j = 0; j < result.length; j++) {
    table += '<tr>';  
    table += '<td>' + result[j].gender + '</td>';
    table += '<td>' + result[j].count + '</td>';
    table += '</tr>';
  }

  table += '</table>';
  $('#output').html(table);
  $('#submit').attr('disabled', false);
  $('#button').attr('disabled', false);
}

function generateTable(size) {
  var HEADERS = [ 'SSN' ];
  var party_id = parseInt($('#role').val());
  HEADERS[1] = party_id === 1 ? 'GENDER' : 'INCOME';

  var table = '<br/><table id="input_table">';
  // Header
  table += '<tr>';
  for (var i = 0; i < HEADERS.length; i++) {
    table += '<th>'+HEADERS[i]+'</th>';
  }
  table += '</tr>';

  // Generate Body
  for (var j = 0; j < size; j++) {
    table += '<tr>';  
    for (var k = 0; k < HEADERS.length; k++) {
      var input = '<input type="text">';
      table += '<td>' + input + '</td>';
    }
    table += '</tr>';
  }

  table += '</table>';
  $('#input_area').html(table);
}
