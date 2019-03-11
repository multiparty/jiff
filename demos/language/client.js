/**
  * Do not modify this file unless you have to.
  * This file has UI handlers.
  */

var jiff_instance = null;
// eslint-disable-next-line no-unused-vars
function connect() {
    $('#connectButton').prop('disabled', true);
    var computation_id = "test";
    var party_count = 2;//parseInt($('#count').val());

    if (isNaN(party_count)) {
        $('#output').append("<p class='error'>Party count must be a valid number!</p>");
        $('#connectButton').prop('disabled', false);
    } else {
        var options = { party_count: party_count};
        options.onError = function (error) {
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
        jiff_instance = mpc.connect(hostname, computation_id, options);
    }
}

// Supported operations
const ops = {"^": 0, "&": 1, "|": 2, ">": 3};
const identity = 0;

// eslint-disable-next-line no-unused-vars
function submit() {
    var exp = $('#exp').val();

    var input = [[], []];
    for (var i = 0; i < exp.length; i+=2) {
        input[0][i/2] = (exp[i]==="T")? 1 : ((exp[i]==="F")? 0 : identity);
    }
    for (var i = 1; i < exp.length; i+=2) {
        input[1][(i-1)/2] = ops[exp[i]];
    }

    $('#button').attr('disabled', true);
    $('#output').append('<p>Starting...</p>');
    // eslint-disable-next-line no-undef
    var promise = mpc.compute(input);
    promise.then(handleResult);
}

function handleResult(result) {
    $('#output').append('<p>Result is: ' + result + '</p>');
    $('#button').attr('disabled', false);
}

function disconnect() {
    jiff_instance.disconnect(false, true);
}

function reset() {
    disconnect();
    window.location.reload();
}
