// Global parameters
var done;

// Test symbol/name, inputs, and parallelism degree
var test;
var inputs;
var testParallel;

// Acquire Zp from the jiff instance
var Zp;

// Flags success/failure
var errors = [];

const function_map = {
  '*': 'mult',
  '|': 'or_bit',
  '<': 'lt',
  '^': 'xor_bit',
  '<=': 'lteq',
  '>': 'gt',
  '>=': 'gteq',
  '==': 'eq',
  '!=': 'neq',
  '/': 'div',
}

// For logging purposes
function myJoin(indices, values, sep) {
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
}

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
  '!': function (operand1, _) {
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
  '!' : function (operand1, _) {
    return (operand1 + 1) % 2;
  }
};

// Interpret the computation on the given values
function compute(test, values, interpreter) {
  try {
    var func = interpreter[test];

    // Figure who the inputs belong to
    var indices = [];
    for (var p in values) {
      if (values.hasOwnProperty(p) && values[p] != null) {
        indices.push(p);
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
}

// Run a single test case under MPC and in the open and compare the results
function singleTest(jiff_instance, t) {
  try {
    var testInputs = inputs[t];

    // Compute in the Open
    var actualResult = compute(test, testInputs, exports.openInterpreter);

    // Figure out who is sharing
    var input = testInputs[jiff_instance.id];
    var senders = [];
    for (var p in testInputs) {
      if (testInputs.hasOwnProperty(p) && p !== 'constant') {
        senders.push(/^\d+$/.test(p.toString()) ? parseInt(p) : p);
      }
    }
    senders.sort();

    // Compute in MPC
    var threshold = test === '*bgw' ? Math.floor(jiff_instance.party_count / 2) : jiff_instance.party_count;
    var shares = jiff_instance.share(input, threshold, null, senders);
    shares['constant'] = testInputs['constant'];
    var mpcResult = compute(test, shares, exports.mpcInterpreter);
    if (mpcResult == null) {
      return null;
    }

    return mpcResult.open().then(function (mpcResult) {
      // Assert both results are equal
      if (actualResult.toString() !== mpcResult.toString()) {
        if (jiff_instance.id === 1) {
          errors.push(myJoin(senders, testInputs, test) + ' != ' + mpcResult.toString() + ' ----- Expected ' + actualResult.toString());
        }
      }/* else if (jiff_instance.id === 1) {
        console.log(myJoin(senders, testInputs, test) + ' = ' + mpcResult.toString());
      }*/
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

  Zp = jiff_instance.Zp;
  if (inputs[0]['constant'] == null) {
    var op_name = 's' + function_map[test]
  } else {
    op_name = 'c' + function_map[test]
  }
  var promise;
  if (function_map[test] == null || op_name === 'cmult' || op_name === 'cor_bit' || op_name === 'cxor_bit' || op_name === 'sdiv') {
    promise = new Promise(function (resolve, reject) {
      setTimeout(() => resolve('done!'), 1);
    });
  } else {
    promise = jiff_instance.preprocessing(op_name, inputs.length * jiff_instance.party_count);
  }

  promise.then(function () {
    jiff_instance.finish_preprocessing();
    batchTest(jiff_instance, 0);
  });

};
