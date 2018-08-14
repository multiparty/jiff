// Chai 
var expect = require('chai').expect;
var assert = require('chai').assert;

var mpc = require('./mpc.js');
var numeric = require('numeric/numeric-1.2.6');
var math = require('mathjs');
math.import(numeric, {wrap: true, silent: true});

// Generic Testing Parameters
var party_count = 2; // must be 2 parties
var parallelismDegree = 1; // Max number of test cases running in parallel
var n = 1; // Number of test cases in total

// Parameters specific to this demo
var maxElement = 10;
var length = 3; // must be 3 dimensional arrays for now

/**
 * Generate sets of random vectors of size 3 for PCA.
 * Returns object with this format:
 * {
 *   'party_id': [ 'test1_input', 'test2_input', ...]
 * }
 */
function generateInputs(party_count) {
  var inputs = {};
  for (var i = 1; i <= party_count; i++)
    inputs[i] = [];

  for (var t = 0; t < n; t++) {
    for (var p = 1; p <= party_count; p++) {
      var arr = [];
      while (arr.length < length)
        arr.push(Math.floor(Math.random() * maxElement) + 1); // avoid zero

      inputs[p][t] = arr;
    }
  }
  return inputs;
}

/**
 * Helper functions for computation
 */
// get corresponding eigenvectors given sorted eigenvalues in descending order
function correspondingEig(eigenvalues, scatter_eig) {
  var result = [];

  var eigenvecs = numeric.transpose(scatter_eig.E.x);
  for (var i = 0; i < eigenvalues.length; i++) {
    //console.log(eigenvecs[scatter_eig.lambda.x.indexOf(eigenvalues[i])])
    result.push(eigenvecs[scatter_eig.lambda.x.indexOf(eigenvalues[i])]);
  }

  return result;
}

// computing aggregate mean vector for PCA
function computeMean(aggregate, party_count) {
  result = [];
  for (var i = 0; i < aggregate.length; i++) {
    result.push(aggregate[i] / party_count);
  }
  return result;
}

// element-wise addition of arrays of the same length
function addArrays(arr1, arr2) {
  result = [];
  for (var i = 0; i < arr1.length; i++) {
    result.push(arr1[i] + arr2[i]);
  }
  return result;
}

// element-wise subtraction of arrays of the same length
function subtractArrays(arr1, arr2) {
  result = [];
  for (var i = 0; i < arr1.length; i++) {
    result.push(arr1[i] - arr2[i]);
  }
  return result;
}

/**
 * Compute the expected results in the open (not under MPC).
 * @param {object} inputs - same format as generateInputs output.
 * Should return a single array with the expected result for every test in order
 *   [ 'test1_output', 'test2_output', ... ]
 */
function computeResults(inputs) {
  var results = [];

  for (var j = 0; j < n; j++) {

    // Get arrays of both parties for this test
    var party1 = inputs[1][j].slice();
    var party2 = inputs[2][j].slice();

    console.log("Party 1: ", inputs[1][j].slice());
    console.log("Party 2: ", inputs[2][j].slice());
    // PERFORM PCA IN THE OPEN
    // Add vectors to create shared vector V
    var aggregate_vector = addArrays(party1, party2);
    // console.log("Aggregate: ", aggregate_vector);

    // Compute mean vector
    var m_vec = computeMean(aggregate_vector, party_count);
    // console.log("Mean vector: ", m_vec);

    // Compute aggregate scatter matrix
    var diff = [subtractArrays(aggregate_vector, m_vec)];
    // console.log("diff: ", diff);
    var diff_T = numeric.transpose(diff);
    // console.log("diff_T: ", diff_T);
    var scatter = numeric.dot(diff_T, diff);
    // console.log("Scatter matrix: ", scatter);

    // Compute eigenvectors and eigenvalues of scatter matrix, which already happens in the open
    try {
      var scatter_eig = numeric.eig(scatter); // can be undefined!
    } catch (err) { console.log(err) }

    var sorted_eigenvalues = scatter_eig.lambda.x.sort((a,b) => b - a).slice(0, 2);

    // Get corresponding eigenvectors, related to eigenvalues
    var corresponding_largest_eigenvectors = correspondingEig(sorted_eigenvalues, scatter_eig);

    corresponding_largest_eigenvectors = numeric.transpose(corresponding_largest_eigenvectors);
    var pca_result = numeric.dot(party1, corresponding_largest_eigenvectors);

    results.push(pca_result);
  }

  return results;
}

/**
 * Perform tests.
 */
describe('Test', function() {
  this.timeout(0); // Remove timeout

  it('Exhaustive', function(done) {
    var count = 0;

    var inputs = generateInputs(party_count);
    var realResults = computeResults(inputs);
    console.log("Done computing real results.")

    var onConnect = function(jiff_instance) {
      console.log("Connected to JIFF.")
      var partyInputs = inputs[jiff_instance.id];

      var testResults = [];      
      (function one_test_case(j) {
        if(j < partyInputs.length) {
          var promises = [];
          for(var t = 0; t < parallelismDegree && (j + t) < partyInputs.length; t++)
            console.log("Computing test case under MPC...")
            promises.push(mpc.compute(partyInputs[j+t], function(){}, function () {}, jiff_instance));

            promises.then(function(v) {
              console.log("the result of PCA is:");
              console.log(v);
            });

            console.log("Promise pushed.")

          Promise.all(promises).then(function(parallelResults) {
            for(var t = 0; t < parallelResults.length; t++)
              testResults.push(parallelResults[t]);
              console.log("Pushed parallel results.")

            one_test_case(j+parallelismDegree);
          });

          return;
        }

        console.log("Checking for equality...")
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
