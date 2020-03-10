// Use base computation but override interpreters.
var baseComputations = require('../../computations.js');

var testConfig;

baseComputations.preprocessing_function_map = {
  'decomposition': 'bit_decomposition',
  // constant comparison
  'c<': 'bits.clt',
  'c<=': 'bits.clteq',
  'c>': 'bits.cgt',
  'c>=': 'bits.cgteq',
  'c==': 'bits.ceq',
  'c!=': 'bits.cneq',
  // secret comparison
  '<': 'bits.slt',
  '<=': 'bits.slteq',
  '>': 'bits.sgt',
  '>=': 'bits.sgteq',
  '==': 'bits.seq',
  '!=': 'bits.sneq',
  // constant arithmetic
  '+c': 'bits.cadd',
  '-c': 'bits.csubl',
  'c-': 'bits.csubr',
  '*c': 'bits.cmult',
  '/c': 'bits.cdivl',
  '%c': 'bits.cdivl',
  'c/': 'bits.cdivr',
  'c%': 'bits.cdivr',
  // arithmetic
  '+': 'bits.sadd',
  '-': 'bits.ssub',
  '*': 'bits.smult',
  '/': 'bits.sdiv',
  '%': 'bits.sdiv'
};

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
baseComputations.shareHook = function (jiff_instance, test, testInputs, input, threshold, receivers, senders) {
  var shares = {};
  if (testConfig['share'] == null || testConfig['share'] === 'decomposition') {
    shares = jiff_instance.share(input, threshold, receivers, senders);
    var i, pid;
    for (i = 0; i < senders.length; i++) {
      pid = senders[i];
      if (testConfig['decompose'] == null || testConfig['decompose'].indexOf(pid) > -1) {
        shares[pid] = shares[pid].bit_decomposition();
      }
    }
  }

  if (testConfig['share'] === 'bits.share') {
    var bitLength = testConfig['options']['max'] || jiff_instance.Zp;
    bitLength = bitLength.toString(2).length;
    shares = jiff_instance.protocols.bits.share(input, bitLength, threshold, receivers, senders);
  }

  if (testConfig['share'] === 'bits.share_lengths') {
    for (i = 0; i < senders.length; i++) {
      var sender = senders[i];
      input = testInputs[sender];
      bitLength = testInputs['_length'+sender];
      if (bitLength == null) {
        bitLength = input.toString(2).length;
      }
      shares[sender] = jiff_instance.protocols.bits.share(input, bitLength, threshold, receivers, [sender])[sender];
    }
  }
  return shares;
};

