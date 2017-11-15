var jiff = require ("../../lib/jiff-client.js");

var jiff_instances = [];
var parties = 0;
var tests = [];
var has_failed = false;

// Entry Point
function run_test(computation_id, callback) {
  // Generate Numbers
  for (var i = 0; i < 20; i++) {
    var num1 = Math.floor(Math.random() * jiff.gZp / 10);
    var num2 = Math.floor(Math.random() * jiff.gZp / 10);
    var num3 = Math.floor(Math.random() * jiff.gZp / 10);
    var num4 = Math.floor(Math.random() * jiff.gZp / 10);
    var threshold = Math.ceil(Math.random() * 4);
    tests[i] = [num1, num2, num3, num4, threshold];
  }

  // Assign values to global variables
  parties = tests[0].length - 1;
  computation_id = computation_id + "";

  var counter = 0;
  options = { party_count: parties };
  options.onConnect = function() { if(++counter == parties) test(callback); };
  options.onError = function(error) { console.log(error); has_failed = true; };

  for(var i = 0; i < parties; i++) {
    var jiff_instance = jiff.make_jiff("http://localhost:3000", computation_id, options);
    jiff_instances.push(jiff_instance);
  }
}

// Run all tests after setup
function test(callback) {

  if(jiff_instances[0] == null || !jiff_instances[0].ready) { console.log("Please wait!"); return; }
  has_failed = false;

  // Run every test and accumelate all the promises
  var promises = [];
  for(var i = 0; i < tests.length; i++) {
    for (var j = 0; j < jiff_instances.length; j++) {
      var promise = single_test(i, jiff_instances[j]);
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
function single_test(index, jiff_instance) {
  var numbers = tests[index];
  var party_index = jiff_instance.id - 1;
  var threshold = numbers[parties];
  var shares = jiff_instance.share(numbers[party_index], threshold);
  
  // Apply operation on shares
  var promises = [];
  for(var i = 1; i <= parties; i++){
    var deferred = $.Deferred();
    promises.push(deferred.promise());
    (function(i, d) {shares[i].open(function(result) { test_output(index, i, result); d.resolve(); }, error);})(i, deferred);
  }
  return Promise.all(promises);
}

// Determine if the output is correct
function test_output(test_index, party_index, result) {
  var numbers = tests[test_index];
  var real = numbers[party_index - 1];
  
  // Apply operation in the open to test
  if(real != result) {
    has_failed = true;
    console.log("Party: " + party_index + ". Threshold: " + numbers[parties] + ": " + real + " != " + result);
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
