let computation_id;
let party_count;
const connect = function() {
  // Disable connect button
  $('#connectBtn').prop('disabled', true);

  computation_id = $('#computation_id').val();
  party_count = parseInt($('#count').val());
  
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



/**
 * Array holds the ascii code of the input text.
 */
const code = [];
const process = function() {
  $('#concatBtn').attr('disabled', true);

  let arr = document.getElementById('inputText').value;

  /**
  * Conver the input text into an array of ascii sequence.
  */
  for(let i = 0; i < arr.length; i++)
    code.push(arr.charCodeAt(i));

  mpc(code);
}

const mpc = function(arr) {
  /**
   * Share the lengths of the arrays
   */
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

/**
 * Function arranges the shares in the array.
 */
const concatinate = function(arr, lengths) {
  jiff_instance.share_array(arr, function(shares) {
    let concatinatedSharesArray = [];
    for(let j in lengths) {
      for(let i = 0; i < shares.length; i++) {
        concatinatedSharesArray.push(shares[i][j]);
      }
    }
    open_shares(concatinatedSharesArray);
  });
}


/**
 * Open all the shares and add the opened values to the array open_result.
 * 
 * When all the values are received convert the values back to a string and display it.
 */
let open_result = [];
let open_counter = 0;
const open_shares = function(shares_array) {
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