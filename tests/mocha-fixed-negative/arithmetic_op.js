var jiff = require('../../lib/jiff-client.js');
var jiffBigNumber = require('../../lib/ext/jiff-client-bignumber.js');
var jiffNegNumber = require('../../lib/ext/jiff-client-negativenumber.js');
var jiffFixedNumber = require('../../lib/ext/jiff-client-fixedpoint.js');
var BigNumber = require('bignumber.js');


var jiff_instances = null;
var parties = 0;
var tests = [];
var has_failed = false;
var Zp = new BigNumber(2).pow(45).minus(55);

var decimal_digits = 5;
var integer_digits = 5;//function mod(x, y) { if (x < 0) return x % y + y; return x.mod(y); }

// Operation strings to "lambdas"
var operations = {
  '+': function (operand1, operand2) {
    return new BigNumber(operand1.plus(operand2).toFixed(decimal_digits, BigNumber.ROUND_DOWN));
  },
  'add': function (operand1, operand2) {
    return operand1.sadd(operand2);
  },
  '-': function (operand1, operand2) {
    return new BigNumber(operand1.minus(operand2).toFixed(decimal_digits, BigNumber.ROUND_DOWN));
  },
  'sub': function (operand1, operand2) {
    return operand1.ssub(operand2);
  },
  '*': function (operand1, operand2) {
    return new BigNumber(operand1.times(operand2).toFixed(decimal_digits, BigNumber.ROUND_DOWN));
  },
  'mult': function (operand1, operand2) {
    return operand1.smult(operand2);
  },
  '^': function (operand1, operand2) {
    return operand1.eq(operand2) ? new BigNumber(0) : new BigNumber(1);
  },
  'xor': function (operand1, operand2) {
    return operand1.sxor_bit(operand2);
  },
  '|': function (operand1, operand2) {
    return operand1.eq(1) || operand2.eq(1) ? new BigNumber(1) : new BigNumber(0);
  },
  'or': function (operand1, operand2) {
    return operand1.sor_bit(operand2);
  },
  '/': function (operand1, operand2) {
    return new BigNumber(operand1.div(operand2).toFixed(decimal_digits, BigNumber.ROUND_DOWN));
  },
  'div': function (operand1, operand2) {
    return operand1.sdiv(operand2);
  }
};

// Maps MPC operation to its open dual
var dual = {'add': '+', 'sub': '-', 'mult': '*', 'xor': '^', 'div': '/'};

// Entry Point
function run_test(computation_id, operation, callback) {

  // Generate Numbers - make sure we generate both positive and negative numbers.
  for (var i = 0; i < 200; i++) {

    var total_magnitude = new BigNumber(10).pow(decimal_digits + integer_digits);
    var decimal_magnitude = new BigNumber(10).pow(decimal_digits);

    if (operation === 'mult') {
      var max_int = Math.floor(Math.cbrt(Math.pow(10, decimal_digits) - 1));
      total_magnitude = new BigNumber(max_int).times(decimal_magnitude);
    }

    if (operation === 'xor' || operation === 'or') {
      total_magnitude = 2;
      decimal_magnitude = 1;
    }

    var num1 = BigNumber.random().times(total_magnitude).div(2).floor().div(decimal_magnitude);
    num1 = Math.random() < 0.5 ? num1.times(-1) : num1;
    var num2 = BigNumber.random().times(total_magnitude).div(2).floor().div(decimal_magnitude);
    num2 = Math.random() < 0.5 ? num2.times(-1) : num2;
    var num3 = BigNumber.random().times(total_magnitude).div(2).floor().div(decimal_magnitude);
    num3 = Math.random() < 0.5 ? num3.times(-1) : num3;
    tests[i] = [num1, num2, num3];

  }

  // Assign values to global variables
  parties = tests[0].length;
  computation_id = computation_id + '';

  var counter = 0;
  options = {party_count: parties, Zp: Zp, autoConnect: false};
  options.onConnect = function () {
    if (++counter == 2) {
      test(callback, operation);
    }
  };
  options.onError = function (error) {
    console.log(error);
    has_failed = true;
  };

  var jiff_instance1 = jiffBigNumber.make_jiff(jiff.make_jiff('http://localhost:3004', computation_id, options));
  jiff_instance1 = jiffFixedNumber.make_jiff(jiff_instance1, {integer_digits: 5, decimal_digits: 5});
  jiff_instance1 = jiffNegNumber.make_jiff(jiff_instance1);
  var jiff_instance2 = jiffBigNumber.make_jiff(jiff.make_jiff('http://localhost:3004', computation_id, options));
  jiff_instance2 = jiffFixedNumber.make_jiff(jiff_instance2, {integer_digits: 5, decimal_digits: 5});
  jiff_instance2 = jiffNegNumber.make_jiff(jiff_instance2);
  var jiff_instance3 = jiffBigNumber.make_jiff(jiff.make_jiff('http://localhost:3004', computation_id, options));
  jiff_instance3 = jiffFixedNumber.make_jiff(jiff_instance3, {integer_digits: 5, decimal_digits: 5});
  jiff_instance3 = jiffNegNumber.make_jiff(jiff_instance3);
  jiff_instances = [jiff_instance1, jiff_instance2, jiff_instance3];
  jiff_instance1.connect();
  jiff_instance2.connect();
  jiff_instance3.connect();
}

// Run all tests after setup
function test(callback, mpc_operator) {
  open_operator = dual[mpc_operator];

  if (!jiff_instances[0] || !jiff_instances[0].isReady()) {
    console.log('Please wait!');
    return;
  }
  has_failed = false;

  // Run every test and accumelate all the promises
  var promises = [];
  var length = mpc_operator == 'div' ? 10 : tests.length;
  for (var i = 0; i < length; i++) {
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
  var shares_list = [];
  for (var i = 1; i <= parties; i++) {
    shares_list.push(shares[i]);
  }

  if (mpc_operator == 'div') {
    res = operations[mpc_operator](shares_list[0], shares_list[1]);
  } else {
    res = shares_list.reduce(operations[mpc_operator]);
  }

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
  var res;
  if (open_operator == '/') {
    res = operations[open_operator](numbers[0], numbers[1]);
  } else {
    res = numbers.reduce(operations[open_operator]);
  }

  // Incorrect result
  if (!(res.toString() == result.toString())) {
    has_failed = true;
    console.log(numbers.join(open_operator) + ' = ' + res + ' != ' + result);
  }
}

// Register Communication Error
function error() {
  has_failed = true;
  console.log("Communication error");
}

// Export API
module.exports = {
  run_test: run_test
};
