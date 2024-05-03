const worker = new Worker('./web-worker.js');
function connect(party_id) {
  $('#connectButton').prop('disabled', true);
  const computation_id = $('#computation_id').val();
  const party_count = parseInt($('#count').val());

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

worker.onmessage = function (e) {
  if ($('#output').is(':empty') && (e.data.type === 'result1' || e.data.type === 'result2')) {
    const msg = e.data.result === 1 ? 'Looks like you have a date! Enjoy your special day.' : 'Unlucky! Taking a rain check';
    $('#output').append('<p> ' + msg + '</p>');
  }
};

// eslint-disable-next-line no-unused-vars
function submit(party_id) {
  const input = $('input[name=choice]:checked').val();
  if (input !== 'yes' && input !== 'no') {
    $('#output').append("<p class='error'>Please select a choice.</p>");
    return;
  }
  input = input === 'yes' ? 1 : 0;
  $('#submit').attr('disabled', true);

  // eslint-disable-next-line no-undef
  worker.postMessage({
    type: 'compute' + String(party_id),
    input: input
  });
}