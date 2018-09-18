var BigNumber = require('bignumber.js');
BigNumber.config({ DECIMAL_PLACES: 131 });

var decimal_digits;
function fix(num) {
  var str = num.toFixed(decimal_digits, BigNumber.ROUND_FLOOR);
  return new BigNumber(str);
}

// How to interpret non-MPC operations
var bigNumberOpenOps = {
  '+': function (operand1, operand2) {
    return operand1.plus(operand2);
  },
  '-': function (operand1, operand2) {
    return operand1.minus(operand2);
  },
  '*': function (operand1, operand2) {
    return fix(operand1.times(operand2));
  },
  '*bgw': function (operand1, operand2) {
    return fix(operand1.times(operand2));
  },
  '^': function (operand1, operand2) {
    return new BigNumber(Number(!operand1.eq(operand2)));
  },
  '|': function (operand1, operand2) {
    return new BigNumber(Number(operand1.plus(operand2).gte(1)));
  },
  '/': function (operand1, operand2) {
    return fix(operand1.div(operand2));
  },
  '%' : function (operand1, operand2) {
    var r = operand1.div(operand2).floor();
    return fix(operand1.minus(operand2.times(r)));
  },
  '<': function (operand1, operand2) {
    return new BigNumber(Number(operand1.lt(operand2)));
  },
  '<=': function (operand1, operand2) {
    return new BigNumber(Number(operand1.lte(operand2)));
  },
  '>': function (operand1, operand2) {
    return new BigNumber(Number(operand1.gt(operand2)));
  },
  '>=': function (operand1, operand2) {
    return new BigNumber(Number(operand1.gte(operand2)));
  },
  '==': function (operand1, operand2) {
    return new BigNumber(Number(operand1.eq(operand2)));
  },
  '!=': function (operand1, operand2) {
    return new BigNumber(Number(!operand1.eq(operand2)));
  }
};

var baseComputations = require('../../computations.js');

// Default Computation Scheme
exports.compute = function (jiff_instance, _test, _inputs, _testParallel, _done) {
  decimal_digits = jiff_instance.decimal_digits;
  return baseComputations.compute(jiff_instance, _test, _inputs, _testParallel, _done, null, bigNumberOpenOps);
};