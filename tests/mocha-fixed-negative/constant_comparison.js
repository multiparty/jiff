var jiff = require('../../lib/jiff-client.js');
var jiffBigNumber = require('../../lib/ext/jiff-client-bignumber.js');
var jiffFixedPoint = require('../../lib/ext/jiff-client-fixedpoint.js');
var jiffNegNumber = require('../../lib/ext/jiff-client-negativenumber.js');

var BigNumber = require('bignumber.js');

var jiff_instances = null;
var parties = 0;
var tests = [];
var has_failed = false;
var Zp = new BigNumber(32416190071);

var decimal_digits = 4;
var integer_digits = 4;

// Operation strings to "lambdas"
var operations = {
  '<': function (operand1, operand2) {
    return operand1.lt(operand2);
  },
  'less_cst': function (operand1, operand2) {
    return operand1.clt(operand2);
  },
  '<=': function (operand1, operand2) {
    return operand1.lte(operand2);
  },
  'less_or_equal_cst': function (operand1, operand2) {
    return operand1.clteq(operand2);
  },
  '>': function (operand1, operand2) {
    return operand1.gt(operand2);
  },
  'greater_cst': function (operand1, operand2) {
    return operand1.cgt(operand2);
  },
  '>=': function (operand1, operand2) {
    return operand1.gte(operand2);
  },
  'greater_or_equal_cst': function (operand1, operand2) {
    return operand1.cgteq(operand2);
  },
  '==': function (operand1, operand2) {
    return operand1.eq(operand2);
  },
  'eq_cst': function (operand1, operand2) {
    return operand1.ceq(operand2);
  },
  '!=': function (operand1, operand2) {
    return !operand1.eq(operand2);
  },
  'neq_cst': function (operand1, operand2) {
    return operand1.cneq(operand2);
  }
};

// Maps MPC operation to its open dual
var dual = {less: '<', less_or_equal: '<=', greater: '>', greater_or_equal: '>=', eq: '==', neq: '!='};

// Entry Point
function run_test(computation_id, operation, callback) {
  // Generate Numbers
  for (var i = 0; i < 5; i++) {
    var total_magnitude = new BigNumber(10).pow(decimal_digits + integer_digits);
    var decimal_magnitude = new BigNumber(10).pow(decimal_digits);

    var num1 = BigNumber.random().times(total_magnitude).floor().div(decimal_magnitude);
    var num2 = BigNumber.random().times(total_magnitude).floor().div(decimal_magnitude);
    var num3 = BigNumber.random().times(total_magnitude).floor().div(decimal_magnitude);
    tests[i] = [num1, num2, num3];
    for (var k = 0; k < tests[i].length; k++) {
      if (Math.random() < 0.5) {
        tests[i][k] = tests[i][k].times(-1);
      }
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

  var jiff_instance1 = jiffBigNumber.make_jiff(jiff.make_jiff('http://localhost:3002', computation_id, options));
  jiff_instance1 = jiffFixedPoint.make_jiff(jiff_instance1, {
    decimal_digits: decimal_digits,
    integer_digits: integer_digits
  });
  jiff_instance1 = jiffNegNumber.make_jiff(jiff_instance1);

  var jiff_instance2 = jiffBigNumber.make_jiff(jiff.make_jiff('http://localhost:3002', computation_id, options));
  jiff_instance2 = jiffFixedPoint.make_jiff(jiff_instance2, {
    decimal_digits: decimal_digits,
    integer_digits: integer_digits
  });
  jiff_instance2 = jiffNegNumber.make_jiff(jiff_instance2);

  var jiff_instance3 = jiffBigNumber.make_jiff(jiff.make_jiff('http://localhost:3002', computation_id, options));
  jiff_instance3 = jiffFixedPoint.make_jiff(jiff_instance3, {
    decimal_digits: decimal_digits,
    integer_digits: integer_digits
  });
  jiff_instance3 = jiffNegNumber.make_jiff(jiff_instance3);

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
  (function do_test(i) {
    if (i >= tests.length) {
      // When all is done, check whether any failures were encountered
      Promise.all(promises).then(function () {
        for (var i = 0; i < jiff_instances.length; i++) {
          jiff_instances[i].disconnect();
        }
        jiff_instances = null;
        callback(!has_failed);
      });

      return;
    }

    var iteration = [];
    for (var j = 0; j < jiff_instances.length; j++) {
      var promise = single_test(i, jiff_instances[j], mpc_operator, open_operator);
      promises.push(promise);
      iteration.push(promise);
    }

    Promise.all(iteration).then(function () {
      do_test(i + 1);
    });
  })(0);
}

// Run test case at index
function single_test(index, jiff_instance, mpc_operator, open_operator) {
  var numbers = tests[index];
  var party_index = jiff_instance.id - 1;
  var shares = jiff_instance.share(numbers[party_index]);

  // Apply operation on shares
  var res = operations[mpc_operator](shares[1], shares[2]);

  var deferred = $.Deferred();
  res.open(function (result) {
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
  res = res ? new BigNumber(1) : new BigNumber(0);

  // Incorrect result
  if (!(res.eq(result))) {
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
