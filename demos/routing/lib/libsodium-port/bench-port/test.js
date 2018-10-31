// require c++ binding module
var native = require('../../../build/Release/obj.target/native.node');
var BN = require('bn.js');

// init
native.initSodium();

// Byte conversions
function bytesToBN(bytes) {
  var result = new BN('0');
  for (var i = bytes.length-1; i >= 0; i--) {
    var b = new BN(bytes[i]);
    result = result.or(b).shln(i * 8);
  }
  return result;
}
function BNToBytes(num) {
  var bytes = new Uint8Array(32);
  var str = num.toString(2);

  while (str.length < 32 * 8) {
    str = '0' + str;
  }

  for (var i = 0; i < 32; i++) {
    var byte = '';
    for (var j = 0; j < 8; j++) {
      byte +=  str.charAt(i*8 + j);
    }
    bytes[i] = parseInt(byte, 2);
  }

  return bytes.reverse();
}

// Find and hash some Point
var label = new Uint8Array(32);
label[13] = 1;
var point = native.hashToPoint(label.buffer);
point = point.slice(0); // copy
point = new Uint8Array(point);

// Find random scalar and its inverse
for (var t = 0; t < 1000; t++) {
  var order = new BN(2).pow(new BN('252')).add(new BN('27742317777372353535851937790883648493'));
  var scalar = native.randomScalar().slice(0);
  scalar = new Uint8Array(scalar);
  scalar = bytesToBN(scalar).mod(order);
  var inv = scalar.invm(order);
  scalar = BNToBytes(scalar).buffer;
  inv = BNToBytes(inv).buffer;

  // start test
  // 1st mult
  var result = native.applyPRF(scalar, point.buffer);
  result.slice(0);
  result = new Uint8Array(result);

  // 2nd mult: by inverse
  result = native.applyPRF(inv, result.buffer);
  result.slice(0);
  result = new Uint8Array(result);

  for (var i = 0; i < 32; i++) {
    if (result[i] !== point[i]) {
      console.log('problem');
      return;
    }
  }
}

console.log('success');