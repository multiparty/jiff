// eslint-disable-next-line no-unused-vars
function connect() {
  $('#connectButton').prop('disabled', true);
  var computation_id = $('#computation_id').val();
  var party_count = parseInt($('#count').val());

  if (isNaN(party_count)) {
    $('#output').append("<p class='error'>Party count must be a valid number!</p>");
    $('#connectButton').prop('disabled', false);
  } else {
    var options = {
      party_count: party_count,
      Zp: '32416190071',
      integer_digits: 2,
      decimal_digits: 3
    };
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
function pca() {
  var input = JSON.parse($('#inputText').val());

  // eslint-disable-next-line no-undef
  var promise = mpc.compute(input);

  promise.then(function (result) {
    $('#output').append('<p>Result = [' + result + ']</p>');
  });
}


