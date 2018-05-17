"use strict";

let jiff_instance;

const connect = function() {
    $('#connectButton').prop('disabled', true);
    let computation_id = 33; //$('#computation_id').val();
    let party_count = 2; //parseInt($('#count').val());

    const options = { party_count: party_count };
    options.onError = function(error) {
        $("#output").append("<p class='error'>"+error+"</p>");
    };
    options.onConnect = function() {
        $("#processButton").attr("disabled", false);
        $("#output").append("<p>All parties Connected!<br/>Please input ascii characters</p><br/>");
        if(jiff_instance.id == 1)
            $("#output").append("<br/><p>You are party 1. Please enter a large string. The other party shoule enter a substring of your string.</p>");
        else
            $("#output").append("<br/><p>You are party 2. Please enter a substring you want to find the index of in party 1's string</p>");
        jiff_instance.listen("array-length", arrayLengthHandler);
    };
    
    var hostname = window.location.hostname.trim();
    var port = window.location.port;
    if(port == null || port == '')
        port = "80";
    if(!(hostname.startsWith("http://") || hostname.startsWith("https://")))
        hostname = "http://" + hostname;
    if(hostname.endsWith("/"))
        hostname = hostname.substring(0, hostname.length-1);

    hostname = hostname + ":" + port;
    jiff_instance = jiff.make_jiff(hostname, computation_id, options);
}

/**
 * The array of ascii code for the text.
 */
let code = [];

const process = function(text) {
    $("#processButton").attr("disabled", true);
    //convert string to array of ascii 

    /**
     * Conver the input text into an array of ascii sequence.
     */
    for(let i = 0; i < text.length; i++) {
        code.push(text.charCodeAt(i));
    }

    /**
     * The party with ID 2 is expected to enter the substring (having a shorter length than the original string).
     * 
     * Party 2 shares the length of his array.
     * Since party 1 has the array with bigger length, jiff_instance.share_array will compute the maximum length,
     * which is the length of party 1's array anyway.
     */
    if(jiff_instance.id === 2)
        jiff_instance.emit("array-length", null, text.length);
}

/**
 * 
 * @param {number} sender - The party id of the sender
 * @param {number} receivedData - The length of party 2's array (the substring array)
 */
const arrayLengthHandler = function(sender, receivedData) {
    let arrayLength = parseInt(receivedData);

    jiff_instance.share_array(code, function(shares) { //if shares were shuffled this wouldn't work
        // loop over all the possible starting points of the substring.
        for(let i = 0; i <= shares.length - arrayLength; i++) {
            // compare all the characters till the end of the substring
            let comparison = shares[i][1].eq(shares[0][2]);
            for(let j = 1; j < arrayLength; j++) {
                comparison = comparison.mult(shares[i+j][1].eq(shares[j][2]));
            }
            (function(index) {
                comparison.open(function(result) {
                    // if all characters are equivalent
                    if(result === 1)
                        $("#output").append("<p>Substring at " + index + ".</p><br/>");
                });
            })(i);
        }
    });
}