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

  if (testConfig['share'] === 'share_bits') {
    var bitLength = testConfig['options']['max'] || jiff_instance.Zp;
    bitLength = bitLength.toString(2).length;
    shares = jiff_instance.protocols.bits.share_bits(input, bitLength, threshold, receivers, senders);
  }

  if (testConfig['share'] === 'share_bits_lengths') {
    for (i = 0; i < senders.length; i++) {
      var sender = senders[i];
      input = testInputs[sender];
      bitLength = testInputs['_length'+sender];
      if (bitLength == null) {
        bitLength = input.toString(2).length;
      }
      shares[sender] = jiff_instance.protocols.bits.share_bits(input, bitLength, threshold, receivers, [sender])[sender];
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

  return share[0].jiff.protocols.bits.open_bits(share);
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
baseComputations.preProcessingParams = function (jiff_instance, test, inputs, testParallel, testConfig) {
  var operation = baseComputations.preprocessing_function_map[test];
  if (operation == null || !jiff_instance.has_preprocessing(operation)) {
    return null;
  }

  var singleTestCount = Object.keys(inputs[0]).length;
  singleTestCount = singleTestCount > 1 ? (singleTestCount - 1) : singleTestCount;
  var count = inputs.length * singleTestCount;
  var params = {};
  var decompositionCount = null;

  // Number of bits in constants
  var cmax = testConfig['options']['cmax'] || testConfig['options']['max'] || jiff_instance.Zp;
  params['constantBits'] = cmax.toString(2).length;
  if (cmax.toString(2).lastIndexOf('1') === 0) {
    params['constantBits']--;
  }

  // Number of bits in secret
  if (testConfig['share'] == null || testConfig['share'] === 'decomposition') {
    params['bitLength'] = jiff_instance.Zp.toString(2).length;
    decompositionCount = inputs.length * Object.keys(inputs[0]).length;
  }
  if (testConfig['share'] === 'share_bits') {
    var max = testConfig['options']['max'] || jiff_instance.Zp;
    params['bitLength'] = max.toString(2).length;
    if (max.toString(2).lastIndexOf(1) === 0) { // power of 2
      params['bitLength']--;
    }
  }

  if (testConfig['share'] === 'share_bits_lengths') {
    // will see what to do about this later
  }

  // Take into consideration size increase after operation(s)
  if (test === '+' || test === '-') {
    params['bitLength'] += 1;
  }

  // Do not double preprocess for bit_decomposition
  if (operation === 'bit_decomposition') {
    decompositionCount = null;
  }

  return {
    operation: operation,
    count: count,
    batch: testParallel,
    params: params,
    Zp: jiff_instance.Zp,
    decompositionCount: decompositionCount
  };
};

baseComputations.preprocess = function (jiff_instance, test, inputs, testParallel, testConfig, preprocessingParams) {
  var promise = jiff_instance.preprocessing(preprocessingParams['operation'], preprocessingParams['count'],
    preprocessingParams['batch'], preprocessingParams['protocols'], preprocessingParams['threshold'],
    preprocessingParams['receivers_list'], preprocessingParams['compute_list'], preprocessingParams['Zp'],
    preprocessingParams['id_list'], preprocessingParams['params']);

  // Perform any necessary preprocessing for decomposition
  if (preprocessingParams['decompositionCount'] != null) {
    var promise2 = jiff_instance.preprocessing('bit_decomposition', preprocessingParams['decompositionCount'],
      preprocessingParams['batch'], preprocessingParams['protocols'], preprocessingParams['threshold'],
      preprocessingParams['receivers_list'], preprocessingParams['compute_list'], preprocessingParams['Zp'],
      preprocessingParams['id_list'], preprocessingParams['params']);
    promise = Promise.all([promise, promise2]);
  }

  return promise.then(jiff_instance.finish_preprocessing);
};

// Default Computation Scheme
exports.compute = function (_jiff_instance, _test, _inputs, _testParallel, _done, _testConfig) {
  testConfig = _testConfig;
  return baseComputations.compute.apply(baseComputations, arguments);
};