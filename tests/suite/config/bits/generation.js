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

module.exports = baseGeneration;