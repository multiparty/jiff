var express = require('express');
var app = express();
var http = require('http').Server(app);
var base_instance = require('../../lib/jiff-server').make_jiff(http, {logs: true});
require('../../lib/ext/jiff-server-bignumber').make_jiff(base_instance);

// Server static files.
app.use('/demos', express.static('demos'));
app.use('/lib', express.static('lib'));
app.use('/lib/ext', express.static('lib/ext'));
http.listen(3004, function () {
  console.log('listening on *:3004');
});
