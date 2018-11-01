var table = require('../data/test2.json'); // server table
var client = require('../static/client2.js'); // client data

// parse client
var points = client.obj.features;
var clientIds = [];
for (var p = 0; p < points.length; p++) {
  clientIds.push(points[p].properties.point_id)
}

// parse server
var server  = {};
for (var i = 0; i < table.length; i++) {
  var single_entry = table[i];
  var source = JSON.stringify(single_entry[0]);
  var destination = JSON.stringify(single_entry[1]);
  var jump = JSON.stringify(single_entry[2]);

  if (server[source] == null) {
    server[source] = {};
  }
  server[source][destination] = jump;
}

// CHECK!
var n = 0;
for (var k = 0; k < clientIds.length; k++) {
  if (server[clientIds[k]] == null) {
    n++;
  }
}

console.log('done', clientIds.length, n);
