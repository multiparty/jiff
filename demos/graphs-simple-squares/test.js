// Chai 
// var expect = require('chai').expect;
var assert = require('chai').assert;

var mpc = require('./mpc.js');

// Generic Testing Parameters
var party_count = 2;
var parallelismDegree = 5; // Max number of test cases running in parallel
var n = 1; // Number of test cases in total
var maximumNumberOfInputs = 10;


// The limits of the graph.
const minX = 0;
const maxX = 100;
const minY = 0;
const maxY = 100;

const randomInRange = (min, max) => Math.floor(Math.random()*(max - min + 1) + min);

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

  if (values_length != values_y.length) {
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

/**
 * CHANGE THIS: Generate inputs for your tests
 * Should return an object with this format:
 * {
 *   'party_id': [ 'test1_input', 'test2_input', ...]
 * }
 */
function generateInputs(party_count_unused) {
  var inputs = {1:[], 2:[]};

  var numberOfInputs = randomInRange(2, maximumNumberOfInputs);

  // Generate test cases one at a time
  for(var t = 0; t < n; t++) {
    var arr1;
    var arr2;

    do { //restrict generated test cases to positive m and b. Should be removed after adding the -ve numbers ext.
      arr1 = [];
      arr2 = [];
      for(var i = 0; i < numberOfInputs; i++) {
        arr1.push(randomInRange(minX, maxX));
        arr2.push(randomInRange(minY, maxY));
      }
      var {m, b} = leastSquaresCalculator(arr1, arr2);
    } while(m < 0 || b < 0)
    inputs[1].push(arr1);
    inputs[2].push(arr2);
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
    results.push(leastSquaresCalculator(inputs[1][j], inputs[2][j]));
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
        if (j < partyInputs.length) {
          var promises = [];
          for (var t = 0; t < parallelismDegree && (j + t) < partyInputs.length; t++)
            if (jiff_instance.id === 1)
              promises.push(mpc.computeRoleX(partyInputs[j+t], jiff_instance));
            else
              promises.push(mpc.computeRoleY(partyInputs[j+t], jiff_instance));

          Promise.all(promises).then(function(parallelResults) {
            for (var t = 0; t < parallelResults.length; t++)
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
            assert.deepEqual((Math.floor(100000 * testResults[i].m) / 100000).toFixed(5), (Math.floor(100000 * realResults[i].m) / 100000).toFixed(5), msg);
            assert.deepEqual((Math.floor(1000 * testResults[i].b) / 1000).toFixed(3), (Math.floor(1000 * realResults[i].b) / 1000).toFixed(3), msg);
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

    var BigNumber = require('bignumber.js');
    
    var options = { party_count: party_count, onError: console.log, onConnect: onConnect, decimal_digits: 5, integral_digits: 5, Zp: new BigNumber("1000000000100011") };
    for(var i = 0; i < party_count; i++)
      mpc.connect("http://localhost:8080", "mocha-test", options);
  });
});
