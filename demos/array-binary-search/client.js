/*
 * Do not modify this file unless you have too
 * This file has UI handlers.
 */
// eslint-disable-next-line no-unused-vars
function connect() {
  $('#connectButton').prop('disabled', true);
  var computation_id = $('#computation_id').val();
  var party_id = parseInt($('#role').val());

  var options = { party_id: party_id, party_count: 2, Zp: 13 };
  options.onError = function (_, error) {
    $('#output').append('<p class="error">'+error+'</p>');
    $('#connectButton').prop('disabled', false);
  };
  options.onConnect = function () {
    if (party_id === 1) {
      $('#input1').show();
    } else {
      $('#input2').show();
    }
    $('#result').append('All parties Connected!<br/>');
  };

  var hostname = window.location.hostname.trim();
  var port = window.location.port;
  if (port == null || port === '') {
    port = '80';
  } if (!(hostname.startsWith('http://') || hostname.startsWith('https://'))) {
    hostname = 'http://' + hostname;
  } if (hostname.endsWith('/')) {
    hostname = hostname.substring(0, hostname.length - 1);
  } if (hostname.indexOf(':') > -1 && hostname.lastIndexOf(':') > hostname.indexOf(':')) {
    hostname = hostname.substring(0, hostname.lastIndexOf(':'));
  }

  hostname = hostname + ':' + port;

  // eslint-disable-next-line no-undef
  mpc.connect(hostname, computation_id, options);
}

// eslint-disable-next-line no-unused-vars
function submitArray() {
  var arr = JSON.parse($('#inputArray').val());
  for (var i = 0; i < arr.length; i++) {
    if (arr[i] >= 13) {
      alert('All numbers must be less than 13');
      return;
    }
  }

  // eslint-disable-next-line no-undef
  var promise = mpc.compute(arr);

  promise.then(function (result) {
    var msg = result === 1 ? 'Element Found' : 'Element Does Not Exist';
    $('#output').append('<p>' + msg + '</p>');
  });
}

// eslint-disable-next-line no-unused-vars
function submitElement() {
  var element = $('#inputElement').val();
  element = parseInt(element);
  if (element == null || isNaN(element)) {
    alert('Element must be a whole number');
    return;
  } if (element < 0 || element >= 13) {
    alert('Element must be between 0 and 13 exclusive');
    return;
  }

  // eslint-disable-next-line no-undef
  var promise = mpc.compute(element);

  promise.then(function (result) {
    var msg = result === 1 ? 'Element Found' : 'Element Does Not Exist';
    $('#output').append('<p>' + msg + '</p>');
  });
}