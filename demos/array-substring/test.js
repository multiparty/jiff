// Chai 
var expect = require('chai').expect;
var assert = require('chai').assert;

var party_count = 2;
var mpc = require('./mpc.js');
var instances = [];

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

  var maxStackLength = 10;
  var maxNeedleLength = 3;
  var n = 2;

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

  for (var j = 0; j < inputs['1'].length; j++) {
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
    var results = computeResults(inputs);

    var onConnect = function(jiff_instance) {
      var partyInputs = inputs[jiff_instance.id];
      var promises = [];
      for (var j = 0; j < partyInputs.length; j++) {
        var promise = mpc.compute(partyInputs[j], jiff_instance);
        promises.push(promise);
      }

      Promise.all(promises).then(function(values) {
        count++;
        for (var i = 0; i < values.length; i++) {
          // construct debugging message
          var ithInputs = inputs[1][i] + "";
          for(var j = 2; j <= party_count; j++)
            ithInputs += "," + inputs[j][i];
          var msg = "Party: " + jiff_instance.id + ". inputs: [" + ithInputs + "]";

          // assert results are accurate
          try {
            assert.deepEqual(values[i], results[i], msg); // Changed this line: we are checking equality of arrays now.
          } catch(assertionError) {
            done(assertionError);
            done = function(){}
          }
        }

        jiff_instance.disconnect();
        if (count == party_count)
          done();
      });
    };
    
    var options = { party_count: party_count, onError: console.log, onConnect: onConnect };
    for(var i = 0; i < party_count; i++)
      instances.push(mpc.connect("http://localhost:8080", "mocha-test", options));
  });
});
