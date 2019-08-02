// Acquire Zp from the jiff instance
var Zp;

// Flags success/failure
var errors = [];
var successes = [];

// For logging purposes
exports.myJoin = function (indices, values, sep) {
  var str = '';
  for (var i = 0; i < indices.length - 1; i++) {
    str = str + values[indices[i]].toString() + sep;
  }

  if (indices.length > 0) {
    str += values[indices[indices.length - 1]].toString();
  }

  if (values['constant'] != null) {
    str += sep + 'c[' + values['constant'].toString() + ']';
  } else if (indices.length === 1) {
    str = sep + str;
  }

  return str;
};

exports.errorMessage = function (jiff_instance, test, testInputs, shareParameters, mpcResult, expectedResult) {
  return exports.myJoin(shareParameters.senders, testInputs, test) + ' != ' + mpcResult.toString() + ' ----- Expected ' + expectedResult.toString();
};

exports.successMessage = function (jiff_instance, test, testInputs, shareParameters, mpcResult, expectedResult) {
  return exports.myJoin(shareParameters.senders, testInputs, test) + ' = ' + mpcResult.toString() + ' = ' + expectedResult.toString();
};

// Real mod as opposed to remainder
exports.mod = function (x, y) {
  if (x < 0) {
    return (x % y) + y;
  }
  return x % y;
};

// How to interpret MPC operations
exports.mpcInterpreter = {
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
  'cdivfac': function (operand1, operand2) {
    return operand1.cdivfac(operand2);
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
  },
  '!': function (operand1) {
    return operand1.not();
  }
};

// How to interpret non-MPC operations
exports.openInterpreter = {
  '+': function (operand1, operand2) {
    return exports.mod(operand1 + operand2, Zp);
  },
  '-': function (operand1, operand2) {
    return exports.mod(operand1 - operand2, Zp);
  },
  '*': function (operand1, operand2) {
    return exports.mod(operand1 * operand2, Zp);
  },
  '*bgw': function (operand1, operand2) {
    return exports.mod(operand1 * operand2, Zp);
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
  'cdivfac': function (operand1, operand2) {
    return exports.openInterpreter['/'](operand1, operand2);
  },
  '%' : function (operand1, operand2) {
    return exports.mod(operand1, operand2);
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
  '!' : function (operand1) {
    return (operand1 + 1) % 2;
  }
};

exports.verifyResultHook = function (test, mpcResult, expectedResult) {
  return (mpcResult.toString() === expectedResult.toString());
};

exports.shareHook = function (jiff_instance, test, testInputs, input, threshold, receivers, senders) {
  return jiff_instance.share(input, threshold, receivers, senders);
};

exports.openHook = async function (jiff_instance, test, share) {
  return await share.open();
};

exports.shareParameters = function (jiff_instance, test, testInputs) {
  var input = testInputs[jiff_instance.id];

  // Figure out who is sharing
  var senders = [];
  for (var p in testInputs) {
    if (testInputs.hasOwnProperty(p) && p !== 'constant' && !p.startsWith('_')) {
      senders.push(/^\d+$/.test(p.toString()) ? parseInt(p) : p);
    }
  }
  senders.sort();

  // Figure out threshold
  var threshold = test === '*bgw' ? Math.floor(jiff_instance.party_count / 2) : jiff_instance.party_count;
  return { input: input, threshold: threshold, senders: senders, receivers: null, constant: testInputs['constant'] };
};

// Interpret the computation on the given values
exports.singleCompute = function (jiff_instance, shareParameters, test, values, interpreter) {
  try {
    var func = interpreter[test];

    // Figure who the inputs belong to
    var indices = [];
    for (var p in values) {
      if (values.hasOwnProperty(p) && values[p] != null) {
        if (!p.toString().startsWith('_')) {
          indices.push(p);
        }
      }
    }
    indices.sort();

    // Compute
    var result = func(values[indices[0]], values[indices[1]]);
    for (var i = 2; i < indices.length; i++) {
      result = func(result, values[indices[i]]);
    }
    return result;
  } catch (err) {
    console.log(err);
    errors.push(err);
  }
};

// Run a single test case under MPC and in the open and compare the results
exports.singleTest = async function (jiff_instance, test, testInputs) {
  try {
    // Share for MPC
    var shareParameters = exports.shareParameters(jiff_instance, test, testInputs);
    var shares = await exports.shareHook(jiff_instance, test, testInputs, shareParameters.input, shareParameters.threshold, shareParameters.receivers, shareParameters.senders);
    if (shares == null) { // this party should not do anything
      return null;
    }
    shares['constant'] = shareParameters.constant;

    // Compute in the Open
    var actualResult = await exports.singleCompute(jiff_instance, shareParameters, test, testInputs, exports.openInterpreter);

    // Compute under MPC
    var mpcResult = await exports.singleCompute(jiff_instance, shareParameters, test, shares, exports.mpcInterpreter);
    if (mpcResult == null) {
      return null;
    }

    // Open
    mpcResult = await exports.openHook(jiff_instance, test, mpcResult);

    // Verify result
    // Assert both results are equal
    if (!exports.verifyResultHook(test, mpcResult, actualResult)) {
      errors.push(exports.errorMessage(jiff_instance, test, testInputs, shareParameters, mpcResult, actualResult));
      return false;
    }

    successes.push(exports.successMessage(jiff_instance, test, testInputs, shareParameters, mpcResult, actualResult));
  } catch (err) {
    console.log(err);
    errors.push(err);
    return false;
  }
  
  return true;
};

// Run a batch of tests according to parallelism degree until all tests are consumed
exports.batch = async function (jiff_instance, test, testParallel, inputs, done, testConfig) {
  //var end = Math.min(startIndex + testParallel, inputs.length);

  for (var t = 0; t < inputs.length; t++) {
    if (t % testParallel === 0) {
      jiff_instance.start_barrier();
    }

    var promise = exports.singleTest(jiff_instance, test, inputs[t]);
    jiff_instance.add_to_barriers(promise);

    if (t % testParallel === testParallel - 1 || t === inputs.length - 1) {
      await jiff_instance.end_barrier();
    }
  }

  // Reached the end
  jiff_instance.disconnect(true, true);
  if (jiff_instance.id === 1) {
    var exception;
    if (errors.length > 0) {
      exception = Error('Failed Test: ' + test + '\n\t' + errors.join('\n\t'));
    } if (testConfig['debug'] === true) {
      console.log('Succeeded: ' + test + '\n\t' + successes.join('\n\t'));
    }
    done(exception);
  }
};

// Default Computation Scheme
exports.compute = function (jiff_instance, test, inputs, testParallel, done, testConfig) {
  // Reset errors
  errors = [];
  successes = [];

  // Global variables
  Zp = jiff_instance.Zp;

  // Perform tests asynchronously
  exports.batch(jiff_instance, test, testParallel, inputs, done, testConfig);
};
