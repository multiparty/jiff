
exports.generateBit = function (/*test, options*/) {
  return Math.random() < 0.5 ? 0 : 1;
};

// Generation API referred to from configuration JSON files

// Sharing/Opening test cases with no operations

exports.generateShareInputs = function (test, count, options) {
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

  for (var t = 0; t < count; t++) {
    var oneTest = { numbers: {} };
    // Generate numbers
    for (var p = 1; p <= options.party_count; p++) {
      oneTest['numbers'][p] = exports.generateBit();
    }
    // 1 <= Threshold <= party_count
    oneTest['threshold'] = options.party_count;

    // Generate senders/receivers
    var sn =Math.floor(Math.random() * (options.party_count - 2 + 1) + 2);// At least two sender, at most all.
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
    senders.sort();
    receivers.sort();
    oneTest['senders'] = senders;
    oneTest['receivers'] = receivers;
    inputs.push(oneTest);
  }
  return inputs;
};

// bit inputs: one for each party
// & and ^ requires bits
exports.generateGMWInputs = function (test, count, options) {
  var party_count = options.party_count;
  var inputs = [];
  var t, p, oneInput;
  // and and xor: inputs are binary
  for (t = 0; t < count; t++) {
    oneInput = {};
    for (p = 1; p <= party_count; p++) {
      oneInput[p] = exports.generateBit(test, options);
    }
    inputs.push(oneInput);
  }

  return inputs;
};



