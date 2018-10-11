var extensions = process.env['JIFF_TEST_NAME'];

var express = require('express');
var app = express();
var http = require('http').Server(app);
var jiffServer = require('../../lib/jiff-server');

var jiff_instance = jiffServer.make_jiff(http, { logs: true });
if (extensions != null && (extensions.indexOf('bigNumber') > -1 || extensions.indexOf('fixedpoint') > -1)) {
  var jiffBigNumberServer = require('../../lib/ext/jiff-server-bignumber');
  console.log('bigNumber');
  jiffBigNumberServer.make_jiff(jiff_instance);
}


// Serve static files.
app.use('/demos', express.static('demos'));
app.use('/lib', express.static('lib'));
app.use('/lib/ext', express.static('lib/ext'));
http.listen(3001, function () {
  console.log('listening on *:3001');
});

