// Chai 
var assert = require('chai').assert;

var mpc = require('./mpc.js');

// Generic Testing Parameters
var party_count = 2;
var n = 8;

// Parameters specific to this demo
var maxValue = 1000;


/**
 * CHANGE THIS: Generate inputs for your tests
 * Should return an object with this format:
 * {
 *   'party_id': [ 'test1_input', 'test2_input', ...]
 * }
 */
function generateInputs(party_count, inputSize) {

  var inputs = {};

  for (var i = 0; i < party_count; i++) {
    inputs[i+1] = [];
  }
  
  for (var i = 0; i < party_count; i++) {
    for (var j = 0; j < inputSize; j++) {
      inputs[i+1].push(Math.floor((Math.random() * maxValue)));
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
  const parties = Object.keys(inputs);

  const len = inputs[parties[0]].length;

  let results = [];

  for (let i = 0; i < len; i++) {
    results.push(0);
  }

  for (let p in parties) {

    var values = inputs[parties[p]];

    for (let i = 0; i < len; i++) {
      results[i] = results[i] + values[i];
    }
  }

  return results.sort();
}

/**
 * Do not change unless you have to.
 */
describe('Test', function() {
  this.timeout(0); // Remove timeout

  it('Single test', function(done) {
    var count = 0;

    var inputs = generateInputs(party_count, 8);
    var realResults = computeResults(inputs);

    var onConnect = function(jiff_instance) {
      var partyInputs = inputs[jiff_instance.id];
    
      let promises = [];

      promises.push(mpc.compute(partyInputs, jiff_instance));

      let testResults = [];
      
      Promise.all(promises).then(function(results) {
        testResults = results;
      });
    
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
          assert.deepEqual(testResults, realResults, msg);
        } catch(assertionError) {
          done(assertionError);
          done = function(){}
        }
      }

      jiff_instance.disconnect();

      if (count == party_count) {
        done();
      }
    };
    
    var options = { party_count: party_count, onError: console.log, onConnect: onConnect };
    for(var i = 0; i < party_count; i++)
      mpc.connect("http://localhost:8080", "mocha-test", options);
  });
});
