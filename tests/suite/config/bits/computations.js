// Use base computation but override interpreters.
var baseComputations = require('../../computations.js');

var testConfig;

// How to interpret non-MPC operations
baseComputations.openInterpreter = {
  'decomposition': function (operand1) {
    return operand1; // decomposition -> is a no-op
  },
  '+': function (operand1, operand2) {
    return operand1 + operand2;
  },
  '-': function (operand1, operand2) {
    return operand1 - operand2;
  },
  '*': function (operand1, operand2) {
    return operand1 * operand2;
  },
  '/': function (operand1, operand2) {
    return Math.floor(operand1 / operand2);
  },
  '%': function (operand1, operand2) {
    return operand1 % operand2;
  },
  '+c': function (operand1, operand2) {
    return operand1 + operand2;
  },
  '-c': function (operand1, operand2) {
    return operand1 - operand2;
  },
  'c-': function (operand1, operand2) {
    return operand2 - operand1;
  },
  '*c': function (operand1, operand2) {
    return operand1 * operand2;
  },
  '/c': function (operand1, operand2) {
    return Math.floor(operand1 / operand2);
  },
  '%c': function (operand1, operand2) {
    return operand1 % operand2;
  },
  'c/': function (operand1, operand2) {
    return Math.floor(operand2 / operand1);
  },
  'c%': function (operand1, operand2) {
    return operand2 % operand1;
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
  'c<': function (operand1, operand2) {
    return Number(operand1 < operand2);
  },
  'c<=': function (operand1, operand2) {
    return Number(operand1 <= operand2);
  },
  'c>': function (operand1, operand2) {
    return Number(operand1 > operand2);
  },
  'c>=': function (operand1, operand2) {
    return Number(operand1 >= operand2);
  },
  'c==': function (operand1, operand2) {
    return Number(operand1 === operand2);
  },
  'c!=': function (operand1, operand2) {
    return Number(operand1 !== operand2);
  }
};

var curryCombinator = function (opName, attr, flipOperands) {
  if (attr == null) {
    if (flipOperands !== true) {
      return function (operand1, operand2) {
        return operand1[0].jiff.protocols.bits[opName](operand1, operand2);
      }
    } else {
      return function (operand1, operand2) {
        return operand1[0].jiff.protocols.bits[opName](operand2, operand1);
      }
    }
  } else {
    if (flipOperands !== true) {
      return function (operand1, operand2) {
        return operand1[0].jiff.protocols.bits[opName](operand1, operand2)[attr];
      }
    } else {
      return function (operand1, operand2) {
        return operand1[0].jiff.protocols.bits[opName](operand2, operand1)[attr];
      }
    }
  }
};

// How to interpret MPC operations
baseComputations.mpcInterpreter = {
  '+': curryCombinator('sadd'),
  '-': curryCombinator('ssub'),
  '*': curryCombinator('smult'),
  '/': curryCombinator('sdiv', 'quotient'),
  '%': curryCombinator('sdiv', 'remainder'),
  '+c': curryCombinator('cadd'),
  '-c': curryCombinator('csubl'),
  '*c': curryCombinator('cmult'),
  '<': curryCombinator('slt'),
  '<=': curryCombinator('slteq'),
  '>': curryCombinator('sgt'),
  '>=': curryCombinator('sgteq'),
  '==': curryCombinator('seq'),
  '!=': curryCombinator('sneq'),
  'c<': curryCombinator('clt'),
  'c<=': curryCombinator('clteq'),
  'c>': curryCombinator('cgt'),
  'c>=': curryCombinator('cgteq'),
  'c==': curryCombinator('ceq'),
  'c!=': curryCombinator('cneq'),
  'c-': curryCombinator('csubr', null, true),
  '/c': curryCombinator('cdivl', 'quotient'),
  '%c': curryCombinator('cdivl', 'remainder'),
  'c/': curryCombinator('cdivr', 'quotient', true),
  'c%': curryCombinator('cdivr', 'remainder', true),
  'decomposition': function (operand1) {
    return operand1;
  }
};

// Sharing bits
baseComputations.shareHook = async function (jiff_instance, test, testInputs, input, threshold, receivers, senders) {
  var shares;
  if (testConfig['share'] == null || testConfig['share'] === 'decomposition') {
    shares = jiff_instance.share(input, threshold, receivers, senders);
    var i, pid;
    for (i = 0; i < senders.length; i++) {
      pid = senders[i];
      if (testConfig['decompose'] == null || testConfig['decompose'].indexOf(pid) > -1) {
        shares[pid] = shares[pid].bit_decomposition();
      }
    }

    for (i = 0; i < senders.length; i++) {
      pid = senders[i];
      shares[pid] = await shares[pid];
    }
  }

  if (testConfig['share'] === 'share_bits') {
    var bitLength = testConfig['options']['max'] || jiff_instance.Zp;
    bitLength = bitLength.toString(2).length;
    shares = jiff_instance.protocols.bits.share_bits(input, bitLength, threshold, receivers, senders);
  }
  return shares;
};

// Opening bits
baseComputations.openHook = async function (jiff_instance, test, share) {
  if (share === true || share === false) {
    return share;
  }

  if (share.length == null) {
    return await share.open();
  }

  // share is really a bunch of bits
  if (testConfig['open'] == null || testConfig['open'] === 'composition') {
    share = jiff_instance.protocols.bits.bit_composition(share);
    return await share.open();
  }

  return await share[0].jiff.protocols.bits.open_bits(share);
};

baseComputations.verifyResultHook = function (test, mpcResult, expectedResult) {
  if (test === '-' || test === 'c-' || test === '-c') {
    if (mpcResult.toString(2).charAt(0) === '1' && expectedResult < 0) {
      var twosComplement = mpcResult.toString(2).split('').map(function (bit) {
        return bit === '1' ? '0' : '1';
      }).join('');
      mpcResult = -1 * (parseInt(twosComplement, 2) + 1);
    }
  }

  return (mpcResult.toString() === expectedResult.toString());
};

// Default Computation Scheme
exports.compute = function (_jiff_instance, _test, _inputs, _testParallel, _done, _testConfig) {
  testConfig = _testConfig;
  return baseComputations.compute(_jiff_instance, _test, _inputs, _testParallel, _done, testConfig);
};