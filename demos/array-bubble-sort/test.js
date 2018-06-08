// Chai 
var expect = require('chai').expect;
var assert = require('chai').assert;

var party_count = 4;
var mpc = require('./mpc.js');

/**
 * CHANGE THIS: Generate inputs for your tests
 * Should return an object with this format:
 * {
 *   'party_id': [ 'test1_input', 'test2_input', ...]
 * }
 */
function generateInputs(party_count) {
  var inputs = {};
  var maximumRandomNumber = 4;//255;
  var testCasesCount = 3;//10;
  var randomArraysLengths = [];
  var maximumArrayLength = 5;
  for (var i = 1; i <= party_count; i++) {
    inputs[i] = [];
  }
  for (var i = 0; i < testCasesCount; i++) {
    randomArraysLengths.push(Math.floor((Math.random() * maximumArrayLength))+1);
  }
  for (var i = 1; i <= party_count; i++) {
    for (var j = 0; j < testCasesCount; j++) {
      var arr = [];
      for (var k = 0; k < randomArraysLengths[j]; k++) {
        arr.push(Math.floor((Math.random() * maximumRandomNumber)));
      }
      inputs[i].push(arr);
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

  var firstParty = Object.keys(inputs)[0];
  for (var testCase = 0; testCase < inputs[firstParty].length; testCase++) {
    var arr1 = inputs[firstParty][testCase];
    for (var party in inputs) {
      if (party === firstParty)
        continue;
      var arr2 = inputs[party][testCase];
      for (var i = 0; i < arr1.length; i++) {
        arr1[i] += arr2[i];
      }
    }
    results.push(arr1.sort(function(a,b){return a - b;}));
  }
  console.log(results);


  // for (var i = 0; i < Object.keys(inputs)[0].length; i++) {
  //   results.push([]);
  // }

  // for (var testCase = 0; testCase < Object.keys(inputs)[0].length; testCase++) {
  //   for (var party in inputs) {
  //     for (var j = 0; j < inputs[party][testCase].length; j++) {
  //       results[testCase][j] 
  //     }
  //   }
  // }

  // for (var j = 0; j < inputs['1'].length; j++) {
  //   var accumulator = 0;
  //   for (var k = 1; k <= party_count; k++) {
  //     accumulator += inputs[k][j];
  //   }
  //   results.push(accumulator);
  // }
  // results = results.sort(function(a,b){return a - b;});
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

      Promise.all(promises).then(function(values) { console.log(jiff_instance.id, values);
        count++;
        for (var i = 0; i < values.length; i++) {
          // construct debugging message
          var ithInputs = inputs[1][i] + "";
          for (var j = 2; j <= party_count; j++)
            ithInputs += "," + inputs[j][i];
          var msg = "Party: " + jiff_instance.id + ". inputs: [" + ithInputs + "]";

          // assert results are accurate
          try {
            assert.deepEqual(values[i], results[i], msg);
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
      mpc.connect("http://localhost:8080", "mocha-test", options);
  });
});
