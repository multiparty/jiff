var express = require('express');
var app = express();
var http = require('http').Server(app);
var base_instance = require('../../lib/jiff-server').make_jiff(http, { logs:true });
var jiffAsyncShareServer = require('../../lib/ext/jiff-server-asyncshare');
base_instance.apply_extension(jiffAsyncShareServer);

//Serve static files
//Configure App
app.use('/demos', express.static('demos'));
app.use('/lib', express.static('lib'));
app.use('/lib/ext', express.static('lib/ext'));

// Serve static files.
http.listen(8080, function () {
  console.log('listening on *:8080');
});

console.log('Direct your browser to *:8080/demos/asyncshare/client.html.');
console.log('To run a node.js based party: node demos/asyncshare/party <input>');
console.log();
