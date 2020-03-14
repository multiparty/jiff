var path = require('path');
var express = require('express');
var app = express();
var http = require('http').Server(app);
var JIFFServer = require('../../lib/jiff-server');
var jiff_instance = new JIFFServer(http, {logs: false});

var computation_instance = jiff_instance.compute('1');
computation_instance.wait_for(['1'], function () {
  // Perform server-side computation.
  console.log('Hello!');

  computation_instance.listen('begin', function (_, party_count) {
    console.log('Begin');

    // Get all connected parties IDs
    // TODO: need hooks/helpers for this
    var parties_number = 0;
    var party_map = jiff_instance.socket_map['1'];
    for (var id in party_map) {
      if (party_map.hasOwnProperty(id)) {
        parties_number++;
      }
    }

    // Send number of parties to analyst
    computation_instance.emit('number', [ 1 ], parties_number);

    // Begin computation
    var shares = {};
    var i;
    for (i = 2; i <= parties_number; i++) {
      shares[i] = computation_instance.share(null, 2, [1, 's1'], [ i ])[i];
    }

    var sum = shares[2];
    for (i = 3; i <= parties_number; i++) {
      sum = sum.sadd(shares[i]);
    }

    computation_instance.open(sum, [1]);
  });
});

// Serve static files.
app.use('/demos', express.static(path.join(__dirname, '..', '..', 'demos')));
app.use('/dist', express.static(path.join(__dirname, '..', '..', 'dist')));
app.use('/lib/ext', express.static(path.join(__dirname, '..', '..', 'lib', 'ext')));
http.listen(8080, function () {
  console.log('listening on *:8080');
});

console.log('Direct your browser to *:8080/demos/sum/client.html.');
console.log('To run a server-based party: node index.js demos/sum/party');
console.log()
