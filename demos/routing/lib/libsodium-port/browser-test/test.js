var mySodiumWrapper = require('../wrapper.js');
var BN = require('bn.js');

mySodiumWrapper.ready.then(function () {
  // Hash
  var point1 = mySodiumWrapper.hashToPoint('hello1');
  console.log('hash1:', point1.join(','));

  var point2 = mySodiumWrapper.hashToPoint('hello2');
  console.log('hash2:', point2.join(','));

  // Add
  var pointAdd = mySodiumWrapper.pointAdd(point1, point2);
  console.log('add:', pointAdd.join(','));

  // Sub
  var pointSub = mySodiumWrapper.pointSub(pointAdd, point2);
  console.log('sub:', pointSub.join(','));

  // Scalar Mult
  var scalar = new BN(2032);
  scalar = mySodiumWrapper.BNToBytes(scalar);

  var pointMult = mySodiumWrapper.scalarMult(point1, scalar);
  console.log('mult:', pointMult.join(','));
});
