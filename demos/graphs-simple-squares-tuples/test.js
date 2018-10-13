// Chai
// var expect = require('chai').expect;
var assert = require('chai').assert;

var mpc = require('./mpc.js');

var showProgress = true;

// Generic Testing Parameters
var party_count = 3;
var parallelismDegree = 5; // Max number of test cases running in parallel
var n = 1; // Number of test cases in total
var minimumNumberOfTuples = 5;
var maximumNumberOfTuples = 10;
var Zp = null;

// The limits of the graph.
var minX = 0;
var maxX = 100;
var minY = 0;
var maxY = 100;

var randomInRange = function (min, max) {
  Math.floor(Math.random()*(max - min + 1) + min);
};

var mapTuplesToTwoArrays = function (tuples) {
  var r = { x:[], y:[] };
  tuples.forEach(function (tuple) {
    r.x.push(tuple.x);
    r.y.push(tuple.y);
  });
  return r;
};

function leastSquaresCalculator(values_x, values_y) {
  var sum_x = 0;
  var sum_y = 0;
  var sum_xy = 0;
  var sum_xx = 0;
  var count = 0;

  /*
  * We'll use those variables for faster read/write access.
  */
  var x = 0;
  var y = 0;
  var values_length = values_x.length;

  if (values_length !== values_y.length) {
    throw new Error('The parameters values_x and values_y need to have same size!');
  }
  if (values_length === 0) {
    return [ [], [] ];
  }

  /*
  * Calculate the sum for each of the parts necessary.
  */
  for (var v = 0; v < values_length; v++) {
    x = values_x[v];
    y = values_y[v];
    sum_x += x;
    sum_y += y;
    sum_xx += x*x;
    sum_xy += x*y;
    count++;
  }

  /*
  * Calculate m and b for the formular:
  * y = x * m + b
  */
  var m = (count*sum_xy - sum_x*sum_y) / (count*sum_xx - sum_x*sum_x);
  var b = (sum_y/count) - (m*sum_x)/count;

  return {m:m, b:b};
}

// Parameters specific to this demo
/* PUT PARAMETERS HERE */

/**
 * CHANGE THIS: Generate inputs for your tests
 * Should return an object with this format:
 * {
 *   'party_id': [ 'test1_input', 'test2_input', ...]
 * }
 */
function generateInputs(party_count) {
  var inputs = {};

  var i;
  for (i = 1; i <= party_count; i++) {
    inputs[i] = [];
  }

  // Generate test cases one at a time
  for (var t = 0; t < n; t++) {
    var numberOfTuples = randomInRange(minimumNumberOfTuples, maximumNumberOfTuples);
    var testCase = {};
    for (i = 1; i <= party_count; i++) {
      testCase[i] = [];
    }
    var tuples;
    do { //restrict generated test cases to positive m and b. Should be removed after adding the -ve numbers ext.
      tuples = [];
      for (i = 0; i < numberOfTuples; i++) {
        tuples.push({x:randomInRange(minX, maxX),y:randomInRange(minY, maxY)});
      }
      var twoArrays = mapTuplesToTwoArrays(tuples);
      var tmp = leastSquaresCalculator(twoArrays.x, twoArrays.y);
      var m = tmp.m;
      var b = tmp.b;
    } while (m < 0 || b < 0);
    for (i = 1; i <= party_count; i++) {
      testCase[i].push(tuples.splice(-1,1)[0]);
    }
    while (tuples.length !== 0) {
      var randomParty = randomInRange(1, party_count);
      testCase[randomParty].push(tuples.splice(-1,1)[0]);
    }
    for (i = 1; i <= party_count; i++) {
      inputs[i].push(testCase[i]);
    }
  }
  console.log(inputs);
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
    var tuples = [];
    for (var i = 1; i <= party_count; i++) {
      console.log(inputs[i][j]);
      tuples = tuples.concat(inputs[i][j]);
    }
    console.log(tuples);
    var twoArrays = mapTuplesToTwoArrays(tuples);
    results.push(leastSquaresCalculator(twoArrays.x, twoArrays.y));
  }
  console.log(results);
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
          // varruct debugging message
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

        jiff_instance.disconnect();
        if (count === party_count) {
          done();
        }
      })(0);
    };

    var options = { party_count: party_count, onError: console.log, onConnect: onConnect, Zp: Zp };
    for (var i = 0; i < party_count; i++) {
      mpc.connect('http://localhost:8080', 'mocha-test', options);
    }
  });
});
