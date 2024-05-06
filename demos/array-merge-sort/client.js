const worker = new Worker('./web-worker.js');
function connect(party_id) {
  $('#connectButton').prop('disabled', true);
  const computation_id = $('#computation_id').val();
  const party_count = parseInt($('#count').val());

  if (isNaN(party_count)) {
    $('#output').append('<p class="error">Party count must be a valid number!</p>');
    $('#connectButton').prop('disabled', false);
  } else {
    const options = { party_count: party_count };

    let hostname = window.location.hostname.trim();
    let port = window.location.port;
    if (port == null || port === '') {
      port = '80';
    }
    if (!(hostname.startsWith('http://') || hostname.startsWith('https://'))) {
      hostname = 'http://' + hostname;
    }
    if (hostname.endsWith('/')) {
      hostname = hostname.substring(0, hostname.length - 1);
    }
    if (hostname.indexOf(':') > -1 && hostname.lastIndexOf(':') > hostname.indexOf(':')) {
      hostname = hostname.substring(0, hostname.lastIndexOf(':'));
    }

    hostname = hostname + ':' + port;

    // eslint-disable-next-line no-undef
    worker.postMessage({
      type: 'init_' + String(party_id),
      hostname: hostname,
      computation_id: computation_id,
      options: options
    });
  }
}

worker.onmessage = function (e) {
  if ($('#output').is(':empty') && (e.data.type === 'result1' || e.data.type === 'result2')) {
    $('#output').append('<p>Result is: ' + e.data.result + '</p>');
    $('#button').attr('disabled', false);
  }
};

// eslint-disable-next-line no-unused-vars
function submit(party_id) {
  $('#submit' + String(party_id)).attr('disabled', true);

  const arr = JSON.parse(document.getElementById('inputText' + String(party_id)).value);

  // Ensure array has only numbers
  for (let i = 0; i < arr.length; i++) {
    if (isNaN(arr[i])) {
      $('#output').append('<p class="error">Please input an array of valid numbers!</p>');
      return;
    } else if (100 < arr[i] || arr[i] < 0 || arr[i] !== Math.floor(arr[i])) {
      $('#output').append('<p class="error">Please input an array of whole numbers between 0 and 100!</p>');
      return;
    }
  }

  // Ensure array length is a power of 2
  let lg = arr.length;
  while (lg > 1) {
    if (lg % 2 !== 0) {
      $('#output').append('<p class="error">Input array length must be a power of 2!</p>');
      return;
    }

    lg = lg / 2;
  }

  // eslint-disable-next-line no-undef
  worker.postMessage({
    type: 'compute' + String(party_id),
    input: arr
  });
}
