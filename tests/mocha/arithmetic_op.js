var jiff = require ("../../lib/jiff-client.js");

var jiff_instances = null;
var parties = 0;
var tests = [];
var has_failed = false;
var Zp = 15485867;
function mod(x, y) { if (x < 0) return (x % y) + y; return x % y; }

// Operation strings to "lambdas"
var operations = {
  "+" : function (operand1, operand2) {
    return mod(operand1 + operand2, Zp);
  },
  "add" : function (operand1, operand2) {
    return operand1.sadd(operand2);
  },
  "-" : function (operand1, operand2) {
    return mod(operand1 - operand2, Zp);
  },
  "sub" : function (operand1, operand2) {
    return operand1.ssub(operand2);
  },
  "*" : function (operand1, operand2) {
    return mod(operand1 * operand2, Zp);
  },
  "mult" : function (operand1, operand2) {
    return operand1.smult(operand2);
  },
  "mult_bgw" : function (operand1, operand2) {
    return operand1.smult_bgw(operand2);
  },
  "^" : function (operand1, operand2) {
    return operand1 ^ operand2;
  },
  "xor" : function (operand1, operand2) {
    return operand1.sxor_bit(operand2);
  },
  "/" : function (operand1, operand2) {
    return Math.floor(operand1 / operand2);
  },
  "div" : function (operand1, operand2) {
    return operand1.sdiv(operand2);
  },
};

// Maps MPC operation to its open dual
var dual = { "add": "+", "sub": "-", "mult": "*", "mult_bgw": "*", "xor": "^", "div": "/" };

// Entry Point
function run_test(computation_id, operation, callback) {
  // Generate Numbers
  for (var i = 0; i < 200; i++) {
    if(operation == "div") Zp = 2039;
    var m = operation == "xor" ? 2 : Zp;
    m = operation == "div" ? m-1 : m;
    var o = operation == "div" ? 1 : 0; // ensure not to divide by zero
    var num1 = Math.floor(Math.random() * Zp) % (m + o);
    var num2 = (Math.floor(Math.random() * Zp) % m) + o;
    var num3 = (Math.floor(Math.random() * Zp) % m) + o;
    tests[i] = [num1, num2, num3];
  }
  /*
  tests[0] = [1552, 213, 475];
  tests[1] = [92, 420, 121];
  */

  // Assign values to global variables
  parties = tests[0].length;
  computation_id = computation_id + "";

  var counter = 0;
  options = { party_count: parties, Zp: Zp };
  options.onConnect = function() { if(++counter == 3) test(callback, operation); };
  options.onError = function(error) { console.log(error); has_failed = true; };

  var jiff_instance1 = jiff.make_jiff("http://localhost:3000", computation_id, options);
  var jiff_instance2 = jiff.make_jiff("http://localhost:3000", computation_id, options);
  var jiff_instance3 = jiff.make_jiff("http://localhost:3000", computation_id, options);
  jiff_instances = [jiff_instance1, jiff_instance2, jiff_instance3];
}

// Run all tests after setup
function test(callback, mpc_operator) {
  open_operator = dual[mpc_operator];

  if(jiff_instances[0] == null || !jiff_instances[0].isReady()) { console.log("Please wait!"); return; }
  has_failed = false;

  // Run every test and accumelate all the promises
  var promises = [];
  var length = mpc_operator == "div" ? 5 : tests.length;
  for(var i = 0; i < length; i++) {
    for (var j = 0; j < jiff_instances.length; j++) {
      var promise = single_test(i, jiff_instances[j], mpc_operator, open_operator);
      promises.push(promise);
    }
  }

  // When all is done, check whether any failures were encountered
  Promise.all(promises).then(function() {
    for(var i = 0; i < jiff_instances.length; i++) jiff_instances[i].disconnect();
    jiff_instances = null;
    callback(!has_failed);
  });
}

// Run test case at index
function single_test(index, jiff_instance, mpc_operator, open_operator) {
  var numbers = tests[index];  
  var party_index = jiff_instance.id - 1;

  var threshold = 3;
  if(mpc_operator == "mult_bgw") threshold = Math.floor((3 - 1)/ 2) + 1;
  var shares = jiff_instance.share(numbers[party_index], threshold);

  // Apply operation on shares
  var res;
  var shares_list = [];
  for(var i = 1; i <= parties; i++) shares_list.push(shares[i]);

  if(mpc_operator == "div")
    res = operations[mpc_operator](shares_list[0], shares_list[1]);
  else
    res = shares_list.reduce(operations[mpc_operator]);

  var deferred = $.Deferred();
  res.open(function(result) { test_output(index, result, open_operator); deferred.resolve(); }, error);
  return deferred.promise();
}

// Determine if the output is correct
function test_output(index, result, open_operator) {
  var numbers = tests[index];

  // Apply operation in the open to test
  var res;
  if(open_operator == "/") res = operations[open_operator](numbers[0], numbers[1]);
  else res = numbers.reduce(operations[open_operator]);
  res = mod(res, Zp);

  // Incorrect result
  if(res != result) {
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
