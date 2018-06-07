"use strict";

let jiff_instance;

const connect = function() {
  $('#connectButton').prop('disabled', true);
  let computation_id = 33;
  let party_count = 2;

  const options = { party_count: party_count };
  options.onError = function(error) {
    $("#output").append("<p class='error'>"+error+"</p>");
  };
  options.onConnect = function() {
    $("#processButton").attr("disabled", false);
    $("#output").append("<p>All parties Connected!<br/>Please input ascii characters</p><br/>");
    if(jiff_instance.id == 1)
      $("#output").append("<br/><p>You are party 1. Please enter a large string. The other party should enter a substring of your string.</p>");
    else
      $("#output").append("<br/><p>You are party 2. Please enter a substring you want to find the index of in party 1's string</p>");
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
  jiff_instance = mpc.connect(hostname, computation_id, options);
}

const displaySubstring = function(index) {
  $("#output").append("<p>Substring at " + index + ".</p><br/>");
}

const startComputation = function(text) {
  $("#processButton").attr("disabled", true);
  //convert string to array of ascii 


  /**
   * The array of ascii code for the text.
   */
  const asciiCode = [];

  /**
   * Convert the input text into an array of ascii sequence.
   */
  for(let i = 0; i < text.length; i++) {
    asciiCode.push(text.charCodeAt(i));
  }

  mpc.compute(asciiCode, displaySubstring, jiff_instance);
}
