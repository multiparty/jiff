var express = require('express');
var app = express();
var http = require('http').Server(app);
var jiff_instance = require('../../lib/jiff-server').make_jiff(http, {logs:true});

// Define a computation with id '1' and a maximum of 3 participants.
jiff_instance.totalparty_map['test-neural-net'] = 2;

// Serve static files.
app.use("/demos", express.static("demos"));
app.use("/lib", express.static("lib"));
app.use("/lib/ext", express.static("lib/ext"));
http.listen(8080, function() {
  console.log('listening on *:8080');
});

console.log("Direct your browser to *:8080/demos/neural-net/client.html.");
console.log("To run a server-based party: node index.js demos/neural-net/party");
console.log()
