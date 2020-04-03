// Global parameters
var baseComputations = require('./computations.js');

// Messages
baseComputations.errorMessage = function (jiff_instance, test, testInputs, shareParameters, mpcResult, expectedResult) {
  return test[1] + '.' + test + '(' + test[2] + ', ' + test[3] + ') !=' + mpcResult.toString() + ' ----- Expected ' + expectedResult.toString();
};
baseComputations.successMessage = function (jiff_instance, test, testInputs, shareParameters, mpcResult, expectedResult) {
  return test[1] + '.' + test + '(' + test[2] + ', ' + test[3] + ') = ' + mpcResult.toString() + ' = ' + expectedResult.toString();
};

// Code to verify if else against
baseComputations.openInterpreter = function (input) {
  return input[1].toString() === '1' ? input[2] : input[3];
};
// Code to do if else in secret
baseComputations.mpcInterpreter = function (input) {
  return input[1].if_else(input[2], input[3]);
};

// Figure out who is sharing what
baseComputations.shareParameters = function (jiff_instance, test, testInputs) {
  var input = testInputs[jiff_instance.id];

  // Figure out who is sharing
  var senders = [ 1 ];
  if (test === 'sif_else' || test === 's1if_else') {
    senders.push(2);
  }
  if (test === 'sif_else' || test === 's2if_else') {
    senders.push(3);
  }

  return { input: input, threshold: null, senders: senders, receivers: null, constant: testInputs['constant'] };
};
baseComputations.shareHook = function (jiff_instance, test, testInputs, input, threshold, receivers, senders) {
  var shares = jiff_instance.share(input, threshold, receivers, senders);
  if (shares[2] == null) {
    shares[2] = testInputs[2];
  }
  if (shares[3] == null) {
    shares[3] = testInputs[3];
  }
};

// computation
baseComputations.singleCompute = function (jiff_instance, shareParameters, test, values, interpreter) {
  return interpreter(values);
};

// Pre-processing
baseComputations.preProcessingParams = function (jiff_instance, test, inputs, testConfig) {
  if (testConfig['options']['crypto_provider'] === true) {
    return null;
  }

  return {
    operation: 'if_else',
    op_count: inputs.length,
    open_count: inputs.length
  }
};

module.exports = baseComputations;
