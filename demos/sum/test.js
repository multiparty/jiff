// Chai 
var expect = require('chai').expect;
var assert = require('chai').assert;

var mpc = require('./party.js');

describe('Sum', function() {

  it('Base Case', function() {
    var party_count = 3;
    var count = 0;

    var inputs = [];
    var onConnect = function(jiff_instance) {
      count++;
      if(count < party_count) return;

      mpc.mpc();
    };
    
    var options = { party_count: party_count, onError: console.log, onConnect: onConnect };
    mpc.connect("localhost:8080", "mocha-test", options);
    mpc.connect("localhost:8080", "mocha-test", options);
    mpc.connect("localhost:8080", "mocha-test", options);
  });

});
