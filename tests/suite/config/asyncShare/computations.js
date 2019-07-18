// Acquire Zp from the jiff instance
var Zp;

// Flags success/failure
var errors = [];
var successes = [];

// Override with different interpreters
var baseComputations = require('../../computations.js');

var testConfig;


// sharing
baseComputations.shareHook = async function (jiff_instance, test, testInputs, input, threshold, receivers, senders, ratios) {
  var shares = jiff_instance.share(input, threshold, receivers, senders, jiff_instance.Zp, null, ratios);
  return shares;
}

baseComputations.shareParameters = function (jiff_instance, test, testInputs) {
  var ratios = testInputs[1];
  testInputs = testInputs[0];
  var input = testInputs[jiff_instance.id];

  // Figure out who is sharing
  var senders = [];
  for (var p in testInputs) {
    if (testInputs.hasOwnProperty(p) && p != 'constant') {
      senders.push(/^\d+$/.test(p.toString()) ? parseInt(p) : p);
    }
  }
  senders.sort();

  // Figure out threshold
  var threshold = test === '*bgw' ? Math.floor(jiff_instance.party_count / 2) : jiff_instance.party_count;
  return {input: input, threshold: threshold, senders: senders, receivers: null, constant: testInputs['constant'], ratios: ratios};
};

baseComputations.singleTest = async function (jiff_instance, test, testInputs) {
  try {
    // Share for MPC
    var shareParameters = baseComputations.shareParameters(jiff_instance, test, testInputs);
    var shares = await baseComputations.shareHook(jiff_instance, test, testInputs, shareParameters.input, shareParameters.threshold, shareParameters.receivers, shareParameters.senders, {1: 2, 2: 2, 3: 1, 4: 2});
    if (shares == null) {
      return null;
    }

    shares['constant'] = shareParameters.constant;

    // Compute in the Open
    var actualResult = await baseComputations.singleCompute(jiff_instance, shareParameters, test, testInputs[0], baseComputations.openInterpreter);

    // Compute under MPC
    var mpcResult = await baseComputations.singleCompute(jiff_instance, shareParameters, test, shares, baseComputations.mpcInterpreter);
    if (mpcResult == null) {
      return null;
    }

    // Open
    mpcResult = await baseComputations.openHook(jiff_instance, test, mpcResult);

    // Verify result
    // Assert both results are equal
    if (!baseComputations.verifyResultHook(test, mpcResult, actualResult)) {
      errors.push(baseComputations.errorMessage(jiff_instance, test, testInputs[0], shareParameters, mpcResult, actualResult));
      return false;
    }

    successes.push(baseComputations.successMessage(jiff_instance, test, testInputs[0], shareParameters, mpcResult, actualResult));
  } catch (err) {
    console.log(err);
    errors.push(err);
    return false;
  }

  return true;
};

// Default Computation Scheme
exports.compute = function (_jiff_instance, _test, _inputs, _testParallel, _done, _testConfig) {
  testConfig = _testConfig;
  return baseComputations.compute.apply(baseComputations, arguments);
};


