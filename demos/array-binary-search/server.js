var path = require('path');
var express = require('express');
var app = express();
var http = require('http').Server(app);
var JIFFServer = require('../../lib/jiff-server');
var jiff_instance = new JIFFServer(http, { logs:true });

// Serve static files.
app.use('/demos', express.static(path.join(__dirname, '..', '..', 'demos')));
app.use('/dist', express.static(path.join(__dirname, '..', '..', 'dist')));
app.use('/lib/ext', express.static(path.join(__dirname, '..', '..', 'lib', 'ext')));

var jiffWebsocketServer = require('../../lib/ext/jiff-server-websockets');
jiff_instance.apply_extension(jiffWebsocketServer);


http.listen(8080, function () {
  console.log('listening on *:8080');
});

console.log('Direct your browser to http://localhost:8080/demos/array-binary-search/client.html.');
console.log('To run a server-based party: node demos/array-binary-search/party <input>');
console.log();
