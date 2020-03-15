var path = require('path');
var express = require('express');
var app = express();
var http = require('http').Server(app);
var JIFFServer = require('../../lib/jiff-server');
new JIFFServer(http, { logs:false });

// Serve static files.
app.use('/demos', express.static(path.join(__dirname, '..', '..', 'demos')));
app.use('/dist', express.static(path.join(__dirname, '..', '..', 'dist')));
app.use('/lib/ext', express.static(path.join(__dirname, '..', '..', 'lib', 'ext')));
http.listen(8080, function () {
  if (process.argv[2] !== 'suppress') {
    console.log('listening on *:8080');
  }
});

if (process.argv[2] !== 'suppress') {
  console.log('Direct your browser to http://localhost:8080/demos/threshold/client.html.');
  console.log('To run a server-based party: node demos/threshold/party <input');
  console.log();
}
