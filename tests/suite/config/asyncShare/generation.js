// Reuse base generation but with different underlying generation methods
var baseGeneration = require('../base/generation.js');

// Sharing/Opening test cases with no operations
baseGeneration.generateShareRatios = function(test, count, options){
  var t, p, oneRatio;
  var inputs = [];
  var threshold = Math.floor(Math.random() * options.party_count) + 1;
  for (t = 0; t < count; t++) {
    oneRatio = {};
    for (p = 1; p <= options.party_count; p++) {
      oneRatio[p] = baseGeneration.generateNonZeroUniform(test, options, threshold);
    }
    inputs.push(oneRatio);
  }
  return inputs;
};

var oldArithmeticInputs = baseGeneration.generateArithmeticInputs;
baseGeneration.generateArithmeticInputs = function (test, count, options) {
  var inputs = [];
  var arithInputs = oldArithmeticInputs(test, count, options);
  var ratioInputs = baseGeneration.generateShareRatios(test,count,options);
  for (var t = 0; t < count; t++) {
    inputs.push([arithInputs[t], ratioInputs[t]]);
  }
  return inputs;
};

var oldConstantArithmeticInputs = baseGeneration.generateConstantArithmeticInputs;
baseGeneration.generateConstantArithmeticInputs = function (test, count, options) {
  var inputs = [];
  var arithInputs = oldConstantArithmeticInputs(test, count, options);
  var ratioInputs = baseGeneration.generateShareRatios(test,count,options);
  for (var t = 0; t < count; t++) {
    inputs.push([arithInputs[t], ratioInputs[t]]);
  }
  return inputs;
}

var oldComparisonInputs = baseGeneration.generateComparisonInputs;
baseGeneration.generateComparisonInputs = function (test, count, options) {
  var inputs = [];
  var arithInputs = oldComparisonInputs(test, count, options);
  var ratioInputs = baseGeneration.generateShareRatios(test,count,options);
  for (var t = 0; t < count; t++) {
    inputs.push([arithInputs[t], ratioInputs[t]]);
  }
  return inputs;
}

var oldConstantComparisonInputs = baseGeneration.generateConstantComparisonInputs;
baseGeneration.generateConstantComparisonInputs = function (test, count, options) {
  var inputs = [];
  var arithInputs = oldConstantComparisonInputs(test, count, options);
  var ratioInputs = baseGeneration.generateShareRatios(test,count,options);
  for (var t = 0; t < count; t++) {
    inputs.push([arithInputs[t], ratioInputs[t]]);
  }
  return inputs;
}


baseGeneration.generateShareInputs = function (test, count, options) {
  var all_parties = [];
  for (var k = 1; k <= options.party_count; k++) {
    all_parties.push(k);
  }

  var inputs = [];
  // Generate test cases one at a time
  // A test case consists of
  // 1) input numbers
  // 2) sharing threshold
  // 3) array of senders
  // 4) array of receivers
  var max = options.max || options.Zp;
  for (var t = 0; t < count; t++) {
    var oneTest = { numbers: {} };
    // Generate numbers
    for (var p = 1; p <= options.party_count; p++) {
      oneTest['numbers'][p] = baseGeneration.generateUniform(test, options, max);
    }
    // 1 <= Threshold <= party_count
    oneTest['threshold'] = Math.floor(Math.random() * options.party_count) + 1;

    // Generate senders/receivers
    var sn = Math.ceil(Math.random() * options.party_count); // At least one sender, at most all.
    var rn = oneTest['threshold'] + Math.floor(Math.random() * (options.party_count - oneTest['threshold'] + 1)); // At least as many receivers as threshold.

    // Generate actual receivers and senders arrays
    var senders = all_parties.slice();
    var receivers = all_parties.slice();

    // remove random parties until proper counts are reached.
    while (senders.length > sn) {
      senders.splice(Math.floor(Math.random() * senders.length), 1);
    }
    while (receivers.length > rn) {
      receivers.splice(Math.floor(Math.random() * receivers.length), 1);
    }
    oneTest['senders'] = senders;
    oneTest['receivers'] = receivers;

    // Generate receiver ratios between 1 <= threshold
    for (p = 1; p < receivers; p++) {
      oneTest['receiver_ratios'][p] = baseGeneration.generateUniform(test, options, oneTest['threshold']);
    }

    inputs.push(oneTest);
  }
  return inputs;
};

module.exports = baseGeneration;