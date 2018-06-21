var jiff = require ("../../lib/jiff-client.js");
var jiffBigNumber = require ("../../lib/ext/jiff-client-bignumber.js");
var jiffFixedPoint = require ("../../lib/ext/jiff-client-fixedpoint.js");
var BigNumber = require('bignumber.js');

var jiff_instances = null;
var parties = 0;
var tests = [];
var has_failed = false;
var Zp = new BigNumber(2).pow(51).minus(129);

var decimal_digits = 5;
var integer_digits = 5;
function mod(x, y) {
  var decimal_magnitude = new BigNumber(10).pow(decimal_digits);

  x = x.times(decimal_magnitude); 
  if (x.isNeg()) return x.mod(y).plus(y).div(decimal_magnitude); 
  return x.mod(y).div(decimal_magnitude);
}

// Operation strings to "lambdas"
var operations = {
  "+" : function (operand1, operand2) {
    return new BigNumber(operand1.plus(operand2).toFixed(decimal_digits, BigNumber.ROUND_DOWN));
  },
  "add_cst" : function (operand1, operand2) {
    return operand1.cadd(operand2);
  },
  "-" : function (operand1, operand2) {
    return new BigNumber(operand1.minus(operand2).toFixed(decimal_digits, BigNumber.ROUND_DOWN));
  },
  "sub_cst" : function (operand1, operand2) {
    return operand1.csub(operand2);
  },
  "*" : function (operand1, operand2) {
    return new BigNumber(operand1.times(operand2).toFixed(decimal_digits, BigNumber.ROUND_DOWN));
  },
  "mult_cst" : function (operand1, operand2) {
    return operand1.cmult(operand2);
  },
  "^" : function (operand1, operand2) {
    return operand1.eq(operand2) ? new BigNumber(0) : new BigNumber(1);
  },
  "xor_cst" : function (operand1, operand2) {
    return operand1.cxor_bit(operand2);
  },
  "|" : function (operand1, operand2) {
    return operand1.eq(1) || operand2.eq(1) ? new BigNumber(1) : new BigNumber(0);
  },
  "or_cst" : function (operand1, operand2) {
    return operand1.cor_bit(operand2);
  },
  "/" : function (operand1, operand2) {
    return new BigNumber(operand1.div(operand2).toFixed(decimal_digits, BigNumber.ROUND_DOWN));
  },
  "div_cst" : function (operand1, operand2) {
    return operand1.cdiv(operand2);
  },
};

// Maps MPC operation to its open dual
var dual = { "add_cst": "+", "sub_cst": "-", "mult_cst": "*", "xor_cst": "^", "or_cst": "|", "div_cst": "/" };

// Entry Point
function run_test(computation_id, operation, callback) {
  // Generate Numbers
  for (var i = 0; i < 200; i++) {
    var total_magnitude = new BigNumber(10).pow(decimal_digits + integer_digits);
    var decimal_magnitude = new BigNumber(10).pow(decimal_digits);

    if(operation == "mult_cst") {
      var max_int = Math.floor(Math.sqrt(Math.pow(10, decimal_digits) - 1));
      total_magnitude = new BigNumber(max_int).times(decimal_magnitude);
    }

    if(operation == "xor_cst" || operation == "or_cst") {
      total_magnitude = 2;
      decimal_magnitude = 1;
    }

    var num1 = BigNumber.random().times(total_magnitude).floor().div(decimal_magnitude);
    var num2 = BigNumber.random().times(total_magnitude).floor().div(decimal_magnitude);
    var num3 = BigNumber.random().times(total_magnitude).floor().div(decimal_magnitude);
    tests[i] = [num1, num2, num3];
  }

  // Assign values to global variables
  parties = tests[0].length;
  computation_id = computation_id + "";

  var counter = 0;
  options = { party_count: parties, Zp: Zp, autoConnect: false };
  options.onConnect = function() { if(++counter == 3) test(callback, operation); };
  options.onError = function(error) { console.log(error); has_failed = true; };

  // Create Instances
  var jiff_instance1 = jiffBigNumber.make_jiff(jiff.make_jiff("http://localhost:3002", computation_id, options));
  jiff_instance1 = jiffFixedPoint.make_jiff(jiff_instance1, {decimal_digits: decimal_digits, integer_digits: integer_digits});
  
  var jiff_instance2 = jiffBigNumber.make_jiff(jiff.make_jiff("http://localhost:3002", computation_id, options));
  jiff_instance2 = jiffFixedPoint.make_jiff(jiff_instance2, {decimal_digits: decimal_digits, integer_digits: integer_digits});

  var jiff_instance3 = jiffBigNumber.make_jiff(jiff.make_jiff("http://localhost:3002", computation_id, options));
  jiff_instance3 = jiffFixedPoint.make_jiff(jiff_instance3, {decimal_digits: decimal_digits, integer_digits: integer_digits});

  jiff_instances = [jiff_instance1, jiff_instance2, jiff_instance3];
  jiff_instance1.connect();
  jiff_instance2.connect();
  jiff_instance3.connect();
}

// Run all tests after setup
function test(callback, mpc_operator) {
  var open_operator = dual[mpc_operator];

  if(jiff_instances[0] == null || !jiff_instances[0].isReady()) { console.log("Please wait!"); return; }
  has_failed = false;

  // Run every test and accumelate all the promises
  var promises = [];
  var length = mpc_operator == "div_cst" ? 10 : tests.length;
  length = mpc_operator == "mult_cst" ? 10 : length;
  
  (function do_test(i) {
    if(i >= length) {
      // When all is done, check whether any failures were encountered
      Promise.all(promises).then(function() {
        for(var i = 0; i < jiff_instances.length; i++) jiff_instances[i].disconnect();
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

    Promise.all(iteration).then(function() { do_test(i+1); });
  })(0);
}

// Run test case at index
function single_test(index, jiff_instance, mpc_operator, open_operator) {
  var numbers = tests[index];
  var party_index = jiff_instance.id - 1;
  var shares = jiff_instance.share(numbers[party_index]);

  // Apply operation on shares
  var res = operations[mpc_operator](shares[1], numbers[1]);

  var deferred = $.Deferred();
  res.open(function(result) { test_output(index, result, open_operator); deferred.resolve(); }, error);
  return deferred.promise();
}

// Determine if the output is correct
function test_output(index, result, open_operator) {
  var numbers = tests[index];

  // Apply operation in the open to test

  var res = operations[open_operator](numbers[0], numbers[1]);
  res = mod(res, Zp);

  // Incorrect result
  if(!(res.eq(result))) {
    has_failed = true;
    console.log(numbers.join(open_operator) + " = " + res + " != " + result);
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
