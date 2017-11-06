var expect    = require("chai").expect;
var assert  = require("chai").assert;
var cryptico = require("cryptico");
var jiff_client = require ("../lib/jiff-client.js");
var io = require('socket.io')(http);

var addition_test = require("addition_test.js");

describe("MPC Operations", function() {
  describe("Summation", function() {
    it("adds numbers among 3 players", function() {
      var add_result   = addition_test.test();
      assert.equal(addition_test.run_test(), "Success");
      done();
    });
  });
});
