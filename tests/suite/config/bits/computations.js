// Use base computation but override interpreters.
var baseComputations = require('../../computations.js');

var Zp;
var testConfig;
var partyCount;

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
var minusCount = 1;
baseComputations.openInterpreter['-'] = function (operand1, operand2) {
  minusCount = (minusCount + 1) % (partyCount - 1);
  if (operand1 >= operand2) {
    return operand1 - operand2;
  } else {
    var n = Zp.toString(2).length + minusCount;
    var bits = Math.abs(operand1 - operand2).toString(2).split('').reverse();
    for (var i = 0; i < bits.length; i++) {
      bits[i] = bits[i] === '0' ? '1' : '0';
    }
    while (bits.length <= n) {
      bits.push('1');
    }
    return parseInt(bits.reverse().join(''), 2) + 1 + Zp;
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
baseComputations.singleCompute = function (test, values, interpreter) {
  if (interpreter === baseComputations.openInterpreter) {
    return oldSingleCompute(test, values, interpreter) % Zp;
  }

  var keys = Object.keys(values);
  var bits = [];
  var promises = [];
  for (var i = 0; i < keys.length; i++) {
    bits[i] = values[keys[i]];
    if (bits[i] != null && (testConfig['decompose'] == null || testConfig['decompose'].indexOf(keys[i]) > -1)) {
      bits[i] = bits[i].bit_decomposition();
      (function (i) {
        bits[i] = bits[i].then(function (decomposition) {
          bits[i] = decomposition;
          return true;
        });
      })(i);
      promises.push(bits[i]);
    }
  }

  return Promise.all(promises).then(function () {
    var result = oldSingleCompute(test, bits, interpreter);
    return result[0].jiff.protocols.bits.bit_composition(result);
  });
};

// Default Computation Scheme
exports.compute = function (jiff_instance, _test, _inputs, _testParallel, _done, _testConfig) {
  Zp = jiff_instance.Zp;
  partyCount = jiff_instance.party_count;
  testConfig = _testConfig;
  return baseComputations.compute(jiff_instance, _test, _inputs, _testParallel, _done, testConfig);
};