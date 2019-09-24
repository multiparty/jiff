// Use base computation but override interpreters.
var baseComputations = require('../../computations.js');
var Zp;

baseComputations.openInterpreter = 'OPEN';
baseComputations.mpcInterpreter = 'MPC';

// No sharing, but keep track of upper and lower bounds
baseComputations.shareParameters = function (jiff_instance, test, testInputs) {
  var keys = [];
  if (testInputs['upper'] != null) {
    keys.push('upper');
  }
  if (testInputs['lower'] != null) {
    keys.push('lower');
  }
  return { input: testInputs, senders: keys};
};
baseComputations.shareHook = function (jiff_instance, test, testInputs, input, threshold, receivers, senders) {
  return testInputs;
};

// Computing
baseComputations.singleCompute = function (jiff_instance, shareParameters, test, values, interpreter) {
  if (interpreter === baseComputations.openInterpreter) {
    return values;
  }

  var params = {lower_bound: values['lower'], upper_bound: values['upper']};
  return jiff_instance.protocols.bits.rejection_sampling(null, null, null, null, params, null).share;
};

// Opening bits
baseComputations.openHook = function (jiff_instance, test, share) {
  return share[0].jiff.protocols.bits.open(share);
};

// Verification
baseComputations.verifyResultHook = function (test, mpcResult, expectedResult) {
  var lower = expectedResult['lower'] || 0;
  var upper = expectedResult['upper'] || Zp;
  return (mpcResult >= lower) && (mpcResult < upper) && !Number.isNaN(mpcResult) && typeof(mpcResult) === 'number' && mpcResult !== Infinity;
};

// Pre-processing
baseComputations.preProcessingParams = function (jiff_instance, test, inputs, testParallel, testConfig) {
  if (testConfig['options']['crypto_provider'] === true) {
    return null;
  }

  var bitLength = null;
  if (inputs[0].upper != null) {
    bitLength = inputs[0].upper.toString(2).length;
  }

  return {
    open_count: inputs.length,
    batch: testParallel,
    params: {
      bitLength: bitLength
    }
  };
};

baseComputations.preprocess = function (jiff_instance, test, inputs, testParallel, testConfig, preprocessingParams) {
  baseComputations.preprocess_start(test);

  jiff_instance.preprocessing('bits.open', preprocessingParams['open_count'],
    preprocessingParams['batch'], preprocessingParams['protocols'], preprocessingParams['threshold'],
    preprocessingParams['receivers_list'], preprocessingParams['compute_list'], preprocessingParams['Zp'],
    preprocessingParams['id_list'], preprocessingParams['params']);

  return new Promise(function (resolve) {
    jiff_instance.onFinishPreprocessing(function () {
      baseComputations.preprocess_done(test);
      resolve();
    });
  });
};

exports.compute = function (jiff_instance, test, inputs, testParallel, done, testConfig) {
  Zp = jiff_instance.Zp;
  baseComputations.compute.apply(baseComputations, arguments);
};