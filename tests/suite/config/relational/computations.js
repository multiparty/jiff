var baseComputations = require('../../computations.js');

baseComputations.openInterpreter['sayCow'] = function(operand1,operand2) {
  return operand2;
};

baseComputations.mpcInterpreter['sayCow'] = function(operand1,operand2) {
  return operand1.sayCow(operand2);
}

exports.compute = function (jiff_instance, _test, _inputs, _testParallel, _done) {
    return baseComputations.compute(jiff_instance, _test, _inputs, _testParallel, _done);
};
