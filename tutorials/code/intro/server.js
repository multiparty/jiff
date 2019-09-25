var express = require('express');
var app = express();
var http = require('http').Server(app);

// Set up server jiff instance
require('../../../lib/jiff-server').make_jiff(http, { logs:true });

// Run app
try {
  http.listen(9111, function () {
    console.log('listening on *:9111');
  });
} catch (err) {
  console.log('ERROR:'+err.message)
}

console.log('To run a node.js based party: node party <input>');
