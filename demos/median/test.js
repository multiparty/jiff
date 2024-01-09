var assert = require('chai').assert;
var mpc = require('./mpc.js');

// Test parameters
var party_count = 4;
var test_cases = 10; // Number of test cases

// Function to generate test inputs
function generateInputs(party_count) {
  var inputs = {};
  for (var i = 1; i <= party_count; i++) {
    inputs[i] = [];
    for (var t = 0; t < test_cases; t++) {
      // Generate arrays of random lengths with random numbers
      var length = Math.floor(Math.random() * 10) + 1; // Random length from 1 to 10
      var arr = Array.from({ length }, () => Math.floor(Math.random() * 100));
      inputs[i].push(arr);
    }
  }
  return inputs;
}

// Function to manually compute expected medians
function computeResults(inputs) {
  var results = [];
  for (var t = 0; t < test_cases; t++) {
    // Sum arrays element-wise and sort
    var sumArray = inputs[1][t].slice();
    for (var p = 2; p <= party_count; p++) {
      for (var i = 0; i < sumArray.length; i++) {
        sumArray[i] += inputs[p][t][i];
      }
    }
    sumArray.sort((a, b) => a - b);

    // Compute median
    var mid = Math.floor(sumArray.length / 2);
    var median = sumArray.length % 2 !== 0 ? sumArray[mid] : (sumArray[mid - 1] + sumArray[mid]) / 2;
    results.push(median);
  }
  return results;
}

describe('MPC Bubble Sort Median Test', function () {
  it('should compute the correct median for each test case', function (done) {
    this.timeout(0); // Disable timeout
    var inputs = generateInputs(party_count);
    var expectedResults = computeResults(inputs);

    // Connect to the server and run tests
    mpc.connect('http://localhost:8080', 'test', { 
      party_count: party_count,
      onConnect: function (jiff_instance) {
        var promises = inputs[jiff_instance.id].map(input => mpc.compute(input, jiff_instance));
        Promise.all(promises).then(function (computedResults) {
          for (var i = 0; i < computedResults.length; i++) {
            assert.strictEqual(computedResults[i], expectedResults[i], `Test case ${i + 1} failed`);
          }
          jiff_instance.disconnect();
          done();
        });
      }
    });
  });
});
