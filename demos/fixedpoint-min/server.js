var express = require('express');
var app = express();
var http = require('http').Server(app);
var base_instance = require('../../lib/jiff-server').make_jiff(http, {logs:true});
var jiff_instance = require('../../lib/ext/jiff-server-bignumber').make_jiff(base_instance, {Zp: new BigNumber(3241619007153)});

// Server static files.
app.use("/demos", express.static("demos"));
app.use("/lib", express.static("lib"));
app.use("/lib/ext", express.static("lib/ext"));
app.use("/bignumber.js", express.static("node_modules/bignumber.js"));
http.listen(8080, function() {
  console.log('listening on *:8080');
});

console.log("Please run the demo in node.js using the party.js file.");
console.log()
