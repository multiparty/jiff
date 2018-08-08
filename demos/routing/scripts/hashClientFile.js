const _sodium = require('libsodium-wrappers-sumo');
const _oprf = require('oprf');

_sodium.ready.then(function() {
  try {
    var oprf = new _oprf.OPRF(_sodium);

    var filename = process.argv[2];
    var obj = require('../scrape/client.js').obj;

    var result = { features: [ ] };
    var points = obj.features;
    for (var i = 0; i < points.length; i++) {
      var id = points[i].properties.point_id;
      id = oprf.hashToPoint(id.toString());
      points[i].properties.point_id = JSON.stringify(id);
      result.features.push(points[i]);
    }

    console.log('var obj = ' + JSON.stringify(result) + ";");
    console.log('var unreached = "' + JSON.stringify(oprf.hashToPoint("0")) + '";');
  } catch (err) {
    console.log(err);
  }
});
