// Global parameters
var done;

// Test symbol/name, inputs, and parallelism degree
var test;
var inputs;
var testParallel;

// Flags success/failure
var errors = [];

// Code to verify if else against
exports.open_if_else = function (input) {
  return input[1].toString() === '1' ? input[2] : input[3];
};

// Code to do if else in secret
exports.mpc_if_else = function (input) {
  return input[1].if_else(input[2], input[3]);
};

// Run a single test case under MPC and in the open and compare the results
function singleTest(jiff_instance, t) {
  try {
    var testInputs = inputs[t];

    // Compute in the Open
    var actualResult = exports.open_if_else(testInputs);

    // Figure out who is sharing
    var senders = [1];
    if (test === 'sif_else' || test === 's1if_else') {
      senders.push(2);
    }
    if (test === 'sif_else' || test === 's2if_else') {
      senders.push(3);
    }

    // Compute in MPC
    var shares = jiff_instance.share(testInputs[jiff_instance.id], null, null, senders);
    if (senders.indexOf(2) === -1) {
      shares[2] = testInputs[2];
    }
    if (senders.indexOf(3) === -1) {
      shares[3] = testInputs[3];
    }

    // Compute if else under MPC
    var mpcResult = exports.mpc_if_else(shares);
    return mpcResult.open().then(function (mpcResult) {
      // Assert both results are equal
      if (actualResult.toString() !== mpcResult.toString()) {
        if (jiff_instance.id === 1) {
          var description = testInputs[1].toString() + '.' + test + '(' + testInputs[2].toString() + ', ' + testInputs[3].toString() + ')';
          description += ' != ' + mpcResult.toString() + ' ----- Expected ' + actualResult.toString();
          errors.push(description);
        }
      }
    });
  } catch (err) {
    errors.push(err);
  }
}

// Run a batch of tests according to parallelism degree until all tests are consumed
function batchTest(jiff_instance, startIndex) {
  var t;
  var end = Math.min(startIndex + testParallel, inputs.length);

  // Reached the end
  if (startIndex >= end) {
    jiff_instance.disconnect(true, true);

    if (jiff_instance.id === 1) {
      var exception;
      if (errors.length > 0) {
        exception = Error('Failed Test: ' + test + '\n\t' + errors.join('\n\t'));
      }
      done(exception);
    }
    return;
  }

  // Keep going
  jiff_instance.start_barrier();
  for (t = startIndex; t < end; t++) {
    var promise = singleTest(jiff_instance, t);
    jiff_instance.add_to_barriers(promise);
  }
  jiff_instance.end_barrier(function () {
    batchTest(jiff_instance, t);
  });
}

// Default Computation Scheme
exports.compute = function (jiff_instance, _test, _inputs, _testParallel, _done) {
  errors = [];
  done = _done;
  test = _test;
  inputs = _inputs;
  testParallel = _testParallel;

  // We have 4 kinds of if_else(x1, x2)
  // a. x1 and x2 are secret
  // b. only x1 is constant
  // c. only x2 is constant
  // d. both are constant
  var promise = jiff_instance.preprocessing('if_else', inputs.length, testParallel);
  promise.then(function () {
    jiff_instance.finish_preprocessing();
    batchTest(jiff_instance, 0);
  });
};
