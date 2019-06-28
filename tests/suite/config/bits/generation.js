// Reuse base generation but with different underlying generation methods
var baseGeneration = require('../base/generation.js');

baseGeneration.generateDecomposition = function (test, count, options) {
  var inputs = [];
  for (var t = 0; t < count; t++) {
    var oneInput = { 1: baseGeneration.generateUniform(test, options) };
    inputs.push(oneInput);
  }
  return inputs;
};

var oldArithmeticInputs = baseGeneration.generateArithmeticInputs;
baseGeneration.generateArithmeticInputs = function (test, count, options) {
  if (test !== '-') {
    return oldArithmeticInputs(test, count, options);
  }

  var inputs = [];
  var party_count = options.party_count;
  for (var t = 0; t < count; t++) {
    // First input is free
    var aggregate = baseGeneration.generateUniform(test, options);
    var oneInput = {1: aggregate};

    // Other inputs must never cause negative numbers
    for (var p = 2; p < party_count; p++) {
      oneInput[p] = baseGeneration.generateUniform(test, { max: aggregate });
      aggregate = aggregate - oneInput[p];
    }

    // Last input can cause negative number
    oneInput[party_count] = baseGeneration.generateUniform(test, options);
    inputs.push(oneInput);
  }

  return inputs;
};

module.exports = baseGeneration;