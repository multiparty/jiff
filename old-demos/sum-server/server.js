var express = require('express');
var app = express();
var http = require('http').Server(app);
var jiff_instance = require('../../lib/jiff-server').make_jiff(http, {logs:true});

jiff_instance.compute('test-sum', { onConnect: 
  function(computation_instance) {
    console.log("HELLO");
    var parties = [ "s1" ];
    for(var i = 1; i <= computation_instance.party_count; i++) parties.push(i);

    var shares = computation_instance.share(5, parties.length, parties, parties);
    var sum = shares["s1"];
    for(var i = 1; i <= computation_instance.party_count; i++)
      sum = sum.sadd(shares[i]);
    computation_instance.open(sum, parties).then(function(v) { console.log(v); });
  }
});

// Serve static files.
app.use("/demos", express.static("demos"));
app.use("/lib", express.static("lib"));
app.use("/lib/ext", express.static("lib/ext"));
http.listen(8080, function() {
  console.log('listening on *:8080');
});

console.log("Direct your browser to *:8080/demos/sum-server/client.html.");
console.log("To run a server-based party: node index.js demos/sum-server/party");
console.log("Server input for this computation is 5");
console.log();
