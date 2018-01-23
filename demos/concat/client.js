
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

    // Create a JIFF instance and connect to the server.
function MPCconnect(hostname, computation_id, party_count) {
  var options = { 'party_count': party_count };
  options.onError = function(error) { $("#result").append("<p class='error'>"+error+"</p>"); };
  options.onConnect = function() { $("#concatBtn").attr("disabled", false); $("#result").append("<p>All parties Connected!</p>"); };

  jiff_instance = jiff.make_jiff(hostname, computation_id, options);
}

function process() {
  $('#concatBtn').attr('disabled', true);

  var arr = JSON.parse(document.getElementById('inputText').value);

  for (var i = 0; i < arr.length; i++) {
    if (typeof arr[i] !== 'number') {
      return;
    }
  }
  mpc(arr);
}

function shareElems(arr, maxLen) {
  var i = 0;

  var shares = [];

  for (var i = 0; i < arr.length; i++) {
    shares.push(jiff_instance.share(arr[i]));
  }

  var lenDiff = maxLen - arr.length;
  console.log('diff', lenDiff)

  for (var i = 0; i < lenDiff; i++) {
    shares.push(jiff_instance.share(0));
  }


  for (var i = 0; i < arr.length; i++) {
    p = shares[i][pId].open(function(result) {
      Promise.resolve(result);
    });
    allPromises.push(p);
  }
  

  return shares;
}

function concat(shares, myLen, pLen, myId, pId) {
  var sharesArr = shares;

  var allPromises = [];
  var p;

  for (var i = 0; i < myLen; i++) {
    p = shares[i][myId].open(function(result) {
      Promise.resolve(result);
    });
    allPromises.push(p);
  }

  for (var i = 0; i < pLen; i++) {
    p = shares[i][pId].open(function(result) {
      Promise.resolve(result);
    });
    allPromises.push(p);
  }
  
  Promise.all(allPromises).then(function(values) {
    console.log('values', values);
  });
}

function mpc(arr){
  var len = arr.length;
  var lens = jiff_instance.share(len);

  var shares, myLen, pLen, myId, pId;
  console.log('array',arr);

  lens[1].open(function(result) {
    var l1 = result;
    lens[2].open(function(result) {
      var l2 = result;
      var e = (l1 === arr.length) ? 1 : 0;
      var f = (!e) ? 1 : 0;
      myLen = (l1 * e) + (l2 * f);
      pLen = (l1 * f) + (l2 * e);
      myId = e ? 1 : 2;
      pId = f ? 1 : 2;

      if (l1 > l2) {
        shares = shareElems(arr, l1);
      } else {
        shares = shareElems(arr, l2);
      }
      concat(shares, myLen, pLen, myId, pId);
    });
  });
}