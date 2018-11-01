// require c++ binding module
var wrapper = require('../wrapper.js');
var BN = require('../../../node_modules/bn.js/lib/bn');

wrapper.ready.then(function () {
  // Find and hash some Point
  var point = wrapper.hashToPoint('hello');
  var pointStr = point.join(',');

  // Find random scalar and its inverse
  var prime = wrapper.prime;

  // Run several tests
  for (var t = 0; t < 1000; t++) {
    var random = new BN(Math.floor(Math.random() * 10000));
    var scalar = wrapper.BNToBytes(random);
    var inv = wrapper.BNToBytes(random.invm(prime));

    // First multiplication
    var result = wrapper.scalarMult(point, scalar);
    // Second multiplication
    result = wrapper.scalarMult(result, inv);

    // Should be equal to original point
    var resultStr = point.join(',');
    if (resultStr !== pointStr) {
      console.log('FAIL');
      return;
    }
  }

  console.log('success');
});