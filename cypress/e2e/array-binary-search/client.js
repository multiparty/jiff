let worker = new Worker('./web-worker.js');

function connect(party_id) {
  $('#connectButton').prop('disabled', true);
  var computation_id = $('#computation_id').val();

  var options = { party_id: party_id, party_count: 2, Zp: 13 };

  var hostname = window.location.hostname.trim();
  var port = window.location.port;
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
  if (party_id === 1) {
    worker.postMessage({
      type: 'init_array',
      hostname: hostname,
      computation_id: computation_id,
      options: options
    });
  } else if (party_id === 2) {
    worker.postMessage({
      type: 'init_elem',
      hostname: hostname,
      computation_id: computation_id,
      options: options
    });
  }
}

worker.onmessage = function (e) {
  if (e.data.type === 'array' || e.data.type === 'element') {
    const msg = e.data.result === 1 ? 'Element Found' : 'Element Does Not Exist';
    document.querySelector('#output').innerHTML += `<p>${msg}</p>`;
  }
};

// eslint-disable-next-line no-unused-vars
function submitArray() {
  var arr = JSON.parse($('#inputArray').val());
  for (var i = 0; i < arr.length; i++) {
    if (arr[i] >= 13) {
      alert('All numbers must be less than 13');
      return;
    }
  }

  worker.postMessage({
    type: 'computeArray',
    input: arr
  });
}

// eslint-disable-next-line no-unused-vars
function submitElement() {
  var element = $('#inputElement').val();
  element = parseInt(element);
  if (element == null || isNaN(element)) {
    alert('Element must be a whole number');
    return;
  }
  if (element < 0 || element >= 13) {
    alert('Element must be between 0 and 13 exclusive');
    return;
  }

  worker.postMessage({
    type: 'computeElement',
    input: element
  });
}
