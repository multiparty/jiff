// BigNumber Library
var BigNumber = require('bignumber.js');
BigNumber.config({ DECIMAL_PLACES: 131 });

// Reuse base generation but with different underlying generation methods
var baseGeneration = require('../base/generation.js');

// functions specific to fixedpoint
var isConstant;
function determineMax(test, party_count, integer_digits, decimal_digits) {
  var max = new BigNumber(10).pow(integer_digits + decimal_digits);
  var operation_count = isConstant ? 2 : party_count;

  // +: max + max ... + max = party_count * max <= 10^(digits)
  if (test === '+' || test === '-') {
    max = max.div(operation_count).floor();
  }

  // *: max * max * ... * max = max^(party_count) <= 10^(digits)
  // => max <= 10^(digits)^(1/party_count) = 10^(digits/party_count)
  // Note that for constant *, we only perform a single multiplication in the test
  if (test === '*' || test === '*bgw') {
    var pow = Math.floor((integer_digits + decimal_digits) / operation_count);
    max = new BigNumber(10).pow(pow);
  }
  return max;
}

// Override
baseGeneration.generateUniform = function (test, options) {
  var max = determineMax(test, options.party_count, options.integer_digits, options.decimal_digits);
  var wholeNum = BigNumber.random().times(max).floor();
  var deciNum = wholeNum.div(new BigNumber(10).pow(options.decimal_digits));
  return Math.random() < 0.5 ? deciNum : deciNum.times(-1);
};
baseGeneration.generateNonZeroUniform = function (test, options) {
  var max = determineMax(test, options.party_count, options.integer_digits, options.decimal_digits);
  var wholeNum = BigNumber.random().times(max.minus(1)).plus(1).floor();
  var deciNum = wholeNum.div(new BigNumber(10).pow(options.decimal_digits));
  return Math.random() < 0.5 ? deciNum : deciNum.times(-1);
};
baseGeneration.generateBit = function (test, options) {
  return Math.random() < 0.5 ? new BigNumber(0) : new BigNumber(1);
};
baseGeneration.generateMultiple = function (test, options, factor) {
  var max = determineMax(test, options.party_count, options.integer_digits, 0);
  var nmax = max.div(factor).abs().floor();
  max = nmax.gt(max) ? max : nmax;
  var nat = BigNumber.random().times(max).floor();
  var coef = Math.random() < 0.5 ? nat : nat.times(-1);
  return coef.times(factor);
};
baseGeneration.generateDividend = function (test, options, divisor) {
  var max1 = determineMax(test, options.party_count, options.integer_digits, options.decimal_digits);
  var max2 = new BigNumber(10).pow(options.integer_digits).times(divisor).times(new BigNumber(10).pow(options.decimal_digits)).floor();
  var max = max1.lt(max2) ? max1 : max2;
  var wholeNum = BigNumber.random().times(max).floor();
  var deciNum = wholeNum.div(new BigNumber(10).pow(options.decimal_digits));
  return Math.random() < 0.5 ? deciNum : deciNum.times(-1);
};

exports.generateArithmeticInputs = function (test, count, options) {
  isConstant = false;
  if (test === 'floor' || test === 'abs') {
    var inputs = [];
    for (var t = 0; t < count; t++) {
      var oneInput = {};
      oneInput[1] = baseGeneration.generateUniform(test, options);
      inputs.push(oneInput);
    }
    return inputs;
  }
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