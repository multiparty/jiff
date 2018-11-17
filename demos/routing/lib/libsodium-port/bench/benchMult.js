var BENCHCOUNT = 100000;

// require c++ binding module
var wrapper = require('../wrapper.js');
var BN = require('bn.js');

wrapper.ready.then(function () {
  // Find and hash some Point
  var point = wrapper.hashToPoint('hello');

  // Find scalar
  var random = new BN(Math.floor(Math.random() * 10000));
  var scalar = wrapper.BNToBytes(random);

  // Run several tests
  for (var t = 0; t < BENCHCOUNT; t++) {
    point = wrapper.scalarMult(point, scalar);
  }

  console.log('success mult');
});
