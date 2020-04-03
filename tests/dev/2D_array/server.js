var express = require('express');
var app = express();
var http = require('http').Server(app);
new (require('../../../lib/jiff-server'))(http, { logs: true });

// Serve static files.
http.listen(8080, function () {
  console.log('listening on *:8080');
});

console.log('Direct your browser to *:8080/demos/sum/client.html.');
console.log('To run a node.js based party: node demos/sum/party <input>');
console.log();
