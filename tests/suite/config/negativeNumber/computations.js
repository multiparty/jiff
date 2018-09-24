// Override with different interpreters
var baseComputations = require('../../computations.js');

// How to interpret non-MPC operations
baseComputations.openInterpreter = {
  '+': function (operand1, operand2) {
    return operand1 + operand2;
  },
  '-': function (operand1, operand2) {
    return operand1 - operand2;
  },
  '*': function (operand1, operand2) {
    return operand1 * operand2;
  },
  '*bgw': function (operand1, operand2) {
    return operand1 * operand2;
  },
  '^': function (operand1, operand2) {
    return operand1 ^ operand2;
  },
  '|': function (operand1, operand2) {
    return operand1 | operand2;
  },
  '/': function (operand1, operand2) {
    return Math.floor(operand1 / operand2);
  },
  '%' : function (operand1, operand2) {
    return operand1 % operand2;
  },
  '<': function (operand1, operand2) {
    return Number(operand1 < operand2);
  },
  '<=': function (operand1, operand2) {
    return Number(operand1 <= operand2);
  },
  '>': function (operand1, operand2) {
    return Number(operand1 > operand2);
  },
  '>=': function (operand1, operand2) {
    return Number(operand1 >= operand2);
  },
  '==': function (operand1, operand2) {
    return Number(operand1 === operand2);
  },
  '!=': function (operand1, operand2) {
    return Number(operand1 !== operand2);
  },
  '!' : function (operand1, _) {
    return (operand1 + 1) % 2;
  }
};

// Default Computation Scheme
exports.compute = function (jiff_instance, _test, _inputs, _testParallel, _done) {
  return baseComputations.compute(jiff_instance, _test, _inputs, _testParallel, _done);
};