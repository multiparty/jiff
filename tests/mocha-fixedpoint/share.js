var jiff = require('../../lib/jiff-client.js');
var jiffBigNumber = require('../../lib/ext/jiff-client-bignumber.js');
var jiffFixedPoint = require('../../lib/ext/jiff-client-fixedpoint.js');
var BigNumber = require('bignumber.js');

var jiff_instances = [];
var parties = 0;
var tests = [];
var senders = [];
var receivers = [];
var has_failed = false;
var Zp = new BigNumber(32416190071);

var decimal_digits = 5;
var integer_digits = 5;

// Entry Point
function run_test(computation_id, callback) {
  // Generate Numbers
  for (var i = 0; i < 300; i++) {
    // Generate numbers
    var total_magnitude = new BigNumber(10).pow(decimal_digits + integer_digits);
    var decimal_magnitude = new BigNumber(10).pow(decimal_digits);

    var num1 = BigNumber.random().times(total_magnitude).floor().div(decimal_magnitude);
    var num2 = BigNumber.random().times(total_magnitude).floor().div(decimal_magnitude);
    var num3 = BigNumber.random().times(total_magnitude).floor().div(decimal_magnitude);
    var num4 = BigNumber.random().times(total_magnitude).floor().div(decimal_magnitude);

    // Generate thresholds
    var threshold = Math.ceil(Math.random() * 4);
    tests[i] = [num1, num2, num3, num4, threshold];

    var full_array = [];
    for (var k = 1; k <= 4; k++) {
      full_array.push(k);
    }

    // Generate how many receivers and senders
    var sn = Math.ceil(Math.random() * 4); // At least one sender, at most all.
    var rn = threshold + Math.floor(Math.random() * (4 - threshold)); // At least as many receivers as threshold.

    // Generate actual receivers and senders arrays
    senders[i] = full_array.slice();
    receivers[i] = full_array.slice();

    // remove random parties until proper counts are reached.
    while (senders[i].length > sn) {
      senders[i].splice(Math.floor(Math.random() * senders[i].length), 1);
    }
    while (receivers[i].length > rn) {
      receivers[i].splice(Math.floor(Math.random() * receivers[i].length), 1);
    }
  }

  // Assign values to global variables
  parties = tests[0].length - 1;
  computation_id = computation_id + '';

  var counter = 0;
  var options = {party_count: parties, Zp: Zp, autoConnect: false};
  options.onConnect = function () {
    if (++counter === parties) {
      test(callback);
    }
  };
  options.onError = function (error) {
    console.log(error);
    has_failed = true;
  };

  for (i = 0; i < parties; i++) {
    var jiff_instance = jiffBigNumber.make_jiff(jiff.make_jiff('http://localhost:3002', computation_id, options));
    jiff_instance = jiffFixedPoint.make_jiff(jiff_instance, {
      decimal_digits: decimal_digits,
      integer_digits: integer_digits
    });
    jiff_instances.push(jiff_instance);
    jiff_instance.connect();
  }
}

// Run all tests after setup
function test(callback) {
  if (!jiff_instances[0] || !jiff_instances[0].isReady()) {
    console.log('Please wait!');
    return;
  }
  has_failed = false;

  // Run every test and accumelate all the promises
  var promises = [];
  for (var i = 0; i < tests.length; i++) {
    for (var j = 0; j < jiff_instances.length; j++) {
      var promise = single_test(i, jiff_instances[j]);
      if (promise !== null) {
        promises.push(promise);
      }
    }
  }

  // When all is done, check whether any failures were encountered
  Promise.all(promises).then(function () {
    for (var i = 0; i < jiff_instances.length; i++) {
      jiff_instances[i].disconnect();
    }
    jiff_instances = null;
    callback(!has_failed);
  });
}

// Run test case at index
function single_test(index, jiff_instance) {
  var numbers = tests[index];
  var party_index = jiff_instance.id - 1;

  var threshold = numbers[parties];
  var rs = receivers[index];
  var ss = senders[index];

  var deferred,
    promise;

  // Share
  var shares = jiff_instance.share(numbers[party_index], threshold, rs, ss);

  // Nothing to do.
  if (ss.indexOf(jiff_instance.id) === -1 && rs.indexOf(jiff_instance.id) === -1) {
    return null;
  }

  // receiver but not sender, must send open shares of each number to its owner.
  if (rs.indexOf(jiff_instance.id) > -1 && ss.indexOf(jiff_instance.id) === -1) {
    deferred = $.Deferred();
    promise = deferred.promise();

    // Send opens
    for (var i = 0; i < ss.length; i++) {
      jiff_instance.open(shares[ss[i]], [ss[i]]);
    }

    return null;
  }

  // receiver and sender, must send open shares of each number to its owner, and receive one open.
  if (rs.indexOf(jiff_instance.id) > -1 && ss.indexOf(jiff_instance.id) > -1) {
    deferred = $.Deferred();
    promise = deferred.promise();

    var promises = [];

    // Send opens
    for (i = 0; i < ss.length; i++) {
      var p = jiff_instance.open(shares[ss[i]], [ss[i]]);
      if (p) {
        promises.push(p);
      }
    }

    // Will have exactly one promise, belonging to the opening of the share
    // initially sent by this party.
    promises[0].then(function (result) {
      test_output(jiff_instance, index, jiff_instance.id, result);
      deferred.resolve();
    });

    return promise;
  }


  // sender, but not receiver, should get back the number, without sending any shares.
  if (ss.indexOf(jiff_instance.id) > -1 && rs.indexOf(jiff_instance.id) === -1) {
    deferred = $.Deferred();
    promise = deferred.promise();

    jiff_instance.receive_open(rs, threshold).then(function (result) {
      test_output(jiff_instance, index, jiff_instance.id, result);
      deferred.resolve();
    });

    return promise;
  }
}

// Determine if the output is correct
function test_output(jiff_instance, test_index, party_index, result) {
  var numbers = tests[test_index];
  var real = numbers[party_index - 1];

  // Apply operation in the open to test
  if (!(real.eq(result))) {
    has_failed = true;
    console.log('Party: ' + party_index + '. Threshold: ' + numbers[parties] + ': ' + real + ' != ' + result);
  }
}

// Export API
module.exports = {
  run_test: run_test
};
