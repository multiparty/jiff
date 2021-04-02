var extensions = process.env['JIFF_TEST_NAME'];

var express = require('express');
var app = express();
var http = require('http').Server(app);

var jiffServer = require('../../lib/jiff-server');
var jiffRestAPIServer =  require('../../lib/ext/jiff-server-restful');
var jiffBigNumberServer = require('../../lib/ext/jiff-server-bignumber');
var jiffWebSocketServer = require('../../lib/ext/jiff-server-websockets');

var options = {
  logs: true,
  app: app
};

var jiff_instance = new jiffServer(http, options);
if (extensions != null && (extensions.indexOf('bigNumber') > -1 || extensions.indexOf('fixedpoint') > -1)) {
  jiff_instance.apply_extension(jiffBigNumberServer, options);
}
if (extensions != null && extensions.indexOf('restAPI') > -1) {
  var bodyParser  = require('body-parser');
  app.use(bodyParser.urlencoded({ extended: true }));
  app.use(bodyParser.json());
  jiff_instance.apply_extension(jiffRestAPIServer, options);
}
if (extensions != null && extensions.indexOf('jiff_websockets') > -1) {
  jiff_instance.apply_extension(jiffWebSocketServer, options);
}

// Serve static files.
app.use('/demos', express.static('demos'));
app.use('/lib', express.static('lib'));
app.use('/lib/ext', express.static('lib/ext'));
http.listen(3001, function () {
  console.log('listening on *:3001');
});

