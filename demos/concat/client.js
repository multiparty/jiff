var jiff_instance; // global jiff instance, will be instantiated at connect time

function connect() {
  // Disable connect button
  $('#connectBtn').prop('disabled', true);

  var computation_id = $('#computation_id').val();
  var party_count = parseInt($('#count').val());
  
  // Figure out the hostname of the server from the currently open URL.
  var hostname = window.location.hostname.trim();
  var port = window.location.port;
  if(!(hostname.startsWith("http://") || hostname.startsWith("https://")))
    hostname = "http://" + hostname;
  if(hostname.endsWith("/"))
    hostname = hostname.substring(0, hostname.length-1);
  hostname = hostname + ":" + port;

  var options = { 'party_count': party_count };
  options.onError = function(error) { $("#result").append("<p class='error'>"+error+"</p>"); };
  options.onConnect = function() { $("#concatBtn").attr("disabled", false); $("#result").append("<p>All parties Connected!</p>"); };

  jiff_instance = jiff.make_jiff(hostname, computation_id, options);
}

function process() {
  $('#concatBtn').attr('disabled', true);

  var arr = [];
  var str = document.getElementById('inputText').value;

  // Convert the input string into an array of numbers
  // each number is the ascii encoding of the character at the same index
  for(let i = 0; i < str.length; i++)
    arr.push(str.charCodeAt(i));

  mpc(arr);
}

// MPC Computation: share all arrays then concatenate them.
function mpc(arr) {
  var promise = jiff_instance.share_array(arr);

  promise.then(function(shares) {
    console.log(shares);
    var result = [];

    for(var i = 1; i <= jiff_instance.party_count; i++)
      result = result.concat(shares[i]);

    open_shares(result);
  });
}

// Open the concatenated array and transform it back into a string
function open_shares(shares_array) {
  var promises = [];
  for(var i = 0; i < shares_array.length; i++) {
    promises.push(jiff_instance.open(shares_array[i]));
  }
  
  Promise.all(promises).then(function(results) {
    var string = "";
    
    // convert each opened number to a character
    // and add it to the final stringls
    for(let i = 0; i < results.length; i++) {
      string += String.fromCharCode(results[i]);
    }
    document.getElementById('outputText').value = string;
  });
}
