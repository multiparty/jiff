var fs = require('fs');

const _sodium = require('libsodium-wrappers-sumo');
const _oprf = require('oprf');

_sodium.ready.then(function() {
  var oprf = new _oprf.OPRF(_sodium);
  
  var hashTable = {};

  // Client hashing
  var obj = require('../scrape/client.js').obj;

  var result = { features: [ ] };
  var points = obj.features;
  for (var i = 0; i < points.length; i++) {
    var old_id = points[i].properties.point_id;
    var id = oprf.hashToPoint(old_id.toString());
    points[i].properties.point_id = JSON.stringify(id);
    result.features.push(points[i]);
    hashTable[old_id] =  id;
  }

  var clientContent = 'var obj = ' + JSON.stringify(result) + ';\n';
  clientContent += 'var unreached = "' + JSON.stringify(oprf.hashToPoint("0")) + '";\n';
  clientContent += 'if(typeof exports !== "undefined") { exports.obj = obj; exports.unreached = unreached; }\n';

  // Server hashing
  var file = require('../scrape/server.json');

  var hashed = [];
  for (var i = 0; i < file.length; i++) {
    hashed[i] = [];
    var row = file[i];
    for (var j = 0; j < row.length; j++) {
      var val = row[j];
      if(hashTable[val] == null) {
        console.log('found point on server that was not on the client');
        return;
      }
      hashed[i][j] = hashTable[val];
    }
  }

  var serverContent = JSON.stringify(hashed);
  
  // write out to files
  fs.writeFile('./scripts/server.json', serverContent, console.log);
  fs.writeFile('./scripts/client.js', clientContent, console.log);
  
  console.log('done');
});
