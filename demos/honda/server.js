var express = require('express');
var app = express();
var http = require('http').Server(app);
var jiff_instance = require('../../lib/jiff-server').make_jiff(http, { logs: false });

// Define a computation with id '1' with 4 participants (max).
jiff_instance.totalparty_map['shortest-path-1'] = 4;

// Serve static files.
app.use("/demos", express.static("demos"));
app.use("/lib", express.static("lib"));
app.use("/lib/ext", express.static("lib/ext"));
http.listen(3000, function() {
  console.log('listening on *:3000');
});

