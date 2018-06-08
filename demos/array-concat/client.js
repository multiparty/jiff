/**
 * Do not modify this file unless you have too
 * This file has UI handlers.
 */

function connect() {
  $('#connectButton').prop('disabled', true);
  var computation_id = $('#computation_id').val();
  var party_count = parseInt($('#count').val());

  if(isNaN(party_count)) {
    $("#output").append("<p class='error'>Party count must be a valid number!</p>");
    $('#connectButton').prop('disabled', false);
  } else {
    var options = { party_count: party_count};
    options.onError = function(error) { $("#output").append("<p class='error'>"+error+"</p>"); };
    options.onConnect = function() { $("#button").attr("disabled", false); $("#output").append("<p>All parties Connected!</p>"); };
    
    var hostname = window.location.hostname.trim();
    var port = window.location.port;
    if(port == null || port == '') 
      port = "80";
    if(!(hostname.startsWith("http://") || hostname.startsWith("https://")))
      hostname = "http://" + hostname;
    if(hostname.endsWith("/"))
      hostname = hostname.substring(0, hostname.length-1);
    if(hostname.indexOf(":") > -1 && hostname.lastIndexOf(":") > hostname.indexOf(":"))
      hostname = hostname.substring(0, hostname.lastIndexOf(":"));

    hostname = hostname + ":" + port;
    mpc.connect(hostname, computation_id, options);
  }
}

function submit() {
  $('#concatBtn').attr('disabled', true);
  $("#output").append("<p>Starting...</p>");

  var arr = [];
  var str = document.getElementById('inputText').value;

  // Convert the input string into an array of numbers
  // each number is the ascii encoding of the character at the same index
  for(let i = 0; i < str.length; i++)
    arr.push(str.charCodeAt(i));

  var promise = mpc.compute(arr);
  promise.then(handleResult); 
}

function handleResult(results) {
  var string = "";
    
  // convert each opened number to a character
  // and add it to the final stringls
  for(let i = 0; i < results.length; i++) {
    string += String.fromCharCode(results[i]);
  }
  $("#output").append("<p>Result is: " + string + "</p>");
  $("#button").attr("disabled", false);
}
