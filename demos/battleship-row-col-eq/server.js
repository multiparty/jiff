var express = require('express');
var app = express();
var http = require('http').Server(app); // server
var jiff_instance = require('../../lib/jiff-server').make_jiff(http, { logs:true });

// Serve static files.
app.use("/demos", express.static("demos"));
app.use("/lib", express.static("lib"));
app.use("/lib/ext", express.static("lib/ext"));

http.listen(8080, function() {
  console.log('listening on *:8080');
});

console.log("Direct your browser to *:8080/demos/battleship-row-col-eq/client.html.");
console.log("To run a node.js based party: node demos/battleship-binary/party, Command line arguments: <ships> <guesses> [<computation_id>] [<party id>]");
console.log();
