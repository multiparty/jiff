var express = require('express');
var app = express();
var http = require('http').Server(app);
var jiff_instance = require('../../lib/jiff-server').make_jiff(http, { logs: false });

app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Credentials", "true");
  res.header("Access-Control-Allow-Methods", "OPTIONS, GET, POST");
  res.header("Access-Control-Allow-Headers", "Content-Type, Depth, User-Agent, X-File-Size, X-Requested-With, If-Modified-Since, X-File-Name, Cache-Control");
  next();
});

// Serve static files.
app.use("/", express.static("."));
app.use("/lib", express.static("../../lib"));
app.use("/lib/ext", express.static("../../lib/ext"));
http.listen(3000, function() {
  console.log('listening on *:3000');
});

