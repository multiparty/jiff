var BigNumber = require('bignumber.js');

// Reuse base generation but with different underlying generation methods
var baseGeneration = require('../base/generation.js');

// functions specific to negative number
var isConstant;
function determineMax(test, party_count, Zp, max) {
  var maxZp = BigNumber(Zp).div(2).floor();
  max = BigNumber(max);
  max = max.lt(maxZp) ? max : maxZp;

  var operation_count = isConstant ? 2 : party_count;

  // +: max + max ... + max = party_count * max <= 10^(digits)
  if (test === '+' || test === '-') {
    max = max.div(operation_count).floor();
  }

  // *: max * max * ... * max = max^(party_count) <= Zp/2
  // max <= 2^(log_2(Zp/2)/party_count)   [all floored]
  if (test === '*' || test === '*bgw') {
    var log2 = max.toString(2).length - 1;
    var pow = Math.floor(log2 / operation_count);
    max = new BigNumber(2).pow(pow);
  }

  return max;
}

// Override
baseGeneration.generateUniform = function (test, options, max) {
  max = determineMax(test, options.party_count, options.Zp, max);
  var nat = BigNumber.random().times(max).floor();
  return Math.random() < 0.5 ? nat : nat.times(-1);
};
baseGeneration.generateNonZeroUniform = function (test, options, max) {
  max = determineMax(test, options.party_count, options.Zp, max);
  var nat = BigNumber.random().times(max.minus(1)).plus(1).floor();
  return Math.random() < 0.5 ? nat : nat.times(-1);
};
baseGeneration.generateBit = function () {
  var num = Math.random() < 0.5 ? new BigNumber(0) : new BigNumber(1);
  return num;
};
baseGeneration.generateMultiple = function (test, options, max, factor) {
  max = determineMax(test, options.party_count, options.Zp, max);
  max = max.div(factor).abs().floor();
  var nat = BigNumber.random().times(max).floor();
  var coef = Math.random() < 0.5 ? nat : nat.times(-1);
  return coef.times(factor);
};
baseGeneration.generateUniformNatural = function (test, options, max) {
  max = new BigNumber(max);
  return BigNumber.random().times(max).floor();
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
