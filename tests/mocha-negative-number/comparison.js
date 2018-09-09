var jiff = require('../../lib/jiff-client.js');
var jiffNegNumber = require('../../lib/ext/jiff-client-negativenumber.js');

var jiff_instances = null;
var parties = 0;
var tests = [];
var has_failed = false;
var Zp = 32749;

// Operation strings to "lambdas"
var operations = {
  '<': function (operand1, operand2) {
    return operand1 < operand2;
  },
  'less': function (operand1, operand2) {
    return operand1.slt(operand2);
  },
  '<=': function (operand1, operand2) {
    return operand1 <= operand2;
  },
  'less_or_equal': function (operand1, operand2) {
    return operand1.slteq(operand2);
  },
  '>': function (operand1, operand2) {
    return operand1 > operand2;
  },
  'greater': function (operand1, operand2) {
    return operand1.sgt(operand2);
  },
  '>=': function (operand1, operand2) {
    return operand1 >= operand2;
  },
  'greater_or_equal': function (operand1, operand2) {
    return operand1.sgteq(operand2);
  },
  '==': function (operand1, operand2) {
    return operand1 === operand2;
  },
  'eq': function (operand1, operand2) {
    return operand1.seq(operand2);
  },
  '!=': function (operand1, operand2) {
    return operand1 !== operand2;
  },
  'neq': function (operand1, operand2) {
    return operand1.sneq(operand2);
  }
};

// Maps MPC operation to its open dual
var dual = {less: '<', less_or_equal: '<=', greater: '>', greater_or_equal: '>=', eq: '==', neq: '!='};

// Entry Point
function run_test(computation_id, operation, callback) {
  // Generate Numbers
  for (var i = 0; i < 20; i++) {
    tests[i] = [];

    for (var p = 0; p < 3; p++) {
      // ensure numbers wont wrap around
      var max = Zp;
      var offset = max / 2;

      var randnum = Math.floor(Math.random() * max - offset);
      tests[i].push(randnum);
    }
  }

  // Assign values to global variables
  parties = tests[0].length;
  computation_id = computation_id + '';

  var counter = 0;
  var options = {party_count: parties, Zp: Zp, autoConnect: false};
  options.onConnect = function () {
    if (++counter === 3) {
      test(callback, operation);
    }
  };
  options.onError = function (error) {
    console.log(error);
    has_failed = true;
  };

  var jiff_instance1 = jiffNegNumber.make_jiff(jiff.make_jiff('http://localhost:3003', computation_id, options));
  var jiff_instance2 = jiffNegNumber.make_jiff(jiff.make_jiff('http://localhost:3003', computation_id, options));
  var jiff_instance3 = jiffNegNumber.make_jiff(jiff.make_jiff('http://localhost:3003', computation_id, options));
  jiff_instances = [jiff_instance1, jiff_instance2, jiff_instance3];
  jiff_instance1.connect();
  jiff_instance2.connect();
  jiff_instance3.connect();
}

// Run all tests after setup
function test(callback, mpc_operator) {
  var open_operator = dual[mpc_operator];

  if (!jiff_instances[0] || !jiff_instances[0].isReady()) {
    console.log('Please wait!');
    return;
  }
  has_failed = false;

  // Run every test and accumelate all the promises
  var promises = [];
  for (var i = 0; i < tests.length; i++) {
    for (var j = 0; j < jiff_instances.length; j++) {
      var promise = single_test(i, jiff_instances[j], mpc_operator, open_operator);
      promises.push(promise);
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
function single_test(index, jiff_instance, mpc_operator, open_operator) {
  var numbers = tests[index];
  var party_index = jiff_instance.id - 1;
  var shares = jiff_instance.share(numbers[party_index]);

  // Apply operation on shares
  var res = operations[mpc_operator](shares[1], shares[2]);

  var deferred = $.Deferred();
  res.open().then(function (result) {
    test_output(index, result, open_operator);
    deferred.resolve();
  }, error);
  return deferred.promise();
}

// Determine if the output is correct
function test_output(index, result, open_operator) {
  var numbers = tests[index];

  // Apply operation in the open to test
  var res = operations[open_operator](numbers[0], numbers[1]);
  res = res ? 1 : 0;

  // Incorrect result
  if (res !== result) {
    has_failed = true;
    console.log(numbers[0] + open_operator + numbers[1] + ' != ' + result);
  }
}

// Register Communication Error
function error() {
  has_failed = true;
  console.log('Communication error');
}

// Export API
module.exports = {
  run_test: run_test
};
