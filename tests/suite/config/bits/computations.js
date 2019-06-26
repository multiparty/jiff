// Use base computation but override interpreters.
var baseComputations = require('../../computations.js');

var Zp, testConfig, partyCount;


// How to interpret non-MPC operations
// decomposition
baseComputations.openInterpreter['decomposition'] = function (operand1) {
  return operand1; // decomposition -> is a no-op
};
// arithmetic
baseComputations.openInterpreter['+'] = function (operand1, operand2) {
  return (operand1 + operand2) % Zp;
};
var minusCount = 1;
baseComputations.openInterpreter['-'] = function (operand1, operand2, numberOfOps) {
  if (numberOfOps == null) {
    numberOfOps = partyCount - 1;
  }

  minusCount = (minusCount + 1) % (numberOfOps);
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

// constant arithmetic
baseComputations.openInterpreter['+c'] = baseComputations.openInterpreter['+'];
baseComputations.openInterpreter['-c'] = function (operand1, operand2) {
  return baseComputations.openInterpreter['-'](operand1, operand2, 1);
};
baseComputations.openInterpreter['c-'] = function (operand1, operand2) {
  return baseComputations.openInterpreter['-'](operand2, operand1, 1);
};
baseComputations.openInterpreter['*c'] = baseComputations.openInterpreter['*'];
baseComputations.openInterpreter['/c'] = baseComputations.openInterpreter['/'];
baseComputations.openInterpreter['%c'] = baseComputations.openInterpreter['%'];
baseComputations.openInterpreter['c/'] =  function (operand1, operand2) {
  return baseComputations.openInterpreter['/'](operand2, operand1);
};
baseComputations.openInterpreter['c%'] =  function (operand1, operand2) {
  return baseComputations.openInterpreter['%'](operand2, operand1);
};

// comparisons
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

// constant comparisons
baseComputations.openInterpreter['c<'] = baseComputations.openInterpreter['<'];
baseComputations.openInterpreter['c<='] = baseComputations.openInterpreter['<='];
baseComputations.openInterpreter['c>'] = baseComputations.openInterpreter['>'];
baseComputations.openInterpreter['c>='] = baseComputations.openInterpreter['>='];
baseComputations.openInterpreter['c=='] = baseComputations.openInterpreter['=='];
baseComputations.openInterpreter['c!='] = baseComputations.openInterpreter['!='];


// How to interpret MPC operations
// decomposition
baseComputations.mpcInterpreter['decomposition'] = function (operand1) {
  return operand1;
};
// arithmetic
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
// constant arithmetic
baseComputations.mpcInterpreter['+c'] = function (operand1, operand2) {
  return operand1[0].jiff.protocols.bits.cadd(operand1, operand2);
};
baseComputations.mpcInterpreter['-c'] = function (operand1, operand2) {
  return operand1[0].jiff.protocols.bits.csubl(operand1, operand2);
};
baseComputations.mpcInterpreter['c-'] = function (operand1, operand2) {
  return operand1[0].jiff.protocols.bits.csubr(operand2, operand1);
};
baseComputations.mpcInterpreter['*c'] = function (operand1, operand2) {
  return operand1[0].jiff.protocols.bits.cmult(operand1, operand2);
};
baseComputations.mpcInterpreter['/c'] = function (operand1, operand2) {
  return operand1[0].jiff.protocols.bits.cdivl(operand1, operand2).quotient;
};
baseComputations.mpcInterpreter['%c'] = function (operand1, operand2) {
  return operand1[0].jiff.protocols.bits.cdivl(operand1, operand2).remainder;
};
baseComputations.mpcInterpreter['c/'] = function (operand1, operand2) {
  return operand1[0].jiff.protocols.bits.cdivr(operand2, operand1).quotient;
};
baseComputations.mpcInterpreter['c%'] = function (operand1, operand2) {
  return operand1[0].jiff.protocols.bits.cdivr(operand2, operand1).remainder;
};
// comparisons
baseComputations.openInterpreter['<'] = function (operand1, operand2) {
  return operand1[0].jiff.protocols.bits.slt(operand1, operand2);
};
baseComputations.openInterpreter['<='] = function (operand1, operand2) {
  return operand1[0].jiff.protocols.bits.slteq(operand1, operand2);
};
baseComputations.openInterpreter['>'] = function (operand1, operand2) {
  return operand1[0].jiff.protocols.bits.sgt(operand1, operand2);
};
baseComputations.openInterpreter['>='] = function (operand1, operand2) {
  return operand1[0].jiff.protocols.bits.sgteq(operand1, operand2);
};
baseComputations.openInterpreter['=='] = function (operand1, operand2) {
  return operand1[0].jiff.protocols.bits.seq(operand1, operand2);
};
baseComputations.openInterpreter['!='] = function (operand1, operand2) {
  return operand1[0].jiff.protocols.bits.sneq(operand1, operand2);
};
// constant comparisons
baseComputations.openInterpreter['c<'] = function (operand1, operand2) {
  return operand1[0].jiff.protocols.bits.clt(operand1, operand2);
};
baseComputations.openInterpreter['c<='] = function (operand1, operand2) {
  return operand1[0].jiff.protocols.bits.clteq(operand1, operand2);
};
baseComputations.openInterpreter['c>'] = function (operand1, operand2) {
  return operand1[0].jiff.protocols.bits.cgt(operand1, operand2);
};
baseComputations.openInterpreter['c>='] = function (operand1, operand2) {
  return operand1[0].jiff.protocols.bits.cgteq(operand1, operand2);
};
baseComputations.openInterpreter['c=='] = function (operand1, operand2) {
  return operand1[0].jiff.protocols.bits.ceq(operand1, operand2);
};
baseComputations.openInterpreter['c!='] = function (operand1, operand2) {
  return operand1[0].jiff.protocols.bits.cneq(operand1, operand2);
};


// Wrap single compute function with calls to bit_decomposition and bit_composition
var oldSingleCompute = baseComputations.singleCompute;
baseComputations.singleCompute = function (test, values, interpreter) {
  if (interpreter === baseComputations.openInterpreter) {
    return oldSingleCompute(test, values, interpreter) % Zp;
  }

  var keys = Object.keys(values);
  var bits = {};
  var promises = [];
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    if (values[key] != null && (testConfig['decompose'] == null || testConfig['decompose'].indexOf(key) > -1)) {
      (function (key) {
        promises.push(values[key].bit_decomposition().then(function (decomposition) {
          bits[key] = decomposition;
          return true;
        }));
      })(key);
    } else {
      bits[key] = values[key];
    }
  }

  return Promise.all(promises).then(function () {
    var result = oldSingleCompute(test, bits, interpreter);
    if (result.length != null) {
      return result[0].jiff.protocols.bits.bit_composition(result);
    }

    return result;
  });
};

// Default Computation Scheme
exports.compute = function (jiff_instance, _test, _inputs, _testParallel, _done, _testConfig) {
  Zp = jiff_instance.Zp;
  partyCount = jiff_instance.party_count;
  testConfig = _testConfig;
  return baseComputations.compute(jiff_instance, _test, _inputs, _testParallel, _done, testConfig);
};