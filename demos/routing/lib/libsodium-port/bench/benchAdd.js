var BENCHCOUNT = 100000;

// require c++ binding module
var wrapper = require('../wrapper.js');

wrapper.ready.then(function () {
  // Find and hash some Points
  var point1 = wrapper.hashToPoint('hello');
  var point2 = wrapper.hashToPoint('world!');

  // Run several tests
  for (var t = 0; t < BENCHCOUNT; t++) {
    point1 = wrapper.pointAdd(point1, point2);
  }

  console.log('success add');
});
