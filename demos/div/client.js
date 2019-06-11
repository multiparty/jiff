/*
 * Do not modify this file unless you have to.
 * This file has UI handlers.
 */

var Zp = 101;
var jiff_instance = null;
var part;  // Bool: Do I know the numerator?
var protocal = "default";  // Bool: Do I know the numerator?

// eslint-disable-next-line no-unused-vars
function connect() {
    var computation_id = "test";//$('#computation_id').val();
    var party_count = 2;//parseInt($('#count').val());

    if (typeof part === "undefined") {
        $('#output').append("<p class='error'>You can't know both the numerator and the denominator!</p>");
    } else if (isNaN(party_count)) {
        $('#output').append("<p class='error'>Party count must be a valid number!</p>");
    } else {
        $('#connectButton').prop('disabled', true);

        var options = { party_count: party_count, Zp: Zp };
        options.onError = function (error) {
            $('#output').append("<p class='error'>"+error+'</p>');
        };
        options.onConnect = function () {
            $('#button').attr('disabled', false); $('#output').append('<p>All parties Connected!</p>');
            submit();
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
    var input = parseInt($(part?'#numerator':'#denominator').val());

    $('#button').attr('disabled', true);
    $('#output').append('<p>Starting...</p>');
    jiff_instance.start_time = + new Date();
    // console.log("Started at " + jiff_instance.start_time);

    // eslint-disable-next-line no-undef
    var promise = mpc.compute(input, part, protocal);
    // promise.then(handleResult);

    // promise.then(function(quotient){
    //     console.log("Finished in " + (new Date() - jiff_instance.start_time)/1000 + "s");
    //     console.log("The result is: " + quotient);
    //
    //     $('#output').append("<p>The result is: " + quotient + "</p>");
    //     $('#output').append("<p>Finished in " + (new Date() - jiff_instance.start_time)/1000 + "s</p>");
    //     disconnect();
    // });

    promise.quo.then(function (quo) {
        jiff_instance.open(quo).then(function (quo) {
            console.log("Finished in " + (new Date() - jiff_instance.start_time)/1000 + "s");
            console.log("The quotient is " + quo.toString());

            $('#output').append("<p>The quotient is: " + quo + "</p>");
            $('#output').append("<p>Finished in " + (new Date() - jiff_instance.start_time)/1000 + "s</p>");

            promise.rem.then(function (rem) {
                jiff_instance.open(rem).then(function (rem) {
                    console.log("The remainder is " + rem.toString());
                    disconnect();
                });
            });
        });
    });
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
    $('#button').attr('disabled', false);
}

function numerator_change() {
    part = true;
    if (!($('#denominator').val() === "d")) {
        $('#denominator').val('d');
        $('#denominator').css('width', ($('#denominator').val().length * 13).toString() + "px");
    }
    $('#numerator').css('width', ($('#numerator').val().length * 13).toString() + "px");
}

function denominator_change() {
    part = false;
    if (!($('#numerator').val() === "num")) {
        $('#numerator').val('num');
        $('#numerator').css('width', ($('#numerator').val().length * 13).toString() + "px");
    }
    $('#denominator').css('width', ($('#denominator').val().length * 13).toString() + "px");
}

function modulus_change() {
    Zp = parseInt($('#modulus').val());
    $('#modulus').css('width', ($('#modulus').val().length * 14).toString() + "px");
}

function protocal_change() {
    protocal = $('#protocal').val();
}
