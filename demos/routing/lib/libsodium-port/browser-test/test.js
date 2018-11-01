var mySodiumWrapper = require('../wrapper.js');
var BN = require('../../../node_modules/bn.js/lib/bn');

mySodiumWrapper.ready.then(function () {
  var point = mySodiumWrapper.hashToPoint('hello');
  console.log('hash', point.join(','));

  var scalar = new BN(2032);
  scalar = mySodiumWrapper.BNToBytes(scalar);

  point = mySodiumWrapper.scalarMult(point, scalar);
  console.log('mult', point.join(','));
});
