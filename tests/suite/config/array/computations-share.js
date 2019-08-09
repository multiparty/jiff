var baseComputations = require('../../computations.js');

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

baseComputations.shareHook = function (jiff_instance, test, testInputs, input, threshold, receivers, senders) {
  var id = jiff_instance.id;
  if (receivers.indexOf(id) === -1 && senders.indexOf(id) === -1) {
    return null;
  }

  return jiff_instance.share_ND_array(input, null,threshold, receivers, senders);
};

baseComputations.singleCompute = function (jiff_instance, shareParameters, test, values, interpreter) {
  if (interpreter === baseComputations.openInterpreter) {
    return values['numbers'][jiff_instance.id];
  }

  // MPC interpreter
  // If we got here, we must be either a sender or a receiver

  // Case 1: did not receive any shares, must have sent one, will receive an open.
  if (shareParameters.receivers.indexOf(jiff_instance.id) === -1) {
    console.log('did not receive any shares:', shareParameters)
    return jiff_instance.receive_open(shareParameters.receivers, shareParameters.threshold);
  }

  //console.log(values);

  // Case 2: received shares, maybe sent one too
  var promise = null; // if sent a share, this will be assigned a promise to it when it is opened
  for (var i = 0; i < shareParameters.senders.length; i++) {
    // Loop over received shares, open each one to its original sender
    var pid = shareParameters.senders[i];
    var shares = values[pid];
    //console.log(shares == null);
    //if (shares == null) {
    //  console.log(shareParameters, pid, values);
    //}
    var tmp = jiff_instance.open_ND_array(shares, [pid]);
    if (tmp != null) { // pid == jiff_instance.id
      promise = tmp;
    }
    //tmp.then(function (result) {
    //  console.log(shareParameters, result);
    //});
  }

  return promise;
};

baseComputations.openHook = async function (jiff_instance, test, promise) {
  return await promise;
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

module.exports = baseComputations;
