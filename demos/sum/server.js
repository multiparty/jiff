var path = require('path');
var express = require('express');
var app = express();
var http = require('http').Server(app);

//Serve static files
//Configure App
app.use('/demos', express.static(path.join(__dirname, '..', '..', 'demos')));
app.use('/dist', express.static(path.join(__dirname, '..', '..', 'dist')));
app.use('/lib/ext', express.static(path.join(__dirname, '..', '..', 'lib', 'ext')));
app.use('/lib/common/linkedlist.js', express.static(path.join(__dirname, '..', '..', 'lib', 'common', 'linkedlist.js')));

console.log(path.join(__dirname, '..', '..', 'lib', 'common', 'linkedlist.js'))

var JIFFServer = require('../../lib/jiff-server.js');
var jiff_instance = new JIFFServer(http, { logs: true });


var jiffWebsocketServer = require('../../lib/ext/jiff-server-websockets');
jiff_instance.apply_extension(jiffWebsocketServer);

// Serve static files.
http.listen(8080, function () {
  console.log('listening on *:8080');
});

console.log('Direct your browser to http://localhost:8080/demos/sum/client.html.');
console.log('To run a node.js based party: node demos/sum/party <input>');
console.log();
