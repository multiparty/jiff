// Use base computation but override interpreters.
var baseComputations = require('../../computations.js');

var Zp, testConfig, partyCount, test;

var secret1, secret0;


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
baseComputations.openInterpreter['-'] = function (operand1, operand2) {
  var numberOfOps = partyCount - 1;
  if (test.indexOf('c') > -1) {
    numberOfOps = 1;
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
baseComputations.mpcInterpreter['<'] = function (operand1, operand2) {
  return operand1[0].jiff.protocols.bits.slt(operand1, operand2);
};
baseComputations.mpcInterpreter['<='] = function (operand1, operand2) {
  return operand1[0].jiff.protocols.bits.slteq(operand1, operand2);
};
baseComputations.mpcInterpreter['>'] = function (operand1, operand2) {
  return operand1[0].jiff.protocols.bits.sgt(operand1, operand2);
};
baseComputations.mpcInterpreter['>='] = function (operand1, operand2) {
  return operand1[0].jiff.protocols.bits.sgteq(operand1, operand2);
};
baseComputations.mpcInterpreter['=='] = function (operand1, operand2) {
  return operand1[0].jiff.protocols.bits.seq(operand1, operand2);
};
baseComputations.mpcInterpreter['!='] = function (operand1, operand2) {
  return operand1[0].jiff.protocols.bits.sneq(operand1, operand2);
};
// constant comparisons
baseComputations.mpcInterpreter['c<'] = function (operand1, operand2) {
  var res = operand1[0].jiff.protocols.bits.clt(operand1, operand2);
  if (res === true) {
    res = secret1;
  } else if (res === false) {
    res = secret0;
  }
  return res;
};
baseComputations.mpcInterpreter['c<='] = function (operand1, operand2) {
  var res = operand1[0].jiff.protocols.bits.clteq(operand1, operand2);
  if (res === true) {
    res = secret1;
  } else if (res === false) {
    res = secret0;
  }
  return res;
};
baseComputations.mpcInterpreter['c>'] = function (operand1, operand2) {
  var res = operand1[0].jiff.protocols.bits.cgt(operand1, operand2);
  if (res === true) {
    res = secret1;
  } else if (res === false) {
    res = secret0;
  }
  return res;
};
baseComputations.mpcInterpreter['c>='] = function (operand1, operand2) {
  var res = operand1[0].jiff.protocols.bits.cgteq(operand1, operand2);
  if (res === true) {
    res = secret1;
  } else if (res === false) {
    res = secret0;
  }
  return res;
};
baseComputations.mpcInterpreter['c=='] = function (operand1, operand2) {
  var res = operand1[0].jiff.protocols.bits.ceq(operand1, operand2);
  if (res === true) {
    res = secret1;
  } else if (res === false) {
    res = secret0;
  }
  return res;
};
baseComputations.mpcInterpreter['c!='] = function (operand1, operand2) {
  var res = operand1[0].jiff.protocols.bits.cneq(operand1, operand2);
  if (res === true) {
    res = secret1;
  } else if (res === false) {
    res = secret0;
  }
  return res;
};

baseComputations.shareHook = async function (jiff_instance, test, testInputs, input, threshold, receivers, senders) {
  var shares = jiff_instance.share(input, threshold, receivers, senders);
  var i, pid;
  for (i = 0; i < senders.length; i++) {
    pid = senders[i];
    shares[pid] = shares[pid].bit_decomposition();
  }

  for (i = 0; i < senders.length; i++) {
    pid = senders[i];
    shares[pid] = await shares[pid];
  }

  return shares;
};

baseComputations.openHook = async function (jiff_instance, test, share) {
  if (share.length != null) {
    // share is really a bunch of bits
    share = jiff_instance.protocols.bits.bit_composition(share);
  }
  return await share.open();
};

baseComputations.verifyResultHook = function (test, mpcResult, expectedResult) {
  return (mpcResult.toString() === (expectedResult % Zp).toString());
};

// Default Computation Scheme
exports.compute = function (jiff_instance, _test, _inputs, _testParallel, _done, _testConfig) {
  Zp = jiff_instance.Zp;
  partyCount = jiff_instance.party_count;
  testConfig = _testConfig;
  test = _test;

  secret1 = jiff_instance.share(1);
  secret0 = jiff_instance.share(0);
  return baseComputations.compute(jiff_instance, _test, _inputs, _testParallel, _done, testConfig);
};