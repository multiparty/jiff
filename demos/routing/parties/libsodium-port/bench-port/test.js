// require c++ binding module
var native = require('../../../build/Release/obj.target/native.node');
var BN = require('bn.js');

// convert int to Uint8Array with 32 bytes
function to32Bytes(num) {
  var bytes = new Uint8Array(32);
  var str = num.toString(2);
  
  while(str.length < 32 * 8) {
    str = '0' + str;
  }
  
  for(var i = 0; i < 32; i++) {
    var byte = '';
    for(var j = 0; j < 8; j++) {
      byte +=  str.charAt(i*8 + j);
    }
    bytes[i] = parseInt(byte, 2);
  }
  
  return bytes.reverse();
}

// Some scalar
var order = new BN(2).pow(new BN("252")).add(new BN("27742317777372353535851937790883648493"));
var scalar = new BN(2);
var inv = scalar.invm(order);

// Some point
var label = new Uint8Array(32);
label[13] = 1;

// init
console.log('init', native.initSodium());

// hash point
var point = native.hashToPoint(label.buffer);
point = point.slice(0); // copy
point = new Uint8Array(point);
console.log('hash', point);

// start test
// 1st mult
var result = native.applyPRF(to32Bytes(scalar).buffer, point.buffer);
result.slice(0);
result = new Uint8Array(result);
console.log('1st', result);

// 2nd mult: by inverse
var result = native.applyPRF(to32Bytes(inv).buffer, result.buffer);
result.slice(0);
result = new Uint8Array(result);
console.log('2nd', result);

var equal = true;
for(var i = 0; i < 32; i++) {
  if(result[i] != point[i]) {
    equal = false;
    break;
  }
}
console.log(equal);
