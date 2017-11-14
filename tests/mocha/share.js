var jiff = require ("../../lib/jiff-client.js");

var jiff_instances = null;
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
    tests[i] = [num1, num2, num3];
  }

  // Assign values to global variables
  parties = tests[0].length;
  computation_id = computation_id + "";

  var counter = 0;
  options = { party_count: parties };
  options.onConnect = function() { if(++counter == 3) test(callback); };
  options.onError = function(error) { console.log(error); has_failed = true; };

  var jiff_instance1 = jiff.make_jiff("http://localhost:3000", computation_id, options);
  var jiff_instance2 = jiff.make_jiff("http://localhost:3000", computation_id, options);
  var jiff_instance3 = jiff.make_jiff("http://localhost:3000", computation_id, options);
  jiff_instances = [jiff_instance1, jiff_instance2, jiff_instance3];
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
  var shares = jiff_instance.share(numbers[party_index]);

  // Apply operation on shares
  var promises = [];
  for(var i = 1; i <= parties; i++){
    var deferred = $.Deferred();
    promises.push(deferred.promise());
    (function(i, d) {shares[i].open(function(result) { test_output(numbers[i-1], result); d.resolve(); }, error);})(i, deferred);
  }
  return Promise.all(promises);
}

// Determine if the output is correct
function test_output(real, result) {
  // Apply operation in the open to test
  if(real != result) {
    has_failed = true;
    console.log(real+ " != " + result);
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
