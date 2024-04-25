/**
 * Do not modify this file unless you have too
 * This file has UI handlers.
 */
var upper_count;
var lower_count;
var jiff_instance;

// eslint-disable-next-line no-unused-vars
function connect() {
  $('#connectButton').prop('disabled', true);
  var computation_id = $('#computation_id').val();
  upper_count = parseInt($('#upper_count').val());
  lower_count = parseInt($('#lower_count').val());
  var party_id = parseInt($('#party_id').val());

  if (isNaN(upper_count) || isNaN(lower_count) || isNaN(party_id)) {
    $('#output').append('<p class="error">Party counts and id must be valid numbers!</p>');
    $('#connectButton').prop('disabled', false);
  } else {
    var options = { party_count: upper_count+lower_count, party_id: party_id, Zp: 127 };
    options.onError = function (_, error) {
      $('#connectButton').attr('disabled', false);
      $('#output').append('<p class="error">'+error+'</p>');
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
    jiff_instance = mpc.connect(hostname, computation_id, options);

    var upper_parties = ['s1'];
    for (var i = lower_count + 1; i <= upper_count + lower_count; i++) {
      upper_parties.push(i);
    }
    jiff_instance.wait_for(upper_parties, function () {
      $('#button').attr('disabled', false);
      $('#output').append('<p>All upper parties Connected! My ID: ' + jiff_instance.id + '</p>');
    });
  }
}

// eslint-disable-next-line no-unused-vars
function submit() {
  var input = parseInt($('#number').val());
  var threshold = parseInt($('#threshold').val());

  if (isNaN(input) || isNaN(threshold)) {
    $('#output').append('<p class="error">Input a valid number and threshold!</p>');
  } else if (100 < input || input < 0 || input !== Math.floor(input)) {
    $('#output').append('<p class="error">Input a WHOLE number between 0 and 100!</p>');
  } else if (100 < threshold || threshold < 0 || threshold !== Math.floor(threshold)) {
    $('#output').append('<p class="error">Threshold must be a WHOLE number between 0 and 100!</p>');
  } else {
    $('#reconnect').attr('disabled', true);
    $('#button').attr('disabled', true);
    $('#output').append('<p>Starting...</p>');

    // eslint-disable-next-line no-undef
    var promise = mpc.compute({ value: input, threshold: threshold, upper_count: upper_count, lower_count: lower_count });

    // disconnect if you are a lower party
    if (jiff_instance.id <= lower_count) {
      jiff_instance.disconnect(true);
      $('#output').append('<p>Data submitted! disconnected! Reconnect to check if results are available.</p>');
      $('#reconnect').attr('disabled', false);
    }

    if (promise != null) {
      promise.then(handleResult);
    }
  }
}

// eslint-disable-next-line no-unused-vars
function reconnect() {
  jiff_instance.connect();
}

function handleResult(result) {
  $('#output').append('<p>There are ' + result + ' parties with inputs larger than the threshold!</p>');
  $('#button').attr('disabled', false);
}
