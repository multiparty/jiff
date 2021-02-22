exports.generateUniform = function (test, options, max) {
  return Math.floor(Math.random() * max);
};
exports.generateNonZeroUniform = function (test, options, max) {
  return Math.floor(Math.random() * (max - 1)) + 1;
};
exports.generateBit = function (/*test, options*/) {
  return Math.random() < 0.5 ? 0 : 1;
};
exports.generateMultiple = function (test, options, max, factor) {
  var coef = exports.generateUniform(test, options, Math.floor(max / factor));
  return coef * factor;
};
exports.generateDividend = function (test, options, max, divisor) {
  return exports.generateUniform(test, options, max);
};
exports.generateUniformNatural = function (test, options, max) {
  return Math.floor(Math.random() * max);
};

// Generation API referred to from configuration JSON files

// Sharing/Opening test cases with no operations
exports.generateShareInputs = function (test, count, options) {
  var all_parties = [];
  for (var k = 1; k <= options.party_count; k++) {
    all_parties.push(k);
  }

  var inputs = [];
  // Generate test cases one at a time
  // A test case consists of
  // 1) input numbers
  // 2) sharing threshold
  // 3) array of senders
  // 4) array of receivers
  //
  // Variants of this are reshare tests that test the resharing of an existing share with a different set of parties
  // and threshold. For this variant, the tests will additionally generate:
  // 5) reshare_threshold: new/reshare threshold
  // 6) reshare_holders: new/reshare holder parties

  var max = options.max || options.Zp;
  for (var t = 0; t < count; t++) {
    var oneTest = { numbers: {} };
    // Generate numbers
    for (var p = 1; p <= options.party_count; p++) {
      oneTest['numbers'][p] = exports.generateUniform(test, options, max);
    }
    // 1 <= Threshold <= party_count
    oneTest['threshold'] = Math.floor(Math.random() * options.party_count) + 1;

    // Generate senders/receivers
    var sn = Math.ceil(Math.random() * options.party_count); // At least one sender, at most all.
    var rn = oneTest['threshold'] + Math.floor(Math.random() * (options.party_count - oneTest['threshold'] + 1)); // At least as many receivers as threshold.

    // Generate actual receivers and senders arrays
    var senders = all_parties.slice();
    var receivers = all_parties.slice();

    // remove random parties until proper counts are reached.
    while (senders.length > sn) {
      senders.splice(Math.floor(Math.random() * senders.length), 1);
    }
    while (receivers.length > rn) {
      receivers.splice(Math.floor(Math.random() * receivers.length), 1);
    }
    senders.sort();
    receivers.sort();

    oneTest['senders'] = senders;
    oneTest['receivers'] = receivers;

    // reshare variant: only different threshold
    if (test.startsWith('reshare-threshold')) {
      oneTest['reshare_holders'] = receivers.slice();
      oneTest['reshare_threshold'] = Math.floor(Math.random() * receivers.length) + 1; // 1 <= reshare_threshold <= length of receivers
    }
    // reshare variant: both different threshold and parties
    if (test.startsWith('reshare-parties')) {
      var hn = Math.floor(Math.random() * (all_parties.length - 1)) + 1; // 1 <= hn <= party_count
      var reshare_holders = all_parties.slice();
      while (reshare_holders.length > hn) {
        reshare_holders.splice(Math.floor(Math.random() * reshare_holders.length), 1);
      }
      reshare_holders.sort();

      oneTest['reshare_holders'] = reshare_holders;
      oneTest['reshare_threshold'] = Math.floor(Math.random() * reshare_holders.length) + 1; // 1 <= reshare_threshold <= length of holders
    }

    inputs.push(oneTest);
  }
  return inputs;
};

// Arithmetic inputs: one for each party except for / and % where only two inputs are needed.
// | and ^ requires bits, while thr denominator for / and % must be non-zero.
exports.generateArithmeticInputs = function (test, count, options) {
  var party_count = options.party_count;
  var max = options.max || options.Zp;

  var inputs = [];
  var t, p, oneInput;
  if (test.startsWith('/') || test === '%') {
    // division and mod: only two inputs, the second is non-zero.
    for (t = 0; t < count; t++) {
      oneInput = {};
      oneInput[2] = exports.generateNonZeroUniform(test, options, max);
      oneInput[1] = exports.generateDividend(test, options, max, oneInput[2]);
      inputs.push(oneInput);
    }
  } else if (test === '|' || test === '^') {
    // or and xor: inputs are binary
    for (t = 0; t < count; t++) {
      oneInput = {};
      for (p = 1; p <= party_count; p++) {
        oneInput[p] = exports.generateBit(test, options);
      }
      inputs.push(oneInput);
    }
  } else if (test === '!' || test === 'floor' || test === 'abs') {
    for (t = 0; t < count; t++) {
      oneInput = {};
      oneInput[1] = exports.generateBit(test, options);
      inputs.push(oneInput);
    }
    return inputs;
  } else {
    // otherwise no constraints
    for (t = 0; t < count; t++) {
      oneInput = {};
      for (p = 1; p <= party_count; p++) {
        oneInput[p] = exports.generateUniform(test, options, max);
      }
      inputs.push(oneInput);
    }
  }

  return inputs;
};

// Constant Arithmetic inputs: an input for the first party, and a constant input.
// | and ^ requires bits, while thr denominator for / and % must be non-zero.
exports.generateConstantArithmeticInputs = function (test, count, options) {
  var max = options.max || options.Zp;
  var cmax = options.cmax || max;

  var inputs = [];
  var t, oneInput;
  if (test.indexOf('/') > -1 || test.indexOf('%') > -1 || test === 'cdivfac') {
    // division and mod: only two inputs, the second is non-zero.
    for (t = 0; t < count; t++) {
      oneInput = {};
      oneInput['constant'] = exports.generateNonZeroUniform(test, options, cmax);
      if (test === 'cdivfac') {
        oneInput[1] = exports.generateMultiple(test, options, max, oneInput['constant']);
      } else {
        oneInput[1] = exports.generateDividend(test, options, max, oneInput['constant']);
      }

      inputs.push(oneInput);
    }
  } else if (test === '|' || test === '^') {
    // or and xor: inputs are binary
    for (t = 0; t < count; t++) {
      oneInput = {};
      oneInput[1] = exports.generateBit(test, options);
      oneInput['constant'] = exports.generateBit(test, options);
      inputs.push(oneInput);
    }
  } else if (test.startsWith('cpow')) {
    // power must be a non-negative integer
    for (t = 0; t < count; t++) {
      oneInput = {};
      oneInput[1] = exports.generateUniform(test, options, max);
      oneInput['constant'] = exports.generateUniformNatural(test, options, max);
      inputs.push(oneInput);
    }
  } else {
    // otherwise no constraints
    for (t = 0; t < count; t++) {
      oneInput = {};
      oneInput[1] = exports.generateUniform(test, options, max);
      oneInput['constant'] = exports.generateUniform(test, options, cmax);
      inputs.push(oneInput);
    }
  }

  return inputs;
};

// Comparison inputs: two inputs for the first two parties only
// if using random numbers and large Zp, inputs will be very unlikely to be equal
// we must make it likely for the inputs to be equal manually for == and != checks
exports.generateComparisonInputs = function (test, count, options) {
  var max = options.max || options.Zp;

  var inputs = [];
  // make it likely that the numbers are equal.
  for (var t = 0; t < count; t++) {
    var oneInput = {};
    oneInput[1] = exports.generateUniform(test, options, max);
    oneInput[2] = Math.random() < 0.5 ? oneInput[1] : exports.generateUniform(test, options, max);
    inputs.push(oneInput);
  }

  return inputs;
};

// Constant Comparison inputs: an input for the first party, and a constant input.
// if using random numbers and large Zp, inputs will be very unlikely to be equal
// we must make it likely for the inputs to be equal manually for == and != checks
exports.generateConstantComparisonInputs = function (test, count, options) {
  var max = options.max || options.Zp;
  var cmax = options.cmax || max;

  var inputs = [];
  // make it likely that the numbers are equal.
  for (var t = 0; t < count; t++) {
    var oneInput = {};
    oneInput[1] = exports.generateUniform(test, options, max);
    oneInput['constant'] = Math.random() < 0.5 ? oneInput[1] : exports.generateUniform(test, options, cmax);
    inputs.push(oneInput);
  }

  return inputs;
};

// If Else: generate random bit b and two random numbers x1, x2
// Return {1: b, 2: x1, 3: x3}
exports.generateIfElseInputs = function (test, count, options) {
  var max = options.max || options.Zp;
  var inputs = [];
  for (var t = 0; t < count; t++) {
    var oneInput = {};
    oneInput[1] = exports.generateBit(test, options);
    oneInput[2] = exports.generateUniform(test, options, max);
    oneInput[3] = exports.generateUniform(test, options, max);
    inputs.push(oneInput);
  }
  return inputs;
};