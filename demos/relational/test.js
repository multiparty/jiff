// Chai
var assert = require('chai').assert;

var mpc = require('./mpc.js');

// Generic Testing Parameters
var showProgress = false;
var party_count = 3;
var parallelismDegree = 5; // Max number of test cases running in parallel
var n = 10;
var Zp = null;

// Parameters specific to this demo
var maxValue = 100;
var maxLength = 10;


/**
 * Generates inputs for mult3 tests
 * Should return an object with this format:
 * {
 *   'party_id': [ 'test1_input', 'test2_input', ...]
 * }
 *
 * In this setting, each input is a single integer.
 */
function generateMapInput(party_count) {
  var inputs = {};

  for (var i=1; i<=party_count; i++) {
    inputs[i] = [];
  }

  for (var t=0; t<n; t++) {
    //var length = Math.floor(Math.random() * maxLength);
    // first array is interesting
    var length = 4;
    var arr = [];
    for (var k=0; k<length; k++) {
      arr.push(Math.floor(Math.random() * maxValue));
    }
    inputs[1][t] = arr;

    // everyone else's arrays are boring
    for (var i=2; i<= party_count; i++) {
      inputs[i][t] = Array(length).fill(0);
    }
  }
  return inputs;
}

/**
 * Computes the expected results in the clear
 * @param {object} inputs - same format as generateInputs output.
 * Should return a single array with the expected result for every test in order
 *   [ 'test1_output', 'test2_output', ... ]
 */
function computeMapResults(inputs, fun) {
  var results = [];
  // test loop
  for (var t=0; t<n; t++) {

    var arr = inputs[1][t];
    for(var p=2; p<=party_count; p++) {
      for(var i=0; i<arr.length; i++) {
        arr[i] += inputs[p][t][i];
      }
    }

    var res = [];
    for(var i=0; i<arr.length; i++) {
      res.push(fun(arr[i]));
    }
    results.push(res);
  }
  return results;
}

function genericTest(gen_f, compute_f, mpc_f, done, testname) {
  var count = 0;

  var mapInputs = gen_f(party_count);
  var expected_mapResults = computeMapResults(mapInputs, compute_f);

  var onConnect = function (jiff_instance) {
    var partyInputs = mapInputs[jiff_instance.id];

    var mapResults = [];
    (function one_test_case(j) {
      if (jiff_instance.id === 1 && showProgress) {
        console.log('\tStart ', j > partyInputs.length ? partyInputs.length : j, '/', partyInputs.length);
      }

      if (j < partyInputs.length) {
        var map_promises = [];
        for (var t = 0; t < parallelismDegree && (j + t) < partyInputs.length; t++) {
          map_promises.push(mpc_f(partyInputs[j+t], jiff_instance));
        }

        Promise.all(map_promises).then(function (results) {
          for (var t = 0; t < results.length; t++) {
            mapResults.push(results[t]);
          }
          one_test_case(j+parallelismDegree);
        });

        return;
      }

      // If we reached here, it means we are done
      count++;
      for (var i = 0; i < mapResults.length; i++) {
        // construct debugging message
        var ithInputs = mapInputs[1][i] + '';
        for (var p = 2; p <= party_count; p++) {
          ithInputs += ',' + mapInputs[p][i];
        }
        var msg = 'Party: ' + jiff_instance.id + '. inputs: [' + ithInputs + ']';

        // assert results are accurate
        try {
          assert.equal(expected_mapResults[i].toString(), mapResults[i].toString(), msg);
        } catch (assertionError) {
          done(assertionError);
          done = function () {
          };
        }
      }

      jiff_instance.disconnect(true);
      if (count === party_count) {
        done();
      }
    })(0);
  };

  var options = { party_count: party_count, onError: console.log, onConnect: onConnect, Zp: Zp };
  for (var i = 0; i < party_count; i++) {
    mpc.connect('http://localhost:8080', testname, options);
  }


}

/**
 * Do not change unless you have to.
 */
// eslint-disable-next-line no-undef
describe('Test', function () {
  this.timeout(0); // Remove timeout

  it('Map Square Test', function(done) {
    gen_f = generateMapInput;
    compute_f = function(x) { return x * x; };
    mpc_f = mpc.test_map_square;
    genericTest(gen_f, compute_f, mpc_f, done, 'mocha-test-square');
  });

  it('Map Equality Test', function(done) {
    gen_f = generateMapInput;
    compute_f = function(x) { return (x===x)?1:0; };
    mpc_f = mpc.test_map_eq;
    genericTest(gen_f, compute_f, mpc_f, done, 'mocha-test-equality');
  });

});
