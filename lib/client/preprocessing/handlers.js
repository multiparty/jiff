// internal functions for use in preprocessing function map
var bits_count = function (threshold, receivers_list, compute_list, Zp, op_id, params) {
  var bitLength = params.bitLength;
  if (bitLength == null) {
    bitLength = Zp.toString(2).length;
  }
  return bitLength;
};
var constant_bits_count = function () {
  return bits_count.apply(null, arguments) - 1;
};
var dynamic_bits_cmult = function (dependent_op, count, protocols, threshold, receivers_list, compute_list, Zp, id_list, params) {
  // constant bit length
  var constantBits = Zp.toString(2).length;
  if (params.constantBits != null) {
    constantBits = params.constantBits;
  }
  // secret bit length
  var bitLength = params.bitLength;
  if (bitLength == null) {
    bitLength = Zp.toString(2).length;
  }
  // for every bit from constant, pre-process for one bits.sadd of the right size
  var ops = [];
  for (var i = 0; i < constantBits; i++) {
    var accLength = i === 0 ? 1 : (bitLength + i);
    ops.push({ op: 'bits.sadd', op_id: ':bits.sadd:' + i, params: {bitLengthLeft: accLength, bitLengthRight: bitLength + i}});
  }
  return ops;
};
var dynamic_bits_smult = function (dependent_op, count, protocols, threshold, receivers_list, compute_list, Zp, id_list, params) {
  var bitLength = params.bitLength;
  if (bitLength == null) {
    bitLength = Zp.toString(2).length;
  }

  var left = params.bitLengthLeft;
  var right = params.bitLengthRight;
  left = left != null ? left : bitLength;
  right = right != null ? right : bitLength;
  var max = Math.max(left, right);
  var min = Math.max(left, right);

  var ops = [];
  for (var i = 0; i < min; i++) {
    for (var j = 0; j < max + i; j++) {
      ops.push({ op: 'if_else', op_id: ':if_else:' + i + ':' + j });
    }
    var accLength = i === 0 ? min : (max + i);
    ops.push({ op: 'bits.sadd', op_id: ':bits.sadd:'+i, params: {bitLengthLeft: accLength, bitLengthRight: max + i}});
  }
  return ops;
};
var choice_bits_count = function (choice, offset) {
  if (offset == null) {
    offset = 0;
  }
  return function (threshold, receivers_list, compute_list, Zp, op_id, params) {
    var bitLength = params.bitLength;
    if (bitLength == null) {
      bitLength = Zp.toString(2).length;
    }

    var left = params.bitLengthLeft;
    var right = params.bitLengthRight;
    left = left != null ? left : bitLength;
    right = right != null ? right : bitLength;

    return choice(left, right) + offset;
  };
};
var decomposition_ifelse_count = function (threshold, receivers_list, compute_list, Zp, op_id, params) {
  return Zp.toString(2).length;
};
var dynamic_bits_sdiv = function (dependent_op, count, protocols, threshold, receivers_list, compute_list, Zp, id_list, params) {
  var bitLength = params.bitLength;
  if (bitLength == null) {
    bitLength = Zp.toString(2).length;
  }

  var left = params.bitLengthLeft;
  var right = params.bitLengthRight;
  left = left != null ? left : bitLength;
  right = right != null ? right : bitLength;
  var min = Math.min(left, right);

  var ops = [];
  for (var i = 0; i < left; i++) {
    var accLength = Math.min(i+1, min+1);
    ops.push({ op: 'bits.ssub', op_id: ':bits.ssub:'+i, params: {bitLengthLeft: accLength, bitLengthRight: right}});
    for (var j = 0; j < accLength; j++) {
      ops.push({ op: 'if_else', op_id: ':if_else:' + i + ':' + j });
    }
  }
  return ops;
};
var dynamic_bits_cdiv = function (dir) {
  return function (dependent_op, count, protocols, threshold, receivers_list, compute_list, Zp, id_list, params) {
    var constantBits = Zp.toString(2).length;
    if (params.constantBits != null) {
      constantBits = params.constantBits;
    }
    var bitLength = params.bitLength;
    if (bitLength == null) {
      bitLength = Zp.toString(2).length;
    }
    var min = Math.min(bitLength, constantBits);

    var ops = [];
    var loopCounter = (dir === 'left') ? bitLength : constantBits;
    for (var i = 0; i < loopCounter; i++) {
      var accLength = Math.min(i+1, min+1);
      if (dir === 'left') {
        ops.push({ op: 'bits.csubl', op_id: ':bits.csubl:' + i, params: {bitLength: accLength, constantBits: constantBits} });
      } else {
        ops.push({ op: 'bits.ssub', op_id: ':bits.ssub:' + i, params: {bitLengthLeft: accLength, bitLengthRight: bitLength} });
      }

      for (var j = 0; j < accLength; j++) {
        ops.push({ op: 'if_else', op_id: ':if_else:' + i + ':' + j });
      }
    }
    return ops;
  }
};