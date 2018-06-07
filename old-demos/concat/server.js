const express = require('express');
const app = express();
const http = require('http').Server(app);
const jiff_instance = require('../../lib/jiff-server').make_jiff(http, {logs:true});

jiff_instance.totalparty_map['1'] = 2;

// Serve static files.
app.use("/demos", express.static("demos"));
app.use("/lib", express.static("lib"));
app.use("/lib/ext", express.static("lib/ext"));
http.listen(8080, function() {
  console.log('listening on *:8080');
});

console.log("Direct your browser to *:8080/demos/concat/index.html");
