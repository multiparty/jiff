var express = require('express');
var app = express();
var bodyParser  = require('body-parser');
var http = require('http').Server(app);

//Serve static files
//Configure App
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use('/demos', express.static('demos'));
app.use('/lib', express.static('lib'));
app.use('/lib/ext', express.static('lib/ext'));

var jiff_instance = require('../../lib/jiff-server').make_jiff(http, { logs: true });
var jiffREST = require('../../lib/ext/jiff-server-restful');
jiff_instance.apply_extension(jiffREST, { logs: true, app: app });

// Serve static files.
http.listen(8080, function () {
  console.log('listening on *:8080');
});

console.log('Direct your browser to *:8080/demos/sum/client.html.');
console.log('To run a node.js based party: node demos/sum/party <input>');
console.log();
