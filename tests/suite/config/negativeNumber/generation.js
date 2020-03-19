// Reuse base generation but with different underlying generation methods
var baseGeneration = require('../base/generation.js');

// functions specific to negativeNumber
var isConstant;
function determineMax(test, party_count, Zp, max) {
  max = Math.min(Math.floor(Zp/2), max);
  // +: max + max ... + max = party_count * max <= 10^(digits)
  if (test === '+' || test === '-') {
    max = Math.floor(max / party_count);
  }

  // *: max * max * ... * max = max^(party_count) <= Zp/2
  if (test === '*' || test === '*bgw') {
    var operation_count = isConstant ? 2 : party_count;
    max = Math.floor(Math.pow(max, 1 / operation_count));
  }

  return max;
}

//Override
baseGeneration.generateUniform = function (test, options, max) {
  max = determineMax(test, options.party_count, options.Zp, max);
  var nat = Math.floor(Math.random() * max);
  return Math.random() < 0.5 ? nat : -1 * nat;
};
baseGeneration.generateNonZeroUniform = function (test, options, max) {
  max = determineMax(test, options.party_count, options.Zp, max);
  var nat = Math.floor(Math.random() * (max - 1) + 1);
  return Math.random() < 0.5 ? nat : -1 * nat;
};
baseGeneration.generateMultiple = function (test, options, max, factor) {
  max = determineMax(test, options.party_count, options.Zp, max);
  max = Math.floor(max / Math.abs(factor));

  var nat = Math.floor(Math.random() * max);
  return factor * (Math.random() < 0.5 ? nat : -1 * nat);
};
baseGeneration.generateUniformNatural = function (test, options, max) {
  return Math.floor(Math.random() * max);
};


// Override entry points
var oldArithmetic = baseGeneration.generateArithmeticInputs;
var oldConstantArithmetic = baseGeneration.generateConstantArithmeticInputs;
var oldComparison = baseGeneration.generateComparisonInputs;
var oldConstantComparison = baseGeneration.generateConstantComparisonInputs;

baseGeneration.generateArithmeticInputs = function (test, count, options) {
  isConstant = false;
  return oldArithmetic(test, count, options);
};

baseGeneration.generateConstantArithmeticInputs = function (test, count, options) {
  isConstant = true;
  return oldConstantArithmetic(test, count, options);
};

baseGeneration.generateComparisonInputs = function (test, count, options) {
  isConstant = false;
  return oldComparison(test, count, options);
};

baseGeneration.generateConstantComparisonInputs = function (test, count, options) {
  isConstant = true;
  return oldConstantComparison(test, count, options);
};

module.exports = baseGeneration;
