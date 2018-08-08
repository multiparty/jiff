const _sodium = require('libsodium-wrappers-sumo');
const _oprf = require('oprf');

_sodium.ready.then(function() {
  try {
    var oprf = new _oprf.OPRF(_sodium);

    var filename = process.argv[2];
    var file = require('../scrape/server.json');

    var hashed = [];
    for (var i = 0; i < file.length; i++) {
      hashed[i] = [];
      var row = file[i];
      for (var j = 0; j < row.length; j++) {
        var val = row[j];
        hashed[i][j] = oprf.hashToPoint(val.toString());
      }
    }

    console.log(JSON.stringify(hashed));
  } catch (err) {
    console.log(err);
  }
});
