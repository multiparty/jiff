
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
  options.onConnect = function() { $("#sortBtn").attr("disabled", false); $("#result").append("<p>All parties Connected!</p>"); };

  jiff_instance = jiff.make_jiff(hostname, computation_id, options);
}

function process() {
  $('#sortBtn').attr('disabled', true);

  var arr = JSON.parse(document.getElementById('inputText').value);

  for (var i = 0; i < arr.length; i++) {
    if (typeof arr[i] !== 'number') {
      return;
    }
  }
  mpc(arr);
}


function shareElems(arr) {
  var shares = [];
  for (var i = 0; i < arr.length; i++) {
    shares.push(jiff_instance.share(arr[i]));
  }
  return shares;
}

function addShares(shares) {
  var addedShares = [];
  for (var i = 0; i < shares.length; i++) {
    addedShares.push(shares[i][1].add(shares[i][2]));
  }
  return addedShares;
}


function mpc(arr){
  var shares = shareElems(arr);
  shares = addShares(shares);
  oddEvenSort(shares, 0, shares.length);
  openShares(shares);
}

// opens all shares in array
function openShares(arr) {
  var allPromises = [];
  for (var i = 0; i < arr.length; i++) {
    var p = arr[i].open(function(result) {
      Promise.resolve(result);
    });
    allPromises.push(p);
  }
  Promise.all(allPromises).then(function(values) {
    document.getElementById("resultText").value = values;  
  });
}


/* SORTING */

// lo: lower bound of indices, n: number of elements, r: step
function oddEvenMerge(a, lo, n, r) {
  var m = r * 2; 
  if (m < n) {
    oddEvenMerge(a, lo, n, m);
    oddEvenMerge(a, lo+r, n, m);

    for (var i = (lo+r); (i+r)<(lo+n); i+=m)  {
      compareExchange(a, i, i+r);
    }
  } else {
    compareExchange(a,lo,lo+r);
  }
}

function oddEvenSort(a, lo, n) {
  if (n > 1) {
    var m = n/2;
    oddEvenSort(a, lo, m);
    oddEvenSort(a, lo+m, m);
    oddEvenMerge(a, lo, n, 1);
  }
}

function compareExchange(a, i, j) {

  var x = a[i];
  var y = a[j];

  var c = x.lt(y);  
  var d = c.not();

  a[i] = (x.mult(c)).add((y.mult(d)));
  a[j] = (x.mult(d)).add((y.mult(c)));

}