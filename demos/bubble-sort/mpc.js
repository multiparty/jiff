// Called when the connect button is clicked: connect to the server and intialize the MPC.
function connect() {
  // Disable connect button
  $('#connectBtn').prop('disabled', true);

  // Figure out parameters to intialize the instance.
  var computation_id = 1;
  var party_count = 2;
  
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


var jiff_instance = null;

// Create a JIFF instance and connect to the server.
function MPCconnect(hostname, computation_id, party_count) {
  var options = { 'party_count': party_count };
  options.onError = function(error) { $("#result").append("<p class='error'>"+error+"</p>"); };
  options.onConnect = function() { $("#compareBtn").attr("disabled", false); $("#result").append("<p>All parties Connected!</p>"); };

  jiff_instance = jiff.make_jiff(hostname, computation_id, options);
}

function displayResult() {

}
// The code for the MPC comparison.
function mpc(arr) {

  var arr_shares = [];
  for (var i = 0; i < arr.length; i++) {
      arr_shares[i] = jiff_instance.share(arr[i]);
  }

  for (var i = 0; i < arr_shares.length; i++) {
    arr_shares[i] = arr_shares[i][1].add(arr_shares[i][2]);
  }

  var sorted = bubblesort(arr_shares);

  displayResults(sorted);
}

function displayResults(sorted) {
  var allPromises = [];
  for (var i = 0; i < sorted.length; i++) {
    var p = sorted[i].open(function(result) {
      Promise.resolve(result);
    });
    allPromises.push(p)
  }

  Promise.all(allPromises).then(function(values) {
    document.getElementById("resultText").value = values;
  });
}

function bubblesort(arr) {

  for (var i = 0; i < arr.length; i++) {
    for (var j = 0; j < (arr.length - i - 1); j++) {
   
      var a = arr[j];
      var b = arr[j+1];
      var c = a.lt(b);
      var d = c.not();

      arr[j] = (a.mult(c)).add((b.mult(d)));
      arr[j+1] = (a.mult(d)).add((b.mult(c)));
    }
  }

  return arr; 
}



function process() {
  $("#sortBtn").attr("disabled", true);
  var arr = JSON.parse(document.getElementById('inputText').value);

  for (var i = 0; i < arr.length; i++) {
    if (typeof arr[i] !== 'number') {
      return;
    }
  }

  mpc(arr);
}
  
  
  // function generateRand(n) {
  //     var arr = [];
  //     for (var i = 0; i < n; i++) {
  //         arr[i] = Math.floor(Math.random() * n);
  //     }
  //     return arr;
  // }
  
  
  // function test() {
  //     var n = 1000;
  //     for (var i = 0; i < n; i++) {
  //         var a = generateRand(100);
  //         var sorted = a.sort();
  //         var bubblesorted = bubblesort(a);
  
  //         if (!arrayEquality(sorted, bubblesorted)) {
  //             console.log('Test failed: ' + i);
  //         }
  //     }
  //     console.log("All tests passed");
  
  // }
  
  // function arrayEquality(arr1, arr2) {
  //     for (var i = 0; i < arr1.length; i++) {
  //         if (arr1[i] !== arr2[i]) {
  //             return false;
  //         }
  //     }
  //     return true;
  // }
  
  
  // test();