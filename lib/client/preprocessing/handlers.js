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
  dynamic_bits_cmult: function (dependent_op, count, protocols, threshold, receivers_list, compute_list, Zp, task_id, params) {
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
  dynamic_bits_smult: function (dependent_op, count, protocols, threshold, receivers_list, compute_list, Zp, task_id, params) {
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
  dynamic_bits_sdiv: function (dependent_op, count, protocols, threshold, receivers_list, compute_list, Zp, task_id, params) {
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
    return function (dependent_op, count, protocols, threshold, receivers_list, compute_list, Zp, task_id, params) {
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
  dynamic_rejection_sampling: function (dependent_op, count, protocols, threshold, receivers_list, compute_list, Zp, task_id, params, task, jiff) {
    var previousPreprocessing = jiff.preprocessing_table[task.id];
    params.reject_count = params.reject_count == null ? -1 : params.reject_count;

    if (previousPreprocessing == null || previousPreprocessing === 'RETRY' || (previousPreprocessing[0] != null && previousPreprocessing[0].value === 'RETRY')) {
      if (!params.defaultBounds && (params.lower_bound == null || params.upper_bound == null)) {
        jiff.store_preprocessing(task.id, {ondemand: true});
        return [];
      }

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

    if (previousPreprocessing[0] != null && previousPreprocessing[0].value === 'PLACEHOLDER') {
      delete jiff.preprocessing_table[task.id];
    }

    return [];
  },
  // random quotients for cdiv
  dynamic_random_and_quotient: function (dependent_op, count, protocols, threshold, receivers_list, compute_list, Zp, task_id, params, task, jiff) {
    var constantNotProvided = (params.constant == null);
    receivers_list = constantNotProvided ? compute_list : receivers_list;
    Zp = Zp ? Zp : jiff.Zp;

    var newParams = {compute_threshold: params.compute_threshold};
    if (params.compute_threshold == null) { // honest majority BGW
      newParams.compute_threshold = Math.floor((compute_list.length + 1) / 2);
    }
    threshold = newParams.compute_threshold;

    var dependent_ops = [
      {op: 'bits.cgteq', op_id: ':bits_cgteq', receivers_list: receivers_list, threshold: threshold, params: newParams},
      {op: 'if_else', op_id: ':ifelse1', receivers_list: receivers_list, threshold: threshold, params: newParams},
      {op: 'if_else', op_id: ':ifelse2', receivers_list: receivers_list, threshold: threshold, params: newParams},
      {op: 'rejection_sampling', op_id: ':rejection1', receivers_list: receivers_list, threshold: threshold, params: {lower_bound: 0, upper_bound: Zp, compute_threshold: threshold}}
    ];

    if (constantNotProvided) {
      jiff.store_preprocessing(task_id, {ondemand: true});
      return dependent_ops;
    }

    // we want to sample uniformly in [0, largest multiple of constant <= Zp) and [0, constant)
    var largestQuotient = jiff.share_helpers['floor'](jiff.share_helpers['/'](Zp, params.constant));

    dependent_ops.push(
      {op: 'rejection_sampling', op_id: ':rejection2', threshold: threshold, params: {lower_bound: 0, upper_bound: largestQuotient, compute_threshold: threshold}},
      {op: 'rejection_sampling', op_id: ':rejection3', threshold: threshold, params: {lower_bound: 0, upper_bound: params.constant, compute_threshold: threshold}},
      {op: 'generate_random_and_quotient', op_id: '', requires: [0, 1, 2, 3, 4, 5], params: newParams}
    );

    return dependent_ops;
  },
  // fast exponentiation
  dynamic_fast_exponentiation: function (dependent_op, count, protocols, threshold, receivers_list, compute_list, Zp, task_id, params, task, jiff) {
    Zp = Zp ? Zp : jiff.Zp;
    var constantNotProvided = params.constant == null;
    var constant = params.constant;
    var constantBits = params.constantBits == null ? Zp.toString(2).length : params.constantBits;

    // special case
    if (!constantNotProvided && constant.toString() === '0') {
      return [];
    }

    var ops = [];
    if (constantNotProvided) {
      for (var i = 0; i < constantBits-1; i++) {
        ops.push({op: 'smult', op_id: ':smult0:' + i});
        ops.push({op: 'smult', op_id: ':smult1:' + i});
      }
      ops.push({op: 'smult', op_id: ':smult0:' + i});
      return ops;
    }

    // handle big number
    if (jiff.helpers.BigNumber) {
      constant = jiff.helpers.BigNumber(constant);
    }

    // preprocess for exactly the needed amount of multiplications
    for (i = 0; jiff.share_helpers['<'](1, constant); i++) {
      ops.push({op: 'smult', op_id: ':smult0:' + i});
      if (!jiff.share_helpers['even'](constant)) {
        ops.push({op: 'smult', op_id: ':smult1:' + i});
      }
      constant = jiff.share_helpers['floor'](jiff.share_helpers['/'](constant, 2));
    }
    ops.push({op: 'smult', op_id: ':smult0:' + i});
    return ops;
  },
  // for various equality tests, preprocess of cpow(Zp - 1) (Fermat's little theorem)
  handler_cpow_Zp_minus_1: function (threshold, receivers_list, compute_list, Zp, op_id, params, task, jiff) {
    Zp = Zp ? Zp : jiff.Zp;
    params.constant = jiff.share_helpers['-'](Zp, 1);
    return params;
  }
};