// Chai
var expect = require("chai").expect;
var assert = require("chai").assert;

// Require test cases for every operation
var arithmetic_op = require("./arithmetic_op.js");
var constant_arithmetic_op = require("./constant_arithmetic_op.js");
var comparison = require("./comparison.js");
var constant_comparison = require("./constant_comparison.js");


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
  //
  // describe("Arithmetic Operations", function() {
  //   // +
  //   it("Addition", function(done) {
  //     arithmetic_op.run_test(i++, "add", callback(done));
  //   });
  //   // -
  //   it("Subtraction", function(done) {
  //     arithmetic_op.run_test(i++, "sub", callback(done));
  //   });
  //   // *
  //   it("Mutliplication", function(done) {
  //     arithmetic_op.run_test(i++, "mult", callback(done));
  //   });
  // });
  //
  // describe("Constant Arithmetic Operations (i.e. of the form)", function() {
  //   // constant +
  //   it("Constant Addition", function(done) {
  //     constant_arithmetic_op.run_test(i++, "add_cst", callback(done));
  //   });
  //   // constant -
  //   it("Constant Subtraction", function(done) {
  //     constant_arithmetic_op.run_test(i++, "sub_cst", callback(done));
  //   });
  //   // constant *
  //   it("Constant Mutliplication", function(done) {
  //     constant_arithmetic_op.run_test(i++, "mult_cst", callback(done));
  //   });
  // });
  //
  // describe("Comparison", function() {
  //   // <
  //   it("Less than", function(done) {
  //     comparison.run_test(i++, "less", callback(done));
  //   });
  //   // <=
  //   it("Less than or Equal", function(done) {
  //     comparison.run_test(i++, "less_or_equal", callback(done));
  //   });
  //   // >
  //   it("Greater than", function(done) {
  //     comparison.run_test(i++, "greater", callback(done));
  //   });
  //   // >=
  //   it("Less than or Equal", function(done) {
  //     comparison.run_test(i++, "greater_or_equal", callback(done));
  //   });
  //   // ==
  //   it("Equal", function(done) {
  //     comparison.run_test(i++, "eq", callback(done));
  //   });
  //   // !=
  //   it("Not Equal", function(done) {
  //     comparison.run_test(i++, "neq", callback(done));
  //   });

    describe("Constant Comparison", function() {
      // // <
      // it("Less than", function(done) {
      //   constant_comparison.run_test(i++, "less_cst", callback(done));
      // });
      // // <=
      // it("Less than or Equal", function(done) {
      //   constant_comparison.run_test(i++, "less_or_equal_cst", callback(done));
      // });
      // // >
      // it("Greater than", function(done) {
      //   constant_comparison.run_test(i++, "greater_cst", callback(done));
      // });
      // // >=
      it("Greater than or Equal", function(done) {
        constant_comparison.run_test(i++, "greater_or_equal_cst", callback(done));
      });
      // // ==
      // it("Equal", function(done) {
      //   constant_comparison.run_test(i++, "eq_cst", callback(done));
      // });
      // // !=
      // it("Not Equal", function(done) {
      //   constant_comparison.run_test(i++, "neq_cst", callback(done));
      // });
  });
});
