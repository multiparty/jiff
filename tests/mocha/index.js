// Chai
var expect = require("chai").expect;
var assert = require("chai").assert;

// Require test cases for every operation
var addition_test = require("./add.js");

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
    addition_test.run_test(i++, callback(done));
  });
});
