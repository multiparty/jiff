// Use base computation but override interpreters.
var baseComputations = require('../../computations.js');

var BigNumber = require('bignumber.js');

// How to interpret non-MPC operations
baseComputations.openInterpreter['+'] = function (operand1, operand2) {
  return operand1.plus(operand2);
};
baseComputations.openInterpreter['-'] = function (operand1, operand2) {
  return operand1.minus(operand2);
};
baseComputations.openInterpreter['*'] = function (operand1, operand2) {
  return operand1.times(operand2);
};
baseComputations.openInterpreter['*bgw'] = function (operand1, operand2) {
  return operand1.times(operand2);
};
baseComputations.openInterpreter['^'] = function (operand1, operand2) {
  return new BigNumber(Number(!operand1.eq(operand2)));
};
baseComputations.openInterpreter['|'] = function (operand1, operand2) {
  return new BigNumber(Number(operand1.plus(operand2).gte(1)));
};
baseComputations.openInterpreter['/'] = function (operand1, operand2) {
  return operand1.div(operand2).floor();
};
baseComputations.openInterpreter['%'] = function (operand1, operand2) {
  return operand1.mod(operand2);
};
baseComputations.openInterpreter['<'] = function (operand1, operand2) {
  return new BigNumber(Number(operand1.lt(operand2)));
};
baseComputations.openInterpreter['<='] = function (operand1, operand2) {
  return new BigNumber(Number(operand1.lte(operand2)));
};
baseComputations.openInterpreter['>'] = function (operand1, operand2) {
  return new BigNumber(Number(operand1.gt(operand2)));
};
baseComputations.openInterpreter['>='] = function (operand1, operand2) {
  return new BigNumber(Number(operand1.gte(operand2)));
};
baseComputations.openInterpreter['=='] = function (operand1, operand2) {
  return new BigNumber(Number(operand1.eq(operand2)));
};
baseComputations.openInterpreter['!='] = function (operand1, operand2) {
  return new BigNumber(Number(!operand1.eq(operand2)));
};
baseComputations.openInterpreter['!'] = function (operand1, _) {
  return new BigNumber(operand1).plus(1).mod(2);
};
baseComputations.openInterpreter['abs'] = function (operand1, _) {
  return new BigNumber(operand1).abs();
};

// Add new functionality to the MPC interpreter
baseComputations.mpcInterpreter['abs'] = function (operand1, _) {
  return operand1.abs();
};

// Default Computation Scheme
module.exports = baseComputations;