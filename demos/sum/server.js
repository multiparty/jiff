var express = require('express');
var app = express();
var http = require('http').Server(app);
var jiff_instance = require('../../lib/jiff-server').make_jiff(http, {logs:true});

// Define a computation with id '1' and a maximum of 3 participants.
jiff_instance.totalparty_map['1'] = 3;

jiff_instance.compute('1', function(computation_instance) {
  // Perform server-side computation.
  console.log("Hello!");
});

// Serve static files.
app.use("/demos", express.static("demos"));
app.use("/lib", express.static("lib"));
app.use("/lib/ext", express.static("lib/ext"));
http.listen(8080, function() {
  console.log('listening on *:8080');
});

console.log("Direct your browser to *:8080/demos/sum/client.html.");
