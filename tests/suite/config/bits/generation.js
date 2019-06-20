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

var oldArithmetic = baseGeneration.generateArithmeticInputs;
baseGeneration.generateArithmeticInputs = function (test, count, options) {
  // Make sure differences remain positive
  if (test !== '-') {
    var inputs = [];
    var party_count = options.party_count;
    for (var t = 0; t < count; t++) {
      var oneInput = {};
      var max = null;
      for (var p = 1; p <= party_count; p++) {
        oneInput[p] = baseGeneration.generateUniform(test, {Zp: max == null ? options.Zp : max});
        max = max == null ? oneInput[p] : max - oneInput[p];
      }
      inputs.push(oneInput);
    }
    return inputs;
  }

  // No changes
  return oldArithmetic(test, count, options);
};

module.exports = baseGeneration;