const _sodium = require('libsodium-wrappers-sumo');
const _oprf = require('oprf');

var remove = [0, 6, 7, 8, 35, 48, 87, 178, 179, 182, 184, 186, 197, 198, 199, 200]

_sodium.ready.then(function() {
  try {
    var oprf = new _oprf.OPRF(_sodium);

    var filename = process.argv[2];
    var obj = require('../'+filename).obj;

    var result = { features: [ ] };
    var points = obj.features;
    for (var i = 0; i < points.length; i++) {
      var id = points[i].properties.point_id;

      if (remove.indexOf(id) > -1) {
        continue;
      }

      id = oprf.hashToPoint(id.toString());
      points[i].properties.point_id = JSON.stringify(id);
      result.features.push(points[i]);
    }

    console.log('var obj = ' + JSON.stringify(result));
  } catch (err) {
    console.log(err);
  }
});
