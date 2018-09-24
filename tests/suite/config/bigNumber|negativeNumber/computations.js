// Use base computation but override interpreters.
var baseComputations = require('../../computations.js');

var BigNumber = require('bignumber.js');

// How to interpret non-MPC operations
baseComputations.openInterpreter = {
  '+': function (operand1, operand2) {
    return operand1.plus(operand2);
  },
  '-': function (operand1, operand2) {
    return operand1.minus(operand2);
  },
  '*': function (operand1, operand2) {
    return operand1.times(operand2);
  },
  '*bgw': function (operand1, operand2) {
    return operand1.times(operand2);
  },
  '^': function (operand1, operand2) {
    return new BigNumber(Number(!operand1.eq(operand2)));
  },
  '|': function (operand1, operand2) {
    return new BigNumber(Number(operand1.plus(operand2).gte(1)));
  },
  '/': function (operand1, operand2) {
    return operand1.div(operand2).floor();
  },
  '%' : function (operand1, operand2) {
    return operand1.mod(operand2);
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

// Default Computation Scheme
exports.compute = function (jiff_instance, _test, _inputs, _testParallel, _done) {
  return baseComputations.compute(jiff_instance, _test, _inputs, _testParallel, _done);
};