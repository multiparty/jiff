/*
 * Do not modify this file unless you have to.
 * This file has UI handlers.
 */

var max_party_count = 40;
var Zp = ifPrime(29);
var jiff_instance = null;

// eslint-disable-next-line no-unused-vars
function connect() {
    $('#connectButton').prop('disabled', true);
    var computation_id = "test";//$('#computation_id').val();
    var party_count = parseInt($('#count').val());

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
    var input = $("#slider-range").slider("values");

    $('#button').attr('disabled', true);
    $('#output').append('<p>Starting...</p>');
    console.log("Started at " + (+new Date()));

    // eslint-disable-next-line no-undef
    var promise = mpc.compute(input);
    promise[1].then(handleSuccess.bind(null, promise[0]));
}

function handleSuccess(success, promise) {
    console.log("Finished at " + (+new Date()));
    if (success == 1) {
        promise.then(handleResult);
    } else {
        handleResult = function () {};
        console.log("Failure: out of bounds");
        $("#slider-range").slider({range: true, min: 0, max: maximum, values: [null, null]});
        $('#output').append("<p class=\"error\">Generation Failed: no shared range</p>");
    }
}

function handleResult(result) {
    console.log(result);

    mark(result);

    $('#output').append('<p>Result is: ' + result + '</p>');
    $('#button').attr('disabled', false);
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

const maximum = Zp-1;
$(function() {
    $("#slider-range").slider({
        range: true,
        min: 0,
        max: maximum,
        values: ((window.location.hash == "") ? [maximum/4, 3*maximum/4] : JSON.parse(decodeURIComponent(window.location.hash.substring(1)))),
        slide: function(event, ui) {
            $("#amount").val(ui.values[0] + " - " + ui.values[1]);
        }
    });
    $("#amount").val($("#slider-range").slider("values", 0) + " - " + $("#slider-range").slider("values", 1));
});

function mark(value, pt = 18) {
    document.getElementById("slider-range").innerHTML += "<span tabindex=\"0\" style=\"visibility: visible; border-bottom-left-radius: 0px; border-bottom-right-radius: 0px; border-bottom-width: 0px; border-image-outset: 0px; border-image-repeat: stretch; border-image-slice: 100%; border-image-source: none; border-image-width: 1; border-left-style: solid; border-left-width: 0px; border-right-style: solid; border-right-width: 0px; border-top-left-radius: 0px; border-top-right-radius: 0px; border-top-style: solid; cursor: default; display: block; font-family: Muli, sans-serif; font-size: "+pt+"px; font-weight: 100; height: 15px; line-height: 15px; left: "+(100*(value/maximum))+"%; margin-left: -9.6px; margin-top: 0px; padding-left: 0; padding-top: 3px; position: absolute; text-align: center; top: -4.8px; touch-action: none; width: 21.188px; z-index: 2; border-top-width: 0px; padding-bottom: 3px; padding-right: 0;\">X</span>";
}

function ifPrime(p) {
    for (var i = 2; i < p; i++) {
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

function isPrime(p) {
    if (p == 2) {
        return true;
    } else if (p == 3) {
        return true;
    } else if (p % 2 == 0) {
        return false;
    } else if (p % 3 == 0) {
        return false;
    }

    var i = 5;
    var n = 2;
    while (i * i <= n) {
        if (p % i == 0) {
            return false;
        }
        i += n;
        n = 6 - n;
    }

    return true;
}
