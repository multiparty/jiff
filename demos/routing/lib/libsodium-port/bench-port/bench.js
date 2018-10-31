// require c++ binding module
var native = require('../../../build/Release/obj.target/native.node');

// Some scalar
var scalar = [];
for(var i = 0; i < 32; i++) {
  scalar[i] = 0;
}
scalar[14] = 1;
scalar = new Uint8Array(scalar);

// Some point
var point = [];
for(var i = 0; i < 32; i++) {
  point[i] = 1;
}
point = new Uint8Array(point);


// init and hash point
console.log(native.initSodium());
point = new Uint8Array(native.hashToPoint(point.buffer).slice(0));

// start bench marks
console.time("bench");
for(var i = 0; i < 25000; i++) {
  point = native.applyPRF(scalar.buffer, point.buffer).slice(0);
  point = new Uint8Array(point);
}
console.timeEnd("bench");



