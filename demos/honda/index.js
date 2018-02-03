// Chai
var expect = require("chai").expect;
var assert = require("chai").assert;

// Require test cases for every operation
var backend = require("./backend-server.js");
var frontend = require("./frontend-server.js");

// keeps the jiff_instances of the front-end servers.
var frontend_instances = [];

// Callback to run after backend server is done.
function callback(done) {
  return function(result) {
    assert.equal(result, true);
    
    frontend_instances[0].disconnect();
    frontend_instances[1].disconnect();
    frontend_instances[2].disconnect();
    
    done();
  };
}

// Perform Tests
describe("Shortest Path Test", function() {
  this.timeout(0); // Remove timeout
  var i = 2;

  it("initialization", function(done) {
    // One Backend server
    backend.run(callback(done), 100);

    // 3 Frontend server
    frontend_instances = [
      frontend.run(2), // 2nd Parameter is the ID: backend is 1.
      frontend.run(3),
      frontend.run(4)
    ];
  });
});
