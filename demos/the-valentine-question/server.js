var express = require('express');
var app = express();
var http = require('http').Server(app);
var JIFFServer = require('../../lib/jiff-server');
new JIFFServer(http, { logs:true });

// Serve static files.
app.use('/demos', express.static('demos'));
app.use('/dist', express.static('dist'));
app.use('/lib/ext', express.static('lib/ext'));
http.listen(8080, function () {
  console.log('listening on *:8080');
});

console.log('Direct your browser to *:8080/demos/the-valentine-question/client.html.');
console.log('To run a server-based party: node demos/the-valentine-question/party <input>');
console.log();
