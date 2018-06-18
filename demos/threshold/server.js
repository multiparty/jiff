var express = require('express');
var app = express();
var http = require('http').Server(app);
var jiff_instance = require('../../lib/jiff-server').make_jiff(http, {logs:false});
jiff_instance = require('../../lib/ext/jiff-server-bignumber').make_jiff(jiff_instance);

// Serve static files.
app.use("/demos", express.static("demos"));
app.use("/lib", express.static("lib"));
app.use("/lib/ext", express.static("lib/ext"));
http.listen(8080, function() {
  console.log('listening on *:8080');
});

