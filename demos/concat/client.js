let computation_id;
let party_count;


// Called when the connect button is clicked: connect to the server and intialize the MPC.
function connect() {
  // Disable connect button
  $('#connectBtn').prop('disabled', true);

  computation_id = $('#computation_id').val();
  party_count = parseInt($('#count').val());
  
  // Figure out the hostname of the server from the currently open URL.
  var hostname = window.location.hostname.trim();
  var port = window.location.port;
  if(port == null || port == '') 
    port = "8080";
  if(!(hostname.startsWith("http://") || hostname.startsWith("https://")))
    hostname = "http://" + hostname;
  if(hostname.endsWith("/"))
    hostname = hostname.substring(0, hostname.length-1);
  if(hostname.indexOf(":") > -1)
    hostanme = hostname.substring(0, hostname.indexOf(":"));
  hostname = hostname + ":" + port;

  // Create an MPC instance and connect
  MPCconnect(hostname, computation_id, party_count);
}

    // Create a JIFF instance and connect to the server.
function MPCconnect(hostname, computation_id, party_count) {
  var options = { 'party_count': party_count };
  options.onError = function(error) { $("#result").append("<p class='error'>"+error+"</p>"); };
  options.onConnect = function() { $("#concatBtn").attr("disabled", false); $("#result").append("<p>All parties Connected!</p>"); };

  jiff_instance = jiff.make_jiff(hostname, computation_id, options);
}


const code = [];
const process = function() {
  $('#concatBtn').attr('disabled', true);

  let arr = document.getElementById('inputText').value;
  console.log(arr);

  /**
  * Conver the input text into an array of ascii sequence.
  */
  for(let i = 0; i < arr.length; i++)
    code.push(arr.charCodeAt(i));
  console.log(code);

  mpc(code);
}

const mpc = function(arr) {
  let lens = jiff_instance.share(arr.length);
  let opened_lengths = {};

  let opened_lengths_counter = 0;

  for(let p in lens) {
    (function(party_id) {
      lens[p].open(function(length_opened) {
        opened_lengths[party_id] = length_opened;
        if(++opened_lengths_counter === party_count)
          concatinate(arr, opened_lengths);
      });
    })(p);
  }
}

const concatinate = function(arr, lengths) { console.log(lengths);
  jiff_instance.share_array(arr, function(shares) { console.log(shares);
    let concatinatedSharesArray = [];
    for(let j in lengths) {
      for(let i = 0; i < shares.length; i++) {
        concatinatedSharesArray.push(shares[i][j]);
      }
    }
    open_shares(concatinatedSharesArray);
  });
}

let open_result = [];
let open_counter = 0;
const open_shares = function(shares_array) { console.log(shares_array)
  for(let i = 0; i < shares_array.length; i++) {
    (function(index) {
      shares_array[i].open(function(result) {
        open_result[index] = result;
        if(++open_counter == open_result.length) {
          let to_string = "";
          for(let i = 0; i < open_result.length; i++) {
            to_string += String.fromCharCode(open_result[i]);
          }
          document.getElementById('outputText').value = to_string;
        }
      });
    })(i);
  }
}