// Chai
var expect = require("chai").expect;
var assert = require("chai").assert;

// Require test cases for every operation
var arithmetic_op = require("./arithmetic_op.js");
var constant_arithmetic_op = require("./constant_arithmetic_op.js");
var boolean_op = require("./boolean_op.js");


// Callback to run after each test is done
function callback(done) {
  return function(result) {
    assert.equal(result, true);
    done();
  };
}

// Perform Tests yay
describe("MPC Operations", function() {
  this.timeout(0); // Remove timeout
  var i = 2;

  describe("Arithmetic Operations", function() {
    // +
    it("Addition", function(done) {
      arithmetic_op.run_test(i++, "add", callback(done));
    });
    // -
    it("Subtraction", function(done) {
      arithmetic_op.run_test(i++, "sub", callback(done));
    });
    // *
    it("Mutliplication", function(done) {
      arithmetic_op.run_test(i++, "mult", callback(done));
    });
  });

  describe("Constant Arithmetic Operations (i.e. of the form x.cst)", function() {
    // constant +
    it("Constant Addition", function(done) {
      constant_arithmetic_op.run_test(i++, "add_cst", callback(done));
    });
    // constant -
    it("Constant Subtraction", function(done) {
      constant_arithmetic_op.run_test(i++, "sub_cst", callback(done));
    });
    // constant *
    it("Constant Mutliplication", function(done) {
      constant_arithmetic_op.run_test(i++, "mult_cst", callback(done));
    });
  });

  describe("Boolean Operations", function() {
    // <
    it("Less than", function(done) {
      boolean_op.run_test(i++, "less", callback(done));
    });
    // <=
    it("Less than or Equal", function(done) {
      boolean_op.run_test(i++, "less_or_equal", callback(done));
    });
    // >
    it("Greater than", function(done) {
      boolean_op.run_test(i++, "greater", callback(done));
    });
    // >=
    it("Less than or Equal", function(done) {
      boolean_op.run_test(i++, "greater_or_equal", callback(done));
    });
  });
});
