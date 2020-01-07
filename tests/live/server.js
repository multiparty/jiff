var JIFFServer = require('../../lib/jiff-server');
// var jiffServerBigNumber = require('../../lib/ext/jiff-server-bignumber');

var express = require('express');
var app = express();
var http = require('http').Server(app);

app.use('/', express.static(__dirname));
app.use('/lib', express.static(__dirname + '/../../lib'));
app.use('/dist', express.static(__dirname + '/../../dist'));

var serverOptions = {logs: true, sodium: false};

// var instance =
new JIFFServer(http, serverOptions);
// instance.apply_extension(jiffServerBigNumber, serverOptions);

http.listen(3000, function () {
  console.log('listening on *: 3000');
});
