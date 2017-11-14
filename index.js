var express = require('express');
var app = express();
var http = require('http').Server(app);
var jiff_instance = require('./lib/jiff-server').make_jiff(http, { logs: false });

// Define a computation with id '1' with a maximum of 3 participants
jiff_instance.totalparty_map['1'] = 2;

jiff_instance.compute('test-sum', function(computation_instance) {
  // Perform server side computation
  console.log("HELLO");
  var shares = computation_instance.share(10, null, [1,2], [1, 2, "s1"]);
  shares = computation_instance.share(null, 1, ["s1"], [1, 2]);

  var r = shares[1].add(shares[2]).add_cst(1);
  r.open(console.log);
});

// Server static files
app.use("/apps", express.static("apps"));
app.use("/lib", express.static("lib"));
app.use("/tests", express.static("tests/positive"));
http.listen(3000, function() {
  console.log('listening on *:3000');
});

