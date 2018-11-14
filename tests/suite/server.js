var extensions = process.env['JIFF_TEST_NAME'];

var express = require('express');
var app = express();
var http = require('http').Server(app);

var jiffServer = require('../../lib/jiff-server');
var jiffRestAPIServer =  require('../../lib/ext/jiff-server-restful');
var jiffBigNumberServer = require('../../lib/ext/jiff-server-bignumber');

var options = {
  logs: true,
  app: app
};

var jiff_instance = jiffServer.make_jiff(http, options);
jiff_instance.apply_extension(jiffRestAPIServer, options);
if (extensions != null && (extensions.indexOf('bigNumber') > -1 || extensions.indexOf('fixedpoint') > -1)) {
  jiff_instance.apply_extension(jiffBigNumberServer, options);
}

// Serve static files.
app.use('/demos', express.static('demos'));
app.use('/lib', express.static('lib'));
app.use('/lib/ext', express.static('lib/ext'));
http.listen(3001, function () {
  console.log('listening on *:3001');
});

