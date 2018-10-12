// PRF Count to benchmark
var count = process.argv[2];
if (count == null) {
  count = 200;
}

// Dependencies
var _sodium = require('libsodium-wrappers-sumo');
var _oprf = require('oprf');
var BN = require('bn.js');

_sodium.ready.then(function () {
  var oprf = new _oprf.OPRF(_sodium);
  var scalarKey = new BN(oprf.generateRandomScalar()).toString();

  for (var i = 1; i <= count; i++) {
    var point = oprf.hashToPoint(i.toString());
    oprf.scalarMult(point, scalarKey);
  }

  console.log('done');
});
