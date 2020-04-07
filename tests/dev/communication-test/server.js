var express = require('express');
var app = express();
var http = require('http').Server(app);

new (require('../../../lib/jiff-server'))(http, { logs: true });

// Serve static files.
app.use('/tests', express.static('tests'));
app.use('/lib', express.static('lib'));
app.use('/lib/ext', express.static('lib/ext'));
app.use('/dist', express.static('dist'));
http.listen(8080, function () {
  console.log('listening on *:8080');
});

console.log('Direct your browser to *:8080/tests/dev/communication-test/client.html.');
console.log('To run a node.js based party: node tests/dev/communication-test/party.js <input>');
console.log();
