// BigNumber Library
var BigNumber = require('bignumber.js');

// helpers: organized like this to make it easy for extension generation to override functionality.
var _helpers = {};
_helpers.generateUniform = function (test, options) {
  var Zp = new BigNumber(options.Zp);
  return BigNumber.random().times(Zp).floor();
};
_helpers.generateNonZeroUniform = function (test, options) {
  var Zp = new BigNumber(options.Zp);
  return BigNumber.random().times(Zp.minus(1)).plus(1).floor();
};
_helpers.generateBit = function (test, options) {
  return Math.random() < 0.5 ? new BigNumber(0) : new BigNumber(1);
};

// Reuse base generation but with different helpers
var baseGeneration = require('../base/generation.js');

exports.generateArithmeticInputs = function (test, count, options) {
  return baseGeneration.generateArithmeticInputs(test, count, options, _helpers);
};

exports.generateConstantArithmeticInputs = function (test, count, options) {
  return baseGeneration.generateConstantArithmeticInputs(test, count, options, _helpers);
};

exports.generateComparisonInputs = function (test, count, options) {
  return baseGeneration.generateComparisonInputs(test, count, options, _helpers);
};

exports.generateConstantComparisonInputs = function (test, count, options) {
  return baseGeneration.generateConstantComparisonInputs(test, count, options, _helpers);
};