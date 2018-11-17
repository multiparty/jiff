(function (exports, node) {
  // In general, we will use the native node-gyp wrapper module in variable lib for nodejs, and
  // sodium-wrappers-sumo (from static/sodium-wrappers-sumo.js) in the browser.

  // The difficulty is that for certain functionality, these two libraries do not produce matching result.
  // Therefore, for hashing to a point. We will use sodium-wrappers-sumo in both node and the browser.

  var lib, sodiumSumo, _BN;
  if (node) {
    lib = require('../../build/Release/obj.target/native.node');
    sodiumSumo = require('libsodium-wrappers-sumo');
    _BN = require('bn.js');

    lib.initSodium();
  } else {
    // eslint-disable-next-line no-undef
    sodiumSumo = sodium;
    // eslint-disable-next-line no-undef
    lib = elliptic.eddsa('ed25519');
    // eslint-disable-next-line no-undef
    _BN = BN;
  }

  // Constants and promises
  exports.ready = sodiumSumo.ready;
  exports.prime = new _BN(2).pow(new _BN(252)).add(new _BN('27742317777372353535851937790883648493'));

  // Libsodium generic hash
  exports.genericHash = function (data, length) {
    if (length == null) {
      length = sodiumSumo.crypto_generichash_BYTES;
    }
    return sodiumSumo.crypto_generichash(length, data);
  };

  // Hash to a point
  exports.hashToPoint = function (data, hash) {
    var size = sodiumSumo.libsodium._crypto_core_ed25519_uniformbytes();
    if (hash !== false) {
      data = exports.genericHash(data, size);
    }

    var dataAddress = myMalloc(size);
    var resultAddress = myMalloc(size);
    writeMalloc(dataAddress, data);

    sodiumSumo.libsodium._crypto_core_ed25519_from_uniform(resultAddress, dataAddress);
    // free addresses
    var result = readMalloc(resultAddress, size);

    freeMalloc(dataAddress);
    freeMalloc(resultAddress);
    return result;
  };

  // Point Addition / Subtraction
  exports.pointAdd = function (point1, point2) { // both 32 bytes arrays
    if (node) {
      var result = lib.pointAdd(point1.buffer, point2.buffer).slice(0);
      return new Uint8Array(result);
    } else {
      point1 = lib.decodePoint(Array.from(point1));
      point2 = lib.decodePoint(Array.from(point2));
      point1 = point1.add(point2);
      return new Uint8Array(lib.encodePoint(point1));
    }
  };

  exports.pointSub = function (point1, point2) { // both 32 bytes arrays
    if (node) {
      var result = lib.pointSub(point1.buffer, point2.buffer).slice(0);
      return new Uint8Array(result);
    } else {
      point1 = lib.decodePoint(Array.from(point1));
      point2 = lib.decodePoint(Array.from(point2));
      point1 = point1.sub(point2);
      return new Uint8Array(lib.encodePoint(point1));
    }
  };

  // Scalar Multiplication
  exports.scalarMult = function (point, scalar) { // both 32 bytes arrays
    if (node) {
      var result = lib.scalarMult(scalar.buffer, point.buffer).slice(0);
      return new Uint8Array(result);
    } else {
      scalar = exports.bytesToBN(scalar);
      point = lib.decodePoint(Array.from(point));
      point = point.mul(scalar);
      return new Uint8Array(lib.encodePoint(point));
    }
  };

  //
  // General helpers for dealing with buffers and byte arrays
  //

  // Works for UTF-8 strings
  exports.stringToBytesSodium = sodiumSumo.from_string;
  exports.bytesToStringSodium = sodiumSumo.to_string;

  // return a byte conversion of the string of given length padded with zeros to the right if needed
  // by default length is 32
  exports.stringToBytesASCII = function (str, length) {
    if (length == null) {
      length = sodiumSumo.libsodium._crypto_core_ed25519_uniformbytes();
    }

    if (str.length > length) {
      throw new Error('Provided string is too long to fit in length: use .stringToBytes(str, str.length)');
    }

    // Assume that str is all ASCII characters
    var bytes = new Uint8Array(length);
    for (var i = 0; i < str.length; i++) {
      var unicode = str.charCodeAt(i);
      if (unicode > 255) {
        throw new Error('String contains non ASCII characters');
      }

      bytes[i] = unicode;
    }

    return bytes;
  };
  exports.bytesToStringASCII = function (bytes) {
    var lastZero;
    for (lastZero = bytes.length-1; lastZero >= 0; lastZero--) {
      if (bytes[lastZero] !== 0) {
        break;
      }
    }

    bytes = bytes.slice(0, lastZero+1);
    var str = '';
    for (var i = 0; i < bytes.length; i++) {
      str += String.fromCharCode(bytes[i]);
    }

    return str;
  };

  exports.bytesToBN = function (bytes) {
    var result = new _BN('0');
    for (var i = bytes.length-1; i >= 0; i--) {
      var b = new _BN(bytes[i]);
      result = result.or(b).shln(i * 8);
    }
    return result;
  };
  exports.BNToBytes = function (num, length) {
    if (length == null) {
      length = sodiumSumo.libsodium._crypto_core_ed25519_uniformbytes();
    }

    var bytes = new Uint8Array(length);
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
  };

  //
  // Helpers for allocating memory in the browser
  //

  function myMalloc(length) {
    var resultAddress = sodiumSumo.libsodium._malloc(length);
    if (resultAddress === 0) {
      throw new Error('libsodium malloc failed');
    }
    return resultAddress;
  }

  function readMalloc(address, length) {
    var result = new Uint8Array(length);
    result.set(sodiumSumo.libsodium.HEAPU8.subarray(address, address + length));
    return result;
  }

  function writeMalloc(address, bytes) {
    sodiumSumo.libsodium.HEAPU8.set(bytes, address);
  }

  function freeMalloc(address) {
    sodiumSumo.libsodium._free(address);
  }
}((typeof exports === 'undefined' ? this.mySodiumWrapper = {} : exports), typeof exports !== 'undefined'));
