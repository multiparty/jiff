var express = require('express');
var app = express();
var http = require('http').Server(app);
var jiff_instance = require('./jiff-server').make_jiff(http);

// Define a computation with id '1' with a maximum of 3 participants
jiff_instance.totalparty_map['1'] = 3;

// Server static files
app.use(express.static("tests"));

http.listen(3000, function() {
  console.log('listening on *:3000');
});

