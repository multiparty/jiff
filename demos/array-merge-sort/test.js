// Chai 
var assert = require('chai').assert;
var mpc = require('./mpc.js');

// Generic Testing Parameters
var party_count = 4;
var parallelismDegree = 3; // Max number of test cases running in parallel
var n = 8;

// Parameters specific to this demo
var maxElement = 13;
var maxLength = 16;

/**
 * CHANGE THIS: Generate inputs for your tests
 * Should return an object with this format:
 * {
 *   'party_id': [ 'test1_input', 'test2_input', ...]
 * }
 */
function generateInputs(party_count) {
  // merge sort works only for arrays with length that is a power of 2
  var lg = Math.log(maxLength)/Math.log(2) + 1;

  var inputs = {};
  for (var i = 1; i <= party_count; i++)
    inputs[i] = [];

  
  for (var t = 0; t < n; t++) {
    var pow = Math.floor(Math.random() * (lg-1) + 1);
    var length = Math.pow(2, pow);
    for (var p = 1; p <= party_count; p++) {  
      var arr = [];
      while (arr.length < length)
        arr.push(Math.floor(Math.random() * maxElement / party_count));

      inputs[p][t] = arr;
    }
  }

  return inputs;
}

/**
 * CHANGE THIS: Compute the expected results not in MPC
 * @param {object} inputs - same format as generateInputs output.
 * Should return a single array with the expected result for every test in order
 *   [ 'test1_output', 'test2_output', ... ]
 */
function computeResults(inputs) {
  var results = [];

  for (var t = 0; t < n; t++) {
    var array = inputs[1][t].slice(); // Shallow copy, so that when modifying things are not changed!

    for (var p = 2; p <= party_count; p++) {
      var tmp = inputs[p][t];
      for (var i = 0; i < array.length; i++)
        array[i] += tmp[i];
    }

    array = array.sort(function(a, b) { return a - b; });
    results.push(array);
  }

  return results;
}


/**
 * Do not change unless you have to.
 */
describe('Test', function() {
  this.timeout(0); // Remove timeout

  it('Exhaustive', function(done) {
    var count = 0;

    var inputs = generateInputs(party_count);
    var realResults = computeResults(inputs);

    var onConnect = function(jiff_instance) {
      var partyInputs = inputs[jiff_instance.id];

      var testResults = [];      
      (function one_test_case(j) {
        if (jiff_instance.id === 1) {
          console.log("\tStart ", j > partyInputs.length ? partyInputs.length : j, "/", partyInputs.length);
        }

        if(j < partyInputs.length) {
          var promises = [];
          for(var t = 0; t < parallelismDegree && (j + t) < partyInputs.length; t++)
            promises.push(mpc.compute(partyInputs[j+t], jiff_instance));

          Promise.all(promises).then(function(parallelResults) {
            for(var t = 0; t < parallelResults.length; t++)
              testResults.push(parallelResults[t]);

            one_test_case(j+parallelismDegree);
          });

          return;
        }

        // If we reached here, it means we are done
        count++;
        for (var i = 0; i < testResults.length; i++) {
          // construct debugging message
          var ithInputs = inputs[1][i] + "";
          for (var j = 2; j <= party_count; j++)
            ithInputs += "," + inputs[j][i];
          var msg = "Party: " + jiff_instance.id + ". inputs: [" + ithInputs + "]";

          // assert results are accurate
          try {
            assert.deepEqual(testResults[i], realResults[i], msg);
          } catch(assertionError) {
            done(assertionError);
            done = function(){}
          }
        }

        jiff_instance.disconnect();
        if (count == party_count)
          done();
      })(0);
    };
    
    var options = { party_count: party_count, onError: console.log, onConnect: onConnect, Zp: maxElement };
    for(var i = 0; i < party_count; i++)
      mpc.connect("http://localhost:8080", "mocha-test", options);
  });
});
