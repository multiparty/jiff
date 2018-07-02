var express = require('express');
var app = express();
var http = require('http').Server(app);
var jiff_instance = require('../../lib/jiff-server').make_jiff(http, { logs:true });

// Serve static files.
app.use("/demos", express.static("demos"));
app.use("/lib", express.static("lib"));
app.use("/lib/ext", express.static("lib/ext"));
// app.use("/bignumber.js", express.static("node_modules/bignumber.js"));
http.listen(8080, function() {
  console.log('listening on *:8080');
});