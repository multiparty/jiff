// BigNumber Library
var BigNumber = require('bignumber.js');
BigNumber.config({ DECIMAL_PLACES: 131 });

// Reuse base generation but with different underlying generation methods
var baseGeneration = require('../base/generation.js');

// functions specific to fixedpoint
var isConstant;
var genMem = [];
function determineMax(test, party_count, integer_digits, decimal_digits, max) {
  // use minimum between max and integer/decimal digits capacity
  max = new BigNumber(max).times(new BigNumber(10).pow(decimal_digits));
  var max2 = new BigNumber(10).pow(integer_digits + decimal_digits);
  max = max.lt(max2) ? max : max2;

  var operation_count = isConstant ? 2 : party_count;
  // +: max + max ... + max = party_count * max <= 10^(digits)
  if (test === '+') {
    max = max.div(operation_count).floor();
  }

  // -: harder, first party's input can be as large as fits, the sum of the other party's input must be
  // less than or equal to the first, to avoid negative numbers
  if (test === '-') {
    if (genMem.length > 0) {
      max = genMem[0];
      for (var i = 1; i < genMem.length; i++) {
        max = max.minus(genMem[i]);
      }
    }
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

function pushToMem(party_count, num) {
  genMem.push(num);
  if ((isConstant && genMem.length === 2) || genMem.length === party_count) {
    genMem = [];
  }
}

// Override generation
baseGeneration.generateUniform = function (test, options, max) {
  max = determineMax(test, options.party_count, options.integer_digits, options.decimal_digits, max);
  var wholeNum = BigNumber.random().times(max).floor();
  pushToMem(options.party_count, wholeNum);
  return wholeNum.div(new BigNumber(10).pow(options.decimal_digits));
};
baseGeneration.generateNonZeroUniform = function (test, options, max) {
  max = determineMax(test, options.party_count, options.integer_digits, options.decimal_digits, max);
  var wholeNum = BigNumber.random().times(max.minus(1)).plus(1).floor();
  pushToMem(options.party_count, wholeNum);
  return wholeNum.div(new BigNumber(10).pow(options.decimal_digits));
};
baseGeneration.generateBit = function (test, options) {
  var num = Math.random() < 0.5 ? new BigNumber(0) : new BigNumber(1);
  pushToMem(options.party_count, num);
  return num;
};
baseGeneration.generateMultiple = function (test, options, max, factor) {
  max = determineMax(test, options.party_count, options.integer_digits, 0, max);
  var nmax = max.div(factor).abs().floor();
  max = nmax.gt(max) ? max : nmax;
  var coef = BigNumber.random().times(max).floor();
  return coef.times(factor);
};
baseGeneration.generateDividend = function (test, options, max, divisor) {
  var max1 = determineMax(test, options.party_count, options.integer_digits, options.decimal_digits, max);
  var max2 = new BigNumber(10).pow(options.integer_digits + options.decimal_digits).times(divisor).floor();
  max = max1.lt(max2) ? max1 : max2;
  var wholeNum = BigNumber.random().times(max).floor();
  return wholeNum.div(new BigNumber(10).pow(options.decimal_digits));
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
  genMem = [];
  isConstant = false;
  return oldArithmetic(test, count, options);
};

baseGeneration.generateConstantArithmeticInputs = function (test, count, options) {
  genMem = [];
  isConstant = true;
  return oldConstantArithmetic(test, count, options);
};

baseGeneration.generateComparisonInputs = function (test, count, options) {
  genMem = [];
  isConstant = false;
  return oldComparison(test, count, options);
};

baseGeneration.generateConstantComparisonInputs = function (test, count, options) {
  genMem = [];
  isConstant = true;
  return oldConstantComparison(test, count, options);
};

module.exports = baseGeneration;
