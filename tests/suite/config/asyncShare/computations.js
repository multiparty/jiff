// Override with different interpreters
var baseComputations = require('../../computations.js');

// How to interpret non-MPC operations
baseComputations.openInterpreter['+'] = function (operand1, operand2) {
  return operand1 + operand2;
};
baseComputations.openInterpreter['-'] = function (operand1, operand2) {
  return operand1 - operand2;
};
baseComputations.openInterpreter['*'] = function (operand1, operand2) {
  return operand1 * operand2;
};
baseComputations.openInterpreter['*bgw'] = function (operand1, operand2) {
  return operand1 * operand2;
};
baseComputations.openInterpreter['^'] = function (operand1, operand2) {
  return operand1 ^ operand2;
};
baseComputations.openInterpreter['|'] = function (operand1, operand2) {
  return operand1 | operand2;
};
baseComputations.openInterpreter['/'] = function (operand1, operand2) {
  return Math.floor(operand1 / operand2);
};
baseComputations.openInterpreter['%'] = function (operand1, operand2) {
  return operand1 % operand2;
};
baseComputations.openInterpreter['<'] = function (operand1, operand2) {
  return Number(operand1 < operand2);
};
baseComputations.openInterpreter['<='] = function (operand1, operand2) {
  return Number(operand1 <= operand2);
};
baseComputations.openInterpreter['>'] = function (operand1, operand2) {
  return Number(operand1 > operand2);
};
baseComputations.openInterpreter['>='] = function (operand1, operand2) {
  return Number(operand1 >= operand2);
};
baseComputations.openInterpreter['=='] = function (operand1, operand2) {
  return Number(operand1 === operand2);
};
baseComputations.openInterpreter['!='] = function (operand1, operand2) {
  return Number(operand1 !== operand2);
};
baseComputations.openInterpreter['!'] = function (operand1, _) {
  return (operand1 + 1) % 2;
};
baseComputations.openInterpreter['abs'] = function (operand1, _) {
  return Math.abs(operand1);
};

// Add new functionality to the MPC interpreter
baseComputations.mpcInterpreter['abs'] = function (operand1, _) {
  return operand1.abs();
};

// Default Computation Scheme
module.exports = baseComputations;