// Use base computation but override interpreters.
var baseComputations = require('../../computations.js');

var Zp;
var testConfig;

// Real mod as opposed to remainder
baseComputations.mod = function (x, y) {
  if (x.lt(0)) {
    return x.plus(y).mod(y);
  }
  return x.mod(y);
};

// How to interpret non-MPC operations
baseComputations.openInterpreter['decomposition'] = function (operand1) {
  return operand1; // decomposition -> is a no-op
};
baseComputations.openInterpreter['+'] = function (operand1, operand2) {
  return (operand1 + operand2) % Zp;
};
baseComputations.openInterpreter['-'] = function (operand1, operand2) {
  if (operand1 >= operand2) {
    return (operand1 - operand2) % Zp;
  } else {
    var n = operand2.toString(2).length;
    var bits = Math.abs(operand1 - operand2).toString(2).split('');
    while (bits.length < n) {
      bits.push(0);
    }
    bits.push(1);
    return parseInt(bits.join('')) % Zp;
  }
};
baseComputations.openInterpreter['*'] = function (operand1, operand2) {
  return (operand1 * operand2) % Zp;
};
baseComputations.openInterpreter['/'] = function (operand1, operand2) {
  return Math.floor(operand1 / operand2);
};
baseComputations.openInterpreter['%'] = function (operand1, operand2) {
  return (operand1 % operand2);
};

baseComputations.mpcInterpreter['decomposition'] = function (operand1) {
  return operand1;
};
baseComputations.mpcInterpreter['+'] = function (operand1, operand2) {
  return operand1[0].jiff.protocols.bits.sadd(operand1, operand2);
};
baseComputations.mpcInterpreter['-'] = function (operand1, operand2) {
  return operand1[0].jiff.protocols.bits.ssub(operand1, operand2);
};
baseComputations.mpcInterpreter['*'] = function (operand1, operand2) {
  return operand1[0].jiff.protocols.bits.smult(operand1, operand2);
};
baseComputations.mpcInterpreter['/'] = function (operand1, operand2) {
  return operand1[0].jiff.protocols.bits.sdiv(operand1, operand2).quotient;
};
baseComputations.mpcInterpreter['%'] = function (operand1, operand2) {
  return operand1[0].jiff.protocols.bits.sdiv(operand1, operand2).remainder;
};

// Wrap single compute function with calls to bit_decomposition and bit_composition
var oldSingleCompute = baseComputations.singleCompute;
baseComputations.singleCompute = async function (test, values, interpreter) {
  try {
    if (interpreter === baseComputations.mpcInterpreter) {
      values = Object.assign({}, values);

      for (var p in values) {
        if (!values.hasOwnProperty(p) || values[p] == null || p === 'constant') {
          continue;
        }

        if (testConfig.decompose == null || testConfig.decompose.indexOf(p) > -1) {
          values[p] = await values[p].bit_decomposition();
        }
      }
    }

    var result = await oldSingleCompute(test, values, interpreter);
    if (interpreter === baseComputations.mpcInterpreter) {
      result = result[0].jiff.protocols.bits.bit_composition(result);
    }
    return result;
  } catch (err) {
    console.log(err);
    throw err;
  }
}

// Default Computation Scheme
exports.compute = function (jiff_instance, _test, _inputs, _testParallel, _done, _testConfig) {
  Zp = jiff_instance.Zp;
  testConfig = _testConfig;
  return baseComputations.compute(jiff_instance, _test, _inputs, _testParallel, _done, testConfig);
};