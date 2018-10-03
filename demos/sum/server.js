var express = require('express');
var app = express();
const bodyParser  = require("body-parser");
var http = require('http').Server(app);

//Serve static files
//Configure App
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use("/demos", express.static("demos"));
app.use("/lib", express.static("lib"));
app.use("/lib/ext", express.static("lib/ext"));


var jiff_instance = require('../../lib/jiff-server').make_jiff(http, { logs:true }, app);

//for future production release

const port = process.env.port || 8080;
http.listen(8080, function () {
  console.log('listening on *:8080');
});

console.log("Direct your browser to *:8080/demos/sum/client.html.");
console.log("To run a node.js based party: node demos/sum/party <input>");
console.log();