// Opening bits
baseComputations.openHook = function (jiff_instance, test, share) {
  if (share === true || share === false) {
    return Number(share);
  }

  if (share.length == null) {
    return share.open();
  }

  // share is really a bunch of bits
  if (testConfig['open'] == null || testConfig['open'] === 'composition') {
    share = jiff_instance.protocols.bits.bit_composition(share);
    return share.open();
  }

  return share[0].jiff.protocols.bits.open(share);
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

// Pre-processing
baseComputations.preProcessingParams = function (jiff_instance, test, inputs, testConfig) {
  if (testConfig['options']['crypto_provider'] === true) {
    return null;
  }

  // preprocessing for opens
  var open_count = inputs.length;

  var operation = baseComputations.preprocessing_function_map[test];
  if (operation == null || !jiff_instance.has_preprocessing(operation)) {
    return { open_count: inputs.length };
  }

  // special case: test for varying lengths
  if (testConfig['share'] === 'bits.share_lengths') {
    var paramsList = [];
    for (var t = 0; t < inputs.length; t++) {
      var bitLengthLeft = inputs[t]['_length1'];
      if (bitLengthLeft == null) {
        bitLengthLeft = inputs[t][1].toString(2).length;
      }
      var bitLengthRight = inputs[t]['_length2'];
      if (bitLengthRight == null) {
        bitLengthRight = inputs[t][2].toString(2).length;
      }
      paramsList.push({bitLengthLeft: bitLengthLeft, bitLengthRight: bitLengthRight});
    }

    return { operation: operation, op_count: 1, Zp: jiff_instance.Zp, paramsList: paramsList, open_count: open_count };
  }

  var singleTestCount = Object.keys(inputs[0]).length;
  singleTestCount = singleTestCount > 1 ? (singleTestCount - 1) : singleTestCount;
  var count = inputs.length * singleTestCount;
  var params = {};
  var decomposition_count = null;

  // Number of bits in constants
  var cmax = testConfig['options']['cmax'] || testConfig['options']['max'] || jiff_instance.Zp;
  params['constantBits'] = cmax.toString(2).length;
  if (cmax.toString(2).lastIndexOf('1') === 0) {
    params['constantBits']--;
  }

  // Number of bits in secret
  if (testConfig['share'] == null || testConfig['share'] === 'decomposition') {
    params['bitLength'] = jiff_instance.Zp.toString(2).length;
    decomposition_count = inputs.length * Object.keys(inputs[0]).length;
  }
  if (testConfig['share'] === 'bits.share') {
    var max = testConfig['options']['max'] || jiff_instance.Zp;
    params['bitLength'] = max.toString(2).length;
    if (max.toString(2).lastIndexOf(1) === 0) { // power of 2
      params['bitLength']--;
    }
  }

  // Take into consideration size increase after operation(s)
  if (test === '+' || test === '-') {
    params['bitLength'] += 1;
  }

  // Do not double preprocess for bit_decomposition
  if (operation === 'bit_decomposition') {
    decomposition_count = null;
  }

  return {
    operation: operation,
    op_count: count,
    paramsList: [ params ],
    Zp: jiff_instance.Zp,
    decomposition_count: decomposition_count,
    open_count: open_count
  };
};

baseComputations.preprocess = function (jiff_instance, test, inputs, testConfig, preprocessingParams) {
  baseComputations.preprocess_start(test);

  // Preprocessing for main operations
  if (preprocessingParams['operation'] != null) {
    for (var i = 0; i < preprocessingParams['paramsList'].length; i++) {
      jiff_instance.preprocessing(preprocessingParams['operation'], preprocessingParams['op_count'],
        preprocessingParams['protocols'], preprocessingParams['threshold'],
        preprocessingParams['receivers_list'], preprocessingParams['compute_list'], preprocessingParams['Zp'],
        preprocessingParams['id_list'], preprocessingParams['paramsList'][i]);
    }
  }

  // Perform any necessary preprocessing for decomposition
  if (preprocessingParams['decomposition_count'] != null) {
    jiff_instance.preprocessing('bit_decomposition', preprocessingParams['decomposition_count'],
      preprocessingParams['protocols'], preprocessingParams['threshold'],
      preprocessingParams['receivers_list'], preprocessingParams['compute_list'], preprocessingParams['Zp'],
      preprocessingParams['id_list'], preprocessingParams['params']);
  }

  // Perform any needed preprocessing for open
  if (preprocessingParams['open_count'] != null) {
    var open_type = testConfig['open'] === 'bits.open' ? 'bits.open' : 'open';
    var copy = Object.assign({}, preprocessingParams['params']);
    if (open_type === 'bits.open') {
      copy['bitLength'] = testConfig['output_length'];
    }

    jiff_instance.preprocessing(open_type, preprocessingParams['open_count'],
      preprocessingParams['protocols'], preprocessingParams['threshold'],
      preprocessingParams['receivers_list'], preprocessingParams['compute_list'], preprocessingParams['Zp'],
      preprocessingParams['id_list'], copy);
  }

  // finish preprocessing
  return new Promise(function (resolve) {
    jiff_instance.executePreprocessing(function () {
      baseComputations.preprocess_done(test);
      resolve();
    });
  });
};

// Default Computation Scheme
exports.compute = function (_jiff_instance, _test, _inputs, _testParallel, _done, _testConfig) {
  testConfig = _testConfig;
  return baseComputations.compute.apply(baseComputations, arguments);
};