// internal functions for use in preprocessing function map
module.exports = {
  bits_count: function (threshold, receivers_list, compute_list, Zp, op_id, params) {
    var bitLength = params.bitLength;
    if (bitLength == null) {
      bitLength = Zp.toString(2).length;
    }
    return bitLength;
  },
  constant_bits_count: function () {
    return module.exports.bits_count.apply(null, arguments) - 1;
  },
  dynamic_bits_cmult: function (dependent_op, count, protocols, threshold, receivers_list, compute_list, Zp, id_list, params) {
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
  },
  dynamic_bits_smult: function (dependent_op, count, protocols, threshold, receivers_list, compute_list, Zp, id_list, params) {
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
  },
  choice_bits_count: function (choice, offset) {
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
  },
  decomposition_ifelse_count: function (threshold, receivers_list, compute_list, Zp, op_id, params) {
    return Zp.toString(2).length;
  },
  dynamic_bits_sdiv: function (dependent_op, count, protocols, threshold, receivers_list, compute_list, Zp, id_list, params) {
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
  },
  dynamic_bits_cdiv: function (dir) {
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
        var accLength = Math.min(i + 1, min + 1);
        if (dir === 'left') {
          ops.push({
            op: 'bits.csubl',
            op_id: ':bits.csubl:' + i,
            params: {bitLength: accLength, constantBits: constantBits}
          });
        } else {
          ops.push({
            op: 'bits.ssub',
            op_id: ':bits.ssub:' + i,
            params: {bitLengthLeft: accLength, bitLengthRight: bitLength}
          });
        }

        for (var j = 0; j < accLength; j++) {
          ops.push({op: 'if_else', op_id: ':if_else:' + i + ':' + j});
        }
      }
      return ops;
    }
  },
  // rejection sampling
  dynamic_rejection_sampling: function (dependent_op, count, protocols, threshold, receivers_list, compute_list, Zp, id_list, params, task, jiff) {
    var previousPreprocessing = jiff.preprocessing_table[task.id];
    params.reject_count = params.reject_count == null ? -1 : params.reject_count;

    if (previousPreprocessing == null || previousPreprocessing === 'RETRY' || previousPreprocessing[0].value === 'RETRY') {
      var compute_threshold = params.compute_threshold;
      if (compute_threshold == null) { // honest majority BGW
        compute_threshold = Math.floor((compute_list.length + 1) / 2);
      }

      var extra_params = {compute_threshold: compute_threshold};
      var reject_count = ++params.reject_count;

      Zp = Zp != null ? Zp : jiff.Zp;
      params.lower_bound = params.lower_bound || 0;
      params.upper_bound = params.upper_bound != null ? params.upper_bound : Zp;

      var range;
      if (params.upper_bound.isBigNumber === true) {
        range = params.upper_bound.minus(params.lower_bound);
      } else {
        range = params.upper_bound - params.lower_bound;
      }

      // handle special cases
      if (range.toString() === '0') {
        throw new Error('rejection sampling preprocessing called with range 0, no numbers to sample!');
      }
      if (range.toString() === '1') {
        return [{op: 'sampling', op_id: '', params: extra_params}];
      }

      var bitLength = jiff.helpers.ceil(jiff.helpers.bLog(range, 2));
      bitLength = parseInt(bitLength.toString(), 10);
      params.bitLength = bitLength;

      // fill in dependencies according to the lower and upper bounds
      var dependent_ops = [];
      var requires = [];
      if (jiff.helpers.bLog(range, 2).toString().indexOf('.') > -1) {
        dependent_ops = [
          {op: 'bits.clt', op_id: ':bits.clt:' + reject_count, params: extra_params, threshold: compute_threshold, receivers_list: compute_list},
          {op: 'open', op_id: ':open:' + reject_count, params: extra_params, threshold: compute_threshold, receivers_list: compute_list}
        ];
        requires = [0, 1];
      }

      if (params.lower_bound.toString() !== '0' && bitLength > 1) {
        dependent_ops.push({op: 'bits.cadd', op_id: ':bits.cadd:' + reject_count, params: extra_params, threshold: compute_threshold, receivers_list: compute_list});
        requires.push(dependent_ops.length - 1);
      }

      dependent_ops.push(
        {op: 'sampling', op_id: '', requires: requires, params: extra_params},
        {op: 'rejection_sampling', op_id: '', requires: [dependent_ops.length]}
      );

      return dependent_ops;
    }

    if (previousPreprocessing[0].value === 'PLACEHOLDER') {
      delete jiff.preprocessing_table[task.id];
    }

    return [];
  }
};