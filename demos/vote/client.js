function connect() {
  $('#connectButton').prop('disabled', true);
  var computation_id = $('#computation_id').val();
  var party_count = parseInt($('#count').val());

  if (isNaN(party_count)) {
    $('#output').append("<p class='error'>Party count must be a valid number!</p>");
    $('#connectButton').prop('disabled', false);
  } else {
    var options = { party_count: party_count};
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
    mpc.connect(hostname, computation_id, options);
  }
}

function submit() {
  var inputs = [];
  var radios = $('input[type=radio]');
  var oneChecked = false;
  for (var i = 0; i < radios.length; i++) {
    inputs.push( radios[i].checked ? 1 : 0 );
    oneChecked = oneChecked || radios[i].checked;
  }

  if (!oneChecked) {
    $('#output').append("<p class='error'>Please select a beer!</p>");
    return;
  }

  $('#sumButton').attr('disabled', true);
  $('#output').append('<p>Starting...</p>');

  mpc.compute(inputs).then(handleResult, handleError);
}

function handleResult(result) {
  $('#output').append('<p>Result is: ' + result + '</p>');
  $('#button').attr('disabled', false);
}

function handleError() {
  console.log('Error in open_array');
}
