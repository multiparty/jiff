// Chai 
var expect = require('chai').expect;
var assert = require('chai').assert;

var mpc = require('./mpc.js');

// Generic Testing Parameters
var party_count = 2;
var parallelismDegree = 5; // Max number of test cases running in parallel
var n = 10;

// Parameters specific to this demo
var maxStackLength = 10;
var maxNeedleLength = 3;

/**
 * CHANGE THIS: Generate inputs for your tests
 * Should return an object with this format:
 * {
 *   'party_id': [ 'test1_input', 'test2_input', ...]
 * }
 */
function generateInputs(party_count) {
  var generateRandomString = function(length) {
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    for (var i = 0; i < length; i++)
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    return text;
  };

  var inputs = { 1: [], 2: [] };
  for (var i = 0; i < n; i++) {
    // Generate random haystack
    var length = Math.floor(Math.random() * maxStackLength) + 1;
    inputs[1][i] = generateRandomString(length);

    // Generate random needle
    var needleLength = Math.floor(Math.random() * maxNeedleLength) + 1;
    needleLength = needleLength > length ? length : needleLength;
    var needle = generateRandomString(needleLength);

    // with about 50% chance, use a random substring from haystack as a needle, to guarantee needle is found.
    var indexInHaystack = Math.random() * length * 2;
    if (indexInHaystack + needleLength <= length)
      needle = inputs[1][i].substring(indexInHaystack, indexInHaystack + needleLength);

    inputs[2][i] = needle;
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

  for (var j = 0; j < n; j++) {
    var singleCaseResults = [];

    var haystack = inputs[1][j];
    var needle = inputs[2][j];
    for (var i = 0; i + needle.length <= haystack.length; i++) {
      if (haystack.substring(i, i + needle.length) == needle)
        singleCaseResults.push(1);
      else
        singleCaseResults.push(0);    
    }

    results.push(singleCaseResults);
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
    
    var options = { party_count: party_count, onError: console.log, onConnect: onConnect };
    for(var i = 0; i < party_count; i++)
      mpc.connect("http://localhost:8080", "mocha-test", options);
  });
});
