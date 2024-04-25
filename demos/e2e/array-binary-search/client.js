let worker = new Worker('./web-worker.js');

function connect(party_id) {
  $('#connectButton').prop('disabled', true);
  let computation_id = $('#computation_id').val();

  let options = { party_id: party_id, party_count: 2, Zp: 13 };

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

worker.onmessage = function (e) {
  if (e.data.type === 'result1' || e.data.type === 'result2') {
    const msg = e.data.result === 1 ? 'Element Found' : 'Element Does Not Exist';
    document.querySelector('#output').innerHTML += `<p>${msg}</p>`;
  }
};

// eslint-disable-next-line no-unused-vars
function submit(party_id) {
  let arr;
  if (party_id == 1) {
    arr = JSON.parse(document.getElementById('inputText' + String(party_id)).value);
    for (let i = 0; i < arr.length; i++) {
      if (arr[i] >= 13) {
        alert('All numbers must be less than 13');
        return;
      }
    }
  } else {
    console.log(party_id);
    arr = parseInt($('#inputText' + String(party_id)).val());
    console.log(arr);
    if (arr == null || isNaN(arr)) {
      alert('Element must be a whole number');
      return;
    }
    if (arr < 0 || arr >= 13) {
      alert('Element must be between 0 and 13 exclusive');
      return;
    }
  }

  worker.postMessage({
    type: 'compute' + String(party_id),
    input: arr
  });
}
