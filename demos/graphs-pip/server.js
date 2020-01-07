var express = require('express');
var app = express();
var http = require('http').Server(app);
var JIFFServer = require('../../lib/jiff-server');
var base_instance = new JIFFServer(http, { logs:true });

var jiffBigNumberServer = require('../../lib/ext/jiff-server-bignumber');
base_instance.apply_extension(jiffBigNumberServer);

// Serve static files.
app.use('/demos', express.static('demos'));
app.use('/dist', express.static('dist'));
app.use('/lib/ext', express.static('lib/ext'));
app.use('/bignumber.js', express.static('node_modules/bignumber.js'));
http.listen(8080, function () {
  console.log('listening on *:8080');
});

console.log('Direct your browser to *:8080/demos/graphs-pip/client.html.');
console.log('To run a server-based party: node demos/graphs-pip/party <id> <input>');
console.log();