const worker = new Worker('./web-worker.js');
function connect(party_id) {
  $('#connectButton').prop('disabled', true);
  const computation_id = $('#computation_id').val();
  const party_count = parseInt($('#count').val());

  if (isNaN(party_count)) {
    $('#output').append("<p class='error'>Party count must be a valid number!</p>");
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
  if (e.data.type === 'result1' || e.data.type === 'result2') {
    $('#output').append('<p>Result is: ' + e.data.result + '</p>');
    $('#button').attr('disabled', false);
  }
};

// eslint-disable-next-line no-unused-vars
function submit(party_id) {
  $('#submit' + String(party_id)).attr('disabled', true);
  const arr = JSON.parse(document.getElementById('inputText' + String(party_id)).value);

  for (let i = 0; i < arr.length; i++) {
    if (typeof arr[i] !== 'number') {
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
