/*
 * Do not modify this file unless you have to.
 * This file has UI handlers.
 */

var max_party_count = 40;
var Zp = ifPrime(101);
var jiff_instance = null;

// eslint-disable-next-line no-unused-vars
function connect() {
    $('#connectButton').prop('disabled', true);
    var computation_id = "test";//$('#computation_id').val();
    var party_count = 2;//parseInt($('#count').val());

    if (isNaN(party_count)) {
        $('#output').append("<p class='error'>Party count must be a valid number!</p>");
        $('#connectButton').prop('disabled', false);
    } else if (max_party_count < party_count) {
        $('#output').append("<p class='error'>Party count must be within the maximum of "+max_party_count+"!</p>");
        $('#connectButton').prop('disabled', false);
    } else {
        var options = { party_count: party_count, Zp: Zp };
        options.onError = function (error) {
            $('#output').append("<p class='error'>"+error+'</p>');
        };
        options.onConnect = function () {
            $('#button').attr('disabled', false); $('#output').append('<p>All parties Connected!</p>');
            setselect();
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

// eslint-disable-next-line no-unused-vars
function submit() {
    var map = [JSON.parse($('#domain').val()), JSON.parse($('#codomain').val())];
    var input = parseInt($('#index').val());
    var op = $('select').val();

    $('#button').attr('disabled', true);
    $('#output').append('<p>Starting...</p>');
    console.log("Started at " + (+new Date()));

    // eslint-disable-next-line no-undef
    var promise = mpc.compute(map, input, op);
    // promise.then(handleResult);
    promise.then(function(r){
        console.log("Finished at " + + new Date());
        console.log(r);
        printResult(r[0], "first");
        printResult(r[1], "second");
    });
}

function handleResult(result) {
    console.log("Finished at " + (+new Date()));

    handleResult(result[0], "first");
    handleResult(result[1], "second");

    $('#button').attr('disabled', false);
}

function printResult(result, place) {
    console.log("The " + place + " element is: " + result);

    $('#output').append("<p>The " + place + " element is: " + result + "</p>");
}

function reset() {
    disconnect();
    window.location.reload();
}

function disconnect() {
    if (jiff_instance != null) {
        jiff_instance.disconnect(false, true);
    }

    $('#connectButton').prop('disabled', false);
    $('#button').prop('disabled', true);
}

function ifPrime(p) {
    for (var i = 2; i * i <= p; i++) {
        if (p % i === 0) {
            p = -1;
            break;
        }
    }
    if (p < 2) {
        alert("Zp Error: NOT PRIME");
    }
    return p;
}

function setselect() {
    var share = jiff_instance.secret_share(jiff_instance, false, {then: function(){}})
    for (var func in share) {
        if (typeof share[func] == "function") {
            if (func.substr(0,1) === "s") {
                $('#count').append($("<option>", {value: func, html: func}));
            }
        }
    }
}
