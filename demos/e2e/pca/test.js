// Chai
var assert = require('chai').assert;

var mpc = require('./mpc.js');
var numeric = require('numeric/numeric-1.2.6');
var math = require('mathjs');
math.import(numeric, {wrap: true, silent: true});

var showProgress = true;

// Generic Testing Parameters
var party_count = 2; // must be 2 parties
var parallelismDegree = 1; // Max number of test cases running in parallel
var n = 1; // Number of test cases in total

// Parameters specific to this demo
var maxElement = 10;
var length = 3; // must be 3 dimensional arrays for now
var Zp = null;

/**
 * Generate sets of random vectors of size 3 for PCA.
 * Returns object with this format:
 * {
 *   'party_id': [ 'test1_input', 'test2_input', ...]
 * }
 */
function generateInputs(party_count) {
  var inputs = {};
  for (var i = 1; i <= party_count; i++) {
    inputs[i] = [];
  }

  for (var t = 0; t < n; t++) {
    for (var p = 1; p <= party_count; p++) {
      var arr = [];
      while (arr.length < length) {
        arr.push(Math.floor(Math.random() * maxElement) + 1);
      } // avoid zero

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
  var result = [];
  for (var i = 0; i < aggregate.length; i++) {
    result.push(aggregate[i] / party_count);
  }
  return result;
}

// element-wise addition of arrays of the same length
function addArrays(arr1, arr2) {
  var result = [];
  for (var i = 0; i < arr1.length; i++) {
    result.push(arr1[i] + arr2[i]);
  }
  return result;
}

// element-wise subtraction of arrays of the same length
function subtractArrays(arr1, arr2) {
  var result = [];
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

    console.log('Party 1: ', inputs[1][j].slice());
    console.log('Party 2: ', inputs[2][j].slice());
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
    } catch (err) {
      console.log(err)
    }

    var sorted_eigenvalues = scatter_eig.lambda.x.sort(function (a, b) {
      return (b - a).slice(0, 2);
    });

    // Get corresponding eigenvectors, related to eigenvalues
    var corresponding_largest_eigenvectors = correspondingEig(sorted_eigenvalues, scatter_eig);

    corresponding_largest_eigenvectors = numeric.transpose(corresponding_largest_eigenvectors);
    var pca_result = numeric.dot(party1, corresponding_largest_eigenvectors);

    results.push(pca_result);
  }

  return results;
}


/**
 * Do not change unless you have to.
 */
// eslint-disable-next-line no-undef
describe('Test', function () {
  this.timeout(0); // Remove timeout

  // eslint-disable-next-line no-undef
  it('Exhaustive', function (done) {
    var count = 0;

    var inputs = generateInputs(party_count);
    var realResults = computeResults(inputs);

    var onConnect = function (jiff_instance) {
      var partyInputs = inputs[jiff_instance.id];

      var testResults = [];
      (function one_test_case(j) {
        if (jiff_instance.id === 1 && showProgress) {
          console.log('\tStart ', j > partyInputs.length ? partyInputs.length : j, '/', partyInputs.length);
        }

        if (j < partyInputs.length) {
          var promises = [];
          for (var t = 0; t < parallelismDegree && (j + t) < partyInputs.length; t++) {
            promises.push(mpc.compute(partyInputs[j + t], jiff_instance));
          }

          Promise.all(promises).then(function (parallelResults) {
            for (var t = 0; t < parallelResults.length; t++) {
              testResults.push(parallelResults[t]);
            }

            one_test_case(j+parallelismDegree);
          });

          return;
        }

        // If we reached here, it means we are done
        count++;
        for (var i = 0; i < testResults.length; i++) {
          // construct debugging message
          var ithInputs = inputs[1][i] + '';
          for (var p = 2; p <= party_count; p++) {
            ithInputs += ',' + inputs[p][i];
          }
          var msg = 'Party: ' + jiff_instance.id + '. inputs: [' + ithInputs + ']';

          // assert results are accurate
          try {
            assert.deepEqual(testResults[i].toString(), realResults[i].toString(), msg);
          } catch (assertionError) {
            done(assertionError);
            done = function () { };
          }
        }

        jiff_instance.disconnect(true);
        if (count === party_count) {
          done();
        }
      })(0);
    };

    var options = { party_count: party_count, onError: console.log, onConnect: onConnect, Zp: Zp, crypto_provider: true };
    for (var i = 0; i < party_count; i++) {
      mpc.connect('http://localhost:8080', 'mocha-test', options);
    }
  });
});
