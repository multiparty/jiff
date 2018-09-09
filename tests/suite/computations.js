
// Default Computation Scheme
exports.default = function (jiff_instance, test, inputs, testParallel, assert, done) {
  jiff_instance.disconnect();

  if (jiff_instance.id === 1) {
    assert.equal(true, true);
    done();
  }
};