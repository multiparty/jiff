// helpers: organized like this to make it easy for extension generation to override functionality.
var _helpers = {};
_helpers.generateUniform = function (test, options) {
  return Math.floor(Math.random() * options.Zp);
};
_helpers.generateNonZeroUniform = function (test, options) {
  return Math.floor(Math.random() * (options.Zp - 1)) + 1;
};
_helpers.generateBit = function (test, options) {
  return Math.random() < 0.5 ? 0 : 1;
};

// Generation API referred to from configuration JSON files

// Arithmetic inputs: one for each party except for / and % where only two inputs are needed.
// | and ^ requires bits, while thr denominator for / and % must be non-zero.
exports.generateArithmeticInputs = function (test, count, options, helpers) {
  if (helpers == null) {
    helpers = _helpers;
  }

  var party_count = options.party_count;
  var inputs = [];
  var t, p, oneInput;
  if (test.startsWith('/') || test === '%') {
    // division and mod: only two inputs, the second is non-zero.
    for (t = 0; t < count; t++) {
      oneInput = {};
      oneInput[1] = helpers.generateUniform(test, options);
      oneInput[2] = helpers.generateNonZeroUniform(test, options);
      inputs.push(oneInput);
    }
  } else if (test === '|' || test === '^') {
    // or and xor: inputs are binary
    for (t = 0; t < count; t++) {
      oneInput = {};
      for (p = 1; p <= party_count; p++) {
        oneInput[p] = helpers.generateBit(test, options);
      }
      inputs.push(oneInput);
    }
  } else {
    // otherwise no constraints
    for (t = 0; t < count; t++) {
      oneInput = {};
      for (p = 1; p <= party_count; p++) {
        oneInput[p] = helpers.generateUniform(test, options);
      }
      inputs.push(oneInput);
    }
  }

  return inputs;
};

// Constant Arithmetic inputs: an input for the first party, and a constant input.
// | and ^ requires bits, while thr denominator for / and % must be non-zero.
exports.generateConstantArithmeticInputs = function (test, count, options, helpers) {
  if (helpers == null) {
    helpers = _helpers;
  }

  var inputs = [];
  var t, oneInput;
  if (test === '/' || test === '%') {
    // division and mod: only two inputs, the second is non-zero.
    for (t = 0; t < count; t++) {
      oneInput = {};
      oneInput[1] = helpers.generateUniform(test, options);
      oneInput['constant'] = helpers.generateNonZeroUniform(test, options);
      inputs.push(oneInput);
    }
  } else if (test === '|' || test === '^') {
    // or and xor: inputs are binary
    for (t = 0; t < count; t++) {
      oneInput = {};
      oneInput[1] = helpers.generateBit(test, options);
      oneInput['constant'] = helpers.generateBit(test, options);
      inputs.push(oneInput);
    }
  } else {
    // otherwise no constraints
    for (t = 0; t < count; t++) {
      oneInput = {};
      oneInput[1] = helpers.generateUniform(test, options);
      oneInput['constant'] = helpers.generateUniform(test, options);
      inputs.push(oneInput);
    }
  }

  return inputs;
};

// Constant Comparison inputs: two inputs for the first two parties only
// if using random numbers and large Zp, inputs will be very unlikely to be equal
// we must make it likely for the inputs to be equal manually for == and != checks
exports.generateComparisonInputs = function (test, count, options, helpers) {
  if (helpers == null) {
    helpers = _helpers;
  }

  var inputs = [];
  var t, oneInput;
  if (test === '==' || test === '!=' || test === '<=' || test === '>=') {
    // equality checks: make it likely that the numbers are equal.
    for (t = 0; t < count; t++) {
      oneInput = {};
      oneInput[1] = helpers.generateUniform(test, options);
      oneInput[2] = Math.random() < 0.5 ? oneInput[1] : helpers.generateUniform(test, options);
      inputs.push(oneInput);
    }
  } else {
    // otherwise no constraints
    for (t = 0; t < count; t++) {
      oneInput = {};
      oneInput[1] = helpers.generateUniform(test, options);
      oneInput[2] = helpers.generateUniform(test, options);
      inputs.push(oneInput);
    }
  }

  return inputs;
};

// Constant Comparison inputs: an input for the first party, and a constant input.
// if using random numbers and large Zp, inputs will be very unlikely to be equal
// we must make it likely for the inputs to be equal manually for == and != checks
exports.generateConstantComparisonInputs = function (test, count, options, helpers) {
  if (helpers == null) {
    helpers = _helpers;
  }

  var inputs = [];
  var t, oneInput;
  if (test === '==' || test === '!=' || test === '<=' || test === '>=') {
    // equality checks: make it likely that the numbers are equal.
    for (t = 0; t < count; t++) {
      oneInput = {};
      oneInput[1] = helpers.generateUniform(test, options);
      oneInput['constant'] = Math.random() < 0.5 ? oneInput[1] : helpers.generateUniform(test, options);
      inputs.push(oneInput);
    }
  } else {
    // otherwise no constraints
    for (t = 0; t < count; t++) {
      oneInput = {};
      oneInput[1] = helpers.generateUniform(test, options);
      oneInput['constant'] = helpers.generateUniform(test, options);
      inputs.push(oneInput);
    }
  }

  return inputs;
};
