// BigNumber Library
var BigNumber = require('bignumber.js');

// Reuse base generation but with different underlying generation methods
var baseGeneration = require('../base/generation.js');

// Override
baseGeneration.generateUniform = function (test, options, max) {
  max = new BigNumber(max);
  return BigNumber.random().times(max).floor();
};
baseGeneration.generateNonZeroUniform = function (test, options, max) {
  max = new BigNumber(max);
  return BigNumber.random().times(max.minus(1)).plus(1).floor();
};
baseGeneration.generateBit = function () {
  return Math.random() < 0.5 ? new BigNumber(0) : new BigNumber(1);
};
baseGeneration.generateMultiple = function (test, options, max, factor) {
  max = new BigNumber(max);
  var coef = baseGeneration.generateUniform(test, options, max.div(factor).floor());
  return coef.times(factor);
};
baseGeneration.generateUniformNatural = function (test, options, max) {
  max = new BigNumber(max);
  return BigNumber.random().times(max).floor();
};

module.exports = baseGeneration;