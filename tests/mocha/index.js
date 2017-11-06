// Chai
var expect = require("chai").expect;
var assert = require("chai").assert;

// Require test cases for every operation
var add = require("./add.js");
var mult = require("./mult.js");

// Callback to run after each test is done
function callback(done) {
  return function(result) {
    assert.equal(result, true);
    done();
  };
}

// Perform Tests
describe("MPC Operations", function() {
  this.timeout(0); // Remove timeout
  var i = 2;

  // +
  it("Addition", function(done) {
    add.run_test(i++, callback(done));
  });
  
  // *
  it("Multiplication", function(done) {
    mult.run_test(i++, callback(done));
  });
});
