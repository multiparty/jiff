var express = require('express');
var app = express();
var http = require('http').Server(app);
require('../../lib/jiff-server').make_jiff(http, { logs:false });

// Serve static files.
app.use('/demos', express.static('demos'));
app.use('/lib', express.static('lib'));
app.use('/lib/ext', express.static('lib/ext'));
http.listen(8080, function () {
  if (process.argv[2] !== 'suppress') {
    console.log('listening on *:8080');
  }
});

if (process.argv[2] !== 'suppress') {
  console.log('Direct your browser to *:8080/demos/threshold/client.html.');
  console.log('To run a server-based party: node demos/threshold/party <input');
  console.log();
}
