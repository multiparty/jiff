var BigNumber = require('bignumber.js');

// Reuse base generation but with different underlying generation methods
var baseGeneration = require('../base/generation.js');

// functions specific to fixedpoint
var isConstant;
function determineMax(test, party_count, Zp) {
  var max = BigNumber(Zp).div(2).floor();
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
baseGeneration.generateUniform = function (test, options) {
  var max = determineMax(test, options.party_count, options.Zp);
  var nat = BigNumber.random().times(max).floor();
  return Math.random() < 0.5 ? nat : nat.times(-1);
};
baseGeneration.generateNonZeroUniform = function (test, options) {
  var max = determineMax(test, options.party_count, options.Zp);
  var nat = BigNumber.random().times(max.minus(1)).plus(1).floor();
  return Math.random() < 0.5 ? nat : nat.times(-1);
};
baseGeneration.generateBit = function (test, options) {
  var num = Math.random() < 0.5 ? new BigNumber(0) : new BigNumber(1);
  return num;
};
baseGeneration.generateMultiple = function (test, options, factor) {
  var Zp = new BigNumber(options.Zp);
  var coef = baseGeneration.generateUniform(test, { Zp: Zp.div(factor).floor() });
  return coef.times(factor);
};

exports.generateArithmeticInputs = function (test, count, options) {
  isConstant = false;
  return baseGeneration.generateArithmeticInputs(test, count, options);
};

exports.generateConstantArithmeticInputs = function (test, count, options) {
  isConstant = true;
  return baseGeneration.generateConstantArithmeticInputs(test, count, options);
};

exports.generateComparisonInputs = function (test, count, options) {
  isConstant = false;
  return baseGeneration.generateComparisonInputs(test, count, options);
};

exports.generateConstantComparisonInputs = function (test, count, options) {
  isConstant = true;
  return baseGeneration.generateConstantComparisonInputs(test, count, options);
};