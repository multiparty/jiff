/**
 * Do not modify this file unless you have too
 * This file has UI handlers.
 */
var Zp = 15485867;

// eslint-disable-next-line no-unused-vars
function connect() {
  $('#connectButton').prop('disabled', true);
  var computation_id = $('#computation_id').val();
  var party_count = 2;

  if (isNaN(party_count)) {
    $('#output').append('<p class="error">Party count must be a valid number!</p>');
    $('#connectButton').prop('disabled', false);
  } else {
    var options = { party_count: party_count, Zp: Zp };
    options.onError = function (error) {
      $('#output').append('<p class="error">'+error+'</p>');
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
    console.log("mpc.connect("+hostname+", "+computation_id+", "+options+");");
  }
}

function hashString(strData) {
  var hash = 0, i, chr;
  if (strData.length === 0) {
    return hash;
  }
  for (i = 0; i < strData.length; i++) {
    chr   = strData.charCodeAt(i);
    hash  = ((hash << 5) - hash) + chr;
    hash |= 0; // Convert to 32bit integer
  }

  if (hash < 0) {
    hash = hash * -1;
  }

  return hash % Zp;
}

function och() {
    document.getElementById("rv").innerHTML=document.getElementById("input_item10").value;
}

// eslint-disable-next-line no-unused-vars
function submit() {
    $('#compareBtn').attr('disabled', true);

    var base64 = $('form').serialize();  // form data (preferences)
    base64 = hashString(base64);

    var prefs = [];
    var formData = $('form').serializeArray();
    for (var i = 0; i < formData.length; i++) {
        var element = formData[i];
        prefs[element.name] = hashString(element.value);
    }

    // Begin MPC comparison
    var prefCount = 10;
    for (var i = 1; i <= prefCount; i++) {
        // eslint-disable-next-line no-undef
        var promise = mpc.compute( (prefs[i]==null)?0: prefs[i] );  // JQuery reads unchecked checkboxes as null
        promise.then(handleResult);
    }
}

var index = 1;
function handleResult(result) {
    console.log(result);
    var statement = result === 1 ? 'the same' : 'different';
    $('#output').append('<p>Preference #' + index + ' is ' + statement + '.</p>');
    $('#button').attr('disabled', false);

    var color = "";
    if (result === 1) {
        color = "lightGreen";
    } else {
        color = "lightCoral";
    }
    document.getElementById(""+index).setAttribute("style", "background-color: " + color);
    index++;
}
