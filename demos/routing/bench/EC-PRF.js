// PRF Count to benchmark
var count = process.argv[2];
if(count == null) count = 200;

// Dependencies
const _sodium = require('libsodium-wrappers-sumo');
const _oprf = require('oprf');
const BN = require('bn.js');

_sodium.ready.then(function() {
  var oprf = new _oprf.OPRF(_sodium);
  var scalarKey = new BN(oprf.generateRandomScalar()).toString();

  for(var i = 1; i <= count; i++) {
    var point = oprf.hashToPoint(i.toString());
    var scalar = oprf.scalarMult(point, scalarKey);
  }
  
  console.log('done');
});
