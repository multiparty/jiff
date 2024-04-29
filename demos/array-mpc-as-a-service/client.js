let worker = new Worker('./web-worker.js');
/* global config */

// eslint-disable-next-line no-unused-vars
function connect(party_id) {
  $('#connectButton').prop('disabled', true);
  var computation_id = $('#computation_id').val();

  var options = { party_count: config.party_count };

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
  worker.postMessage({
    type: 'init_' + String(party_id),
    hostname: hostname,
    computation_id: computation_id,
    options: options,
    config: config
  });
}

// eslint-disable-next-line no-unused-vars
function submit(party_id) {
  var arr = JSON.parse(document.getElementById('inputText' + String(party_id)).value);

  if (arr.length !== config.input_length) {
    alert('Please input an array of length ' + config.input_length + '.');
    return;
  }

  for (var i = 0; i < arr.length; i++) {
    if (typeof(arr[i]) !== 'number') {
      alert('Please input an array of integers.');
      return;
    }
  }
  // eslint-disable-next-line no-undef
  worker.postMessage({
    type: 'compute' + String(party_id),
    input: arr
  });
}

worker.onmessage = function (e) {
  if ($('#output').is(':empty') && (e.data.type === 'result1' || e.data.type === 'result2')) {
    $('#output').append('<p>The sum is ' + e.data.result[0] + ' and the inner product is ' + e.data.result[1] + '.</p>');
    $('#button').attr('disabled', false);
  }
};