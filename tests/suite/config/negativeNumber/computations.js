// How to interpret non-MPC operations
var bigNumberOpenOps = {
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
  }
};

var _mpcOps = {
  '+': function (operand1, operand2) {
    return operand1.add(operand2);
  },
  '-': function (operand1, operand2) {
    return operand1.sub(operand2);
  },
  '*': function (operand1, operand2) {
    return operand1.mult(operand2);
  },
  '*bgw': function (operand1, operand2) {
    return operand1.smult_bgw(operand2);
  },
  '^': function (operand1, operand2) {
    return operand1.xor_bit(operand2);
  },
  '|': function (operand1, operand2) {
    return operand1.or_bit(operand2);
  },
  '/': function (operand1, operand2) {
    return operand1.div(operand2);
  },
  '%' : function (operand1, operand2) {
    return operand1.smod(operand2);
  },
  '<': function (operand1, operand2) {
    return operand1.lt(operand2);
  },
  '<=': function (operand1, operand2) {
    return operand1.lteq(operand2);
  },
  '>': function (operand1, operand2) {
    return operand1.gt(operand2);
  },
  '>=': function (operand1, operand2) {
    return operand1.gteq(operand2);
  },
  '==': function (operand1, operand2) {
    return operand1.eq(operand2);
  },
  '!=': function (operand1, operand2) {
    return operand1.neq(operand2);
  }
};

var baseComputations = require('../../computations.js');

// Default Computation Scheme
exports.compute = function (jiff_instance, _test, _inputs, _testParallel, _done) {
  return baseComputations.compute(jiff_instance, _test, _inputs, _testParallel, _done, null, bigNumberOpenOps, null);
};