var express = require('express');
var app = express();
var http = require('http').Server(app);
var jiff_instance = require('./lib/jiff-server').make_jiff(http);

// Define a computation with id '1' with a maximum of 3 participants
jiff_instance.totalparty_map['1'] = 3;

jiff_instance.compute('test-sum', function(computation_instance) {
  // Perform server side computation
  console.log("HELLO");
});

// Server static files
app.use("/apps", express.static("apps"));
app.use("/lib", express.static("lib"));
app.use("/tests", express.static("tests/positive"));
http.listen(3000, function() {
  console.log('listening on *:3000');
});

