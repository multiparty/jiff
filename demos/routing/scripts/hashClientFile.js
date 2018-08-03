const _sodium = require('libsodium-wrappers-sumo');
const _oprf = require('oprf');

_sodium.ready.then(function() {
  try {
    var oprf = new _oprf.OPRF(_sodium);

    var filename = process.argv[2];
    var obj = require("../"+filename).obj;

    var points = obj.features;
      for(var i = 0; i < points.length; i++) {
      var id = points[i].properties.point_id;
      id = oprf.hashToPoint(id.toString());
      points[i].properties.point_id = JSON.stringify(id);
    }
    
    console.log(JSON.stringify(obj));
  } catch(err) {
    console.log(err);
  }
});
