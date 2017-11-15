var jiff_instance;
var jiff = require('../lib/jiff-client');

var options = {party_count: 2};
options.onConnect = function() {
  // Share parties' inputs (the number 3 each) and the server's input (10).
  var shares = jiff_instance.share(3, null, [1, 2], [1, 2, "s1"]);
  
  // Share some input (5) with server, do not receive any shares.
  jiff_instance.share(5, 1, ["s1"], [1, 2]);

  // Operate on receive share
  var r = shares[1].add(shares[1]);
  r = r.mult(shares["s1"]);
  
  // Open the result of operation and log it.
  var p1 = r.open(console.log);
  
  // Meanwhile, server did some independent operations on shares of (5), 
  // receive that (altough we do not own any share of that result!), and log it.
  var p2 = jiff_instance.receive_open(["s1"]).then(function(result) { console.log("11 is: " + result); });
  
  // Disconnect when computation is done.
  Promise.all([p1, p2]).then(jiff_instance.disconnect);
}

jiff_instance = jiff.make_jiff("http://localhost:3000", 'test-sum', options);



