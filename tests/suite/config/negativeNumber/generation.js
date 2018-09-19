// functions specific to fixedpoint
var isConstant;
function determineMax(test, party_count, Zp) {
  var max = Math.floor(Zp/2);
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

// helpers: organized like this to make it easy for extension generation to override functionality.
var _helpers = {};
_helpers.generateUniform = function (test, options) {
  var max = determineMax(test, options.party_count, options.Zp);
  var nat = Math.floor(Math.random() * max);
  return Math.random() < 0.5 ? nat : -1 * nat;
};
_helpers.generateNonZeroUniform = function (test, options) {
  var max = determineMax(test, options.party_count, options.Zp);
  var nat = Math.floor(Math.random() * (max - 1) + 1);
  return Math.random() < 0.5 ? nat : -1 * nat;
};
_helpers.generateBit = function (test, options) {
  var num = Math.random() < 0.5 ? 0 : 1;
  return num;
};

// Reuse base generation but with different helpers
var baseGeneration = require('../base/generation.js');

exports.generateArithmeticInputs = function (test, count, options) {
  isConstant = false;
  return baseGeneration.generateArithmeticInputs(test, count, options, _helpers);
};

exports.generateConstantArithmeticInputs = function (test, count, options) {
  isConstant = true;
  return baseGeneration.generateConstantArithmeticInputs(test, count, options, _helpers);
};

exports.generateComparisonInputs = function (test, count, options) {
  isConstant = false;
  return baseGeneration.generateComparisonInputs(test, count, options, _helpers);
};

exports.generateConstantComparisonInputs = function (test, count, options) {
  isConstant = true;
  return baseGeneration.generateConstantComparisonInputs(test, count, options, _helpers);
};