var baseComputations = require('./computations.js');

baseComputations.mpcInterpreter = 'MPC';
baseComputations.openInterpreter = 'OPEN';

baseComputations.shareParameters = function (jiff_instance, test, testInputs) {
  var numbers = testInputs['numbers'];

  var input = numbers[jiff_instance.id]; // will be ignored if party is not a sender
  var threshold = testInputs['threshold'];
  var receivers = testInputs['receivers'];
  var senders = testInputs['senders'];

  return {
    input: input,
    threshold: threshold,
    receivers: receivers,
    senders: senders
  }
};

baseComputations.shareHook = function (jiff_instance, test, testInputs, input, threshold, receivers, senders, shareParameters) {
  var id = jiff_instance.id;
  var shares = jiff_instance.share(input, threshold, receivers, senders);

  // Is this a re-share variant?
  if (test.startsWith('reshare')) {
    shareParameters.receivers = testInputs['reshare_holders'];
    shareParameters.threshold = testInputs['reshare_threshold'];
    // re-share all shares according to new holders and threshold
    for (var si = 0; si < senders.length; si++) {
      var sender = senders[si];
      shares[sender] = jiff_instance.reshare(shares[sender], shareParameters.threshold, shareParameters.receivers, receivers)
    }
  }

  if (shareParameters.receivers.indexOf(id) === -1 && senders.indexOf(id) === -1) {
    return null;
  }

  return shares;
};

baseComputations.singleCompute = function (jiff_instance, shareParameters, test, values, interpreter) {
  if (interpreter === baseComputations.openInterpreter) {
    return values['numbers'][jiff_instance.id];
  }

  // MPC interpreter
  // If we got here, we must be either a sender or a receiver

  var promise = null;
  var pid, tmp;
  for (var i = 0; i < shareParameters.senders.length; i++) {
    pid = shareParameters.senders[i];
    if (shareParameters.receivers.indexOf(jiff_instance.id) === -1) {
      // Case 1: did not receive any shares, must have sent one, will receive an open.
      tmp = jiff_instance.receive_open(shareParameters.receivers, shareParameters.senders, shareParameters.threshold);
    } else {
      // Case 2: received shares, maybe sent one too
      var share = values[pid];
      tmp = jiff_instance.open(share, shareParameters.senders);
    }

    if (pid === jiff_instance.id) {
      promise = tmp;
    }
  }
  return promise;
};

baseComputations.openHook = function (jiff_instance, test, promise) {
  return promise;
};

baseComputations.errorMessage = function (jiff_instance, test, testInputs, shareParameters, mpcResult, expectedResult) {
  var msg = 'party id '+ jiff_instance.id +': ';
  msg += 'senders: [ ' + shareParameters.senders.join(', ') + ' ]. ';
  msg += 'receivers: [ ' + shareParameters.receivers.join(', ') + ' ]. ';
  msg += '!= ' + mpcResult.toString() + ' ----- Expected ' + expectedResult.toString() + '. ';
  msg += 'All Inputs: [ ' + baseComputations.myJoin(shareParameters.senders, testInputs['numbers'], ' | ') + ' ]';
  return msg;
};

baseComputations.successMessage = function (jiff_instance, test, testInputs, shareParameters, mpcResult, expectedResult) {
  var msg = 'party id '+ jiff_instance.id +': ';
  msg += 'senders: [ ' + shareParameters.senders.join(', ') + ' ]. ';
  msg += 'receivers: [ ' + shareParameters.receivers.join(', ') + ' ]. ';
  msg += '= ' + mpcResult.toString() + ' = ' + expectedResult.toString() + '. ';
  msg += 'All Inputs: [ ' + baseComputations.myJoin(shareParameters.senders, testInputs['numbers'], ' | ') + ' ]';
  return msg;
};

baseComputations.preProcessingParams = function () {
  return true;
};

baseComputations.preprocess = function (jiff_instance, test, inputs) {
  baseComputations.preprocess_start(test);

  for (var i = 0; i < inputs.length; i++) {
    var receivers = inputs[i]['receivers'];
    var senders = inputs[i]['senders'];
    var threshold = inputs[i]['threshold'];

    if (test.startsWith('reshare')) {
      receivers = inputs[i]['reshare_holders'];
      threshold = inputs[i]['reshare_threshold'];
    }

    // every receiver performs an open to all sender for all shares it received with the given threshold!
    jiff_instance.preprocessing('open', senders.length, null, threshold, receivers, senders, null, null, {open_parties: senders});
  }

  return new Promise(function (resolve) {
    jiff_instance.executePreprocessing(function () {
      baseComputations.preprocess_done(test);
      resolve();
    });
  });
};

module.exports = baseComputations;
