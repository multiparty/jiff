// Global parameters
var done;

// Test symbol/name, inputs, and parallelism degree
var test;
var inputs;
var testParallel;

// Flags success/failure
var errors = [];

// For logging purposes
function myJoin(indices, values, sep) {
  var str = '';
  for (var i = 0; i < indices.length - 1; i++) {
    str = str + values[indices[i]].toString() + sep;
  }

  if (indices.length > 0) {
    str += values[indices[indices.length - 1]].toString();
  }

  if (values['constant'] != null) {
    str += sep + 'c[' + values['constant'].toString() + ']';
  } else if (indices.length === 1) {
    str = sep + str;
  }

  return str;
}

function errorMsg(caseNum, id, ss, rs, expected, actual, allInputs) {
  var msg = '#'+caseNum+' | party id '+id+': ';
  msg += 'senders: [ ' + ss.join(', ') + ' ]. ';
  msg += 'receivers: [ ' + rs.join(', ') + ' ]. ';
  msg += '!= ' + actual.toString() + ' ----- Expected ' + actual.toString() + '. ';
  msg += 'All Inputs: [ ' + myJoin(ss, allInputs, ' | ') + ' ]';
  return msg;
}

// Run a single test case under MPC and in the open and compare the results
function singleTest(jiff_instance, t) {
  try {
    var testCase = inputs[t];
    var id = jiff_instance.id;

    var numbers = testCase['numbers'];

    var input = numbers[id]; // will be ignored if party is not a sender
    var threshold = testCase['threshold'];
    var rs = testCase['receivers'];
    var ss = testCase['senders'];

    // Share
    var shares = jiff_instance.share(input, threshold, rs, ss);

    // Is this a re-share variant?
    if (test.startsWith('reshare')) {
      var old_rs = rs;
      rs = testCase['reshare_holders'];
      threshold = testCase['reshare_threshold'];
      // re-share all shares according to new holders and threshold
      for (var si = 0; si < ss.length; si++) {
        var sender = ss[si];
        shares[sender] = jiff_instance.protocols.reshare(shares[sender], threshold, rs, old_rs)
      }
    }
    // re-share variant is done
    // if reshare is correct then the effect should be the same as having senders share the secrets
    // to the reshare_holders (now in rs) with the reshare_threshold (now in threshold) without
    // having gone through the intermediaries and re-share.

    if (ss.indexOf(id) === -1 && rs.indexOf(id) === -1) {
      // Nothing to do.
      return null;
    }

    // receiver but not sender, must send open shares of each number to its owner.
    if (rs.indexOf(id) > -1 && ss.indexOf(id) === -1) {
      // Send opens
      for (var i = 0; i < ss.length; i++) {
        jiff_instance.open(shares[ss[i]], [ss[i]]);
      }

      return null;
    }

    // must be a sender, maybe a receiver too.
    var promise = null; // to store a promise to opening this party's original input.

    // receiver and sender, must send open shares of each number to its owner, and receive one open.
    if (rs.indexOf(id) > -1 && ss.indexOf(id) > -1) {
      // Send opens
      for (var k = 0; k < ss.length; k++) {
        var p = jiff_instance.open(shares[ss[k]], [ss[k]]);
        if (p != null && promise == null) {
          promise = p;
        }
      }
    }

    // sender, but not receiver, should get back the number, without sending any shares.
    if (ss.indexOf(id) > -1 && rs.indexOf(id) === -1) {
      promise = jiff_instance.receive_open(rs, threshold);
    }

    return promise.then(function (mpcResult) {
      // Assert both results are equal
      if (input.toString() !== mpcResult.toString()) {
        if (id === 1) {
          errors.push(errorMsg(t, id, ss, rs, input, mpcResult, numbers));
        }
      }/* else if (jiff_instance.id === 1) {
        console.log(myJoin(ss, numbers, ' : ') + ' @ ' + id + ' = ' + mpcResult.toString());
      }*/
    });
  } catch (err) {
    errors.push(err);
  }
}

// Run a batch of tests according to parallelism degree until all tests are consumed
function batchTest(jiff_instance, startIndex) {
  var t;
  var end = Math.min(startIndex + testParallel, inputs.length);

  // Reached the end
  if (startIndex >= end) {
    jiff_instance.disconnect(true, true);

    if (jiff_instance.id === 1) {
      var exception;
      if (errors.length > 0) {
        exception = Error('Failed Test: ' + test + '\n\t' + errors.join('\n\t'));
      }
      done(exception);
    }
    return;
  }

  // Keep going
  jiff_instance.start_barrier();
  for (t = startIndex; t < end; t++) {
    var promise = singleTest(jiff_instance, t);
    jiff_instance.add_to_barriers(promise);
  }
  jiff_instance.end_barrier(function () {
    batchTest(jiff_instance, t);
  });
}

// Default Computation Scheme
exports.compute = function (jiff_instance, _test, _inputs, _testParallel, _done) {
  errors = [];
  done = _done;
  test = _test;
  inputs = _inputs;
  testParallel = _testParallel;

  batchTest(jiff_instance, 0);
};