// Chai 
var expect = require('chai').expect;
var assert = require('chai').assert;

var mpc = require('./mpc.js');

function generateInputs(party_count) {
  var inputs = {};
  var upperBound = 100;
  var n = 100;

  for (var i = 0; i < party_count; i++) {
    inputs[i+1] = [];
  }
  
  for (var i = 0; i < party_count; i++) {
    for (var j = 0; j < n; j++) {
      inputs[i+1].push(Math.floor((Math.random() * upperBound)));
    }  
  }
  return inputs;
}

function computeResults(inputs) {
  var results = [];

  for (var j = 0; j < inputs['1'].length; j++) {
    sum = inputs['1'][j] + inputs['2'][j] + inputs['3'][j];
    results.push(sum)
  }
  return results;
}


describe('Sum', function() {
  this.timeout(0); // Remove timeout

  it('Exhaustive', function(done) {
    var party_count = 3;
    var count = 0;

    var inputs = generateInputs(party_count);
    var results = computeResults(inputs);

    var onConnect = function(jiff_instance) {

      var promises = [];
     
      var partyInputs = inputs[jiff_instance.id];

      for (var j = 0; j < partyInputs.length; j++) {
        var promise = mpc.mpc(jiff_instance, partyInputs[j]);
        promises.push(promise);
      }

      expect(promises.length).to.equal(partyInputs.length)

      Promise.all(promises).then(function(values) {
        for (var i = 0; i < values.length; i++) {
          expect(values[i]).to.equal(results[i]);
        }
        count++;

        jiff_instance.disconnect();
        if (count == party_count) {
          done();
        }
      });
    };
    
    var options = { party_count: party_count, onError: console.log, onConnect: onConnect };
    mpc.connect("http://localhost:8080", "mocha-test", options);
    mpc.connect("http://localhost:8080", "mocha-test", options);
    mpc.connect("http://localhost:8080", "mocha-test", options);
  });


  it('Negative numbers', function() {

  });

});
