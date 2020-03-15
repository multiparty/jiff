/**
 * Do not modify this file unless you have to.
 * This file has UI handlers.
 */
// eslint-disable-next-line no-unused-vars
function connect() {
  $('#connectButton').prop('disabled', true);
  var computation_id = $('#computation_id').val();
  var party_count = parseInt($('#count').val());
  var party_id = parseInt($('#role').val()); // NOT IN TEMPLATE: party id is important to specify the role

  if (isNaN(party_count)) {
    $('#output').append("<p class='error'>Party count must be a valid number!</p>");
    $('#connectButton').prop('disabled', false);
  } else {
    var options = { party_count: party_count, party_id: party_id };
    options.onError = function (_, error) {
      $('#output').append("<p class='error'>"+error+'</p>');
    };
    options.onConnect = function () {
      $('#button').attr('disabled', false); $('#output').append('<p>All parties Connected!</p>');
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
  var input = $('#input').val();

  if (input.length == null) {
    $('#output').append("<p class='error'>Input a valid string!</p>");
  } else {
    $('#button').attr('disabled', true);
    $('#output').append('<p>Starting...</p>');
    // eslint-disable-next-line no-undef
    var promise = mpc.compute(input);
    promise.then(handleResult);
  }
}

function handleResult(results) {
  for (var i = 0; i < results.length; i++) {
    if (results[i] === 1) {
      $('#output').append('<p>Substring found at index: ' + i + '.</p>');
    }
  }
  $('#output').append('<p>Done</p><br/>');
  $('#button').attr('disabled', false);
}
