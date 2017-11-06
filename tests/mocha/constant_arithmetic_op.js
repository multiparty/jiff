var jiff = require ("../../lib/jiff-client.js");

var jiff_instances = null;
var parties = 0;
var tests = [];
var has_failed = false;


var operations = {
    "+" : function (operand1, operand2) {
        return operand1 + operand2;
    },
    "add_cst" : function (operand1, operand2) {
        return operand1.add_cst(operand2);
    },
    "-" : function (operand1, operand2) {
        return operand1 - operand2;
    },
    "sub_cst" : function (operand1, operand2) {
        return operand1.sub_cst(operand2);
    },
    "*" : function (operand1, operand2) {
        return operand1 * operand2;
    },
    "mult_cst" : function (operand1, operand2) {
        return operand1.mult_cst(operand2);
    }

};

function dual_operation(operator) { //operator has to be add,sub,mult
  if(operator == "add_cst"){
    return "+";
  }else if(operator == "sub_cst"){
    return "-";
  }else if(operator == "mult_cst"){
    return "*";
  }
}


function apply_operation(list, operator) {
    return list.reduce(operations[operator]);
}


function run_test(computation_id, operation, callback) {

  for (var i = 0; i < 20; i++){
    var num1 = Math.floor(Math.random()*jiff.gZp/10);
    var num2 = Math.floor(Math.random()*jiff.gZp/10);
    var num3 = Math.floor(Math.random()*jiff.gZp/10);
    var num4 = Math.floor(Math.random()*jiff.gZp/10);
    tests[i] = [num1, num2, num3, num4];
  }

  parties = tests[0].length - 1;
  computation_id = computation_id + "";

  var counter = 0;
  options = { party_count: parties };
  options.onConnect = function() { counter++; if(counter == 3) test(callback, operation); };

  var jiff_instance1 = jiff.make_jiff("http://localhost:3000", computation_id, options);
  var jiff_instance2 = jiff.make_jiff("http://localhost:3000", computation_id, options);
  var jiff_instance3 = jiff.make_jiff("http://localhost:3000", computation_id, options);
  jiff_instances = [jiff_instance1, jiff_instance2, jiff_instance3];
}

// run all tests
function test(callback, operator) {

  op2 = dual_operation(operator); // +, - or *

  if(jiff_instances[0] == null || !jiff_instances[0].ready) { alert("Please wait!"); return; }
  has_failed = false;

  var promises = [];
  for(var i = 0; i < tests.length; i++) {
    for (var j = 0; j < jiff_instances.length; j++) {
      var promise = single_test(i, jiff_instances[j], operator, op2);
      promises.push(promise);
    }
  }

  Promise.all(promises).then(function() {
    callback(!has_failed);
  });
}

// run test case at index
function single_test(index, jiff_instance, operator, op2) {
  var numbers = tests[index];
  var c = numbers[numbers.length-1];

  var party_index = jiff_instance.id - 1;
  var shares = jiff_instance.share(numbers[party_index]);

  var promises = [];

  var tmp = function(i) {
    shares[i] = apply_operation([shares[i], c], operator);
    shares[i].open( function(result) { test_output(index, i, result, op2) }, error);
    if(shares[i].promise != null) promises.push(shares[i].promise);
  }

  for(var i = 1; i <= parties; i++)
    tmp(i);

  return Promise.all(promises);
}
// determine if the output is correct
function test_output(index, party, result, op2) {
  var numbers = tests[index];
  var c = numbers[numbers.length-1];
  var res = numbers[party - 1];

  res = apply_operation([res, c], op2);
  res = jiff.mod(res, jiff.gZp);

  if(res != result) { // sum is incorrect
    has_failed = true;
      console.log(""+party+" "+op2+"("+numbers.join(", ")+") = " + res + " != " +result + "");
  }
}

// register communication error
function error() {
  has_failed = true;
  console.log("Communication error");
}

module.exports = {
  run_test: run_test
};
