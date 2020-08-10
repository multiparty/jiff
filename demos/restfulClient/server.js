// Server setup
var express = require('express');
var app = express();
var http = require('http').Server(app);
var path = require('path');


// body parser to handle json data
var bodyParser  = require('body-parser');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
// Keep track of assigned ids
var options = {
  logs: true
};

// Create the server
var JIFFServer = require('../../lib/jiff-server');
var jiffRestAPIServer = require('../../lib/ext/jiff-server-restful.js');
var jiffServer = new JIFFServer(http, options);
jiffServer.apply_extension(jiffRestAPIServer, {app: app});

app.use('/demos', express.static(path.join(__dirname, '..', '..', 'demos')));
app.use('/dist', express.static(path.join(__dirname, '..', '..', 'dist')));
app.use('/lib/ext', express.static(path.join(__dirname, '..', '..', 'lib', 'ext')));
http.listen(8080, function () {
  console.log('listening on *:8080');
});

