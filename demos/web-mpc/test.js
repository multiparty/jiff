var ChildProcess = require('../../tests/utils/process.js');
var Zp = require('../../lib/client/util/constants.js').gZp;

var TEST_COUNT = 5;

// Make sure we are working in the correct directory
process.chdir(__dirname);

// Helper functions
var generateInputs = function (count) {
  var inputs = [];
  var sum = 0;
  for (var i = 0; i < count; i++) {
    var r = Math.floor(Math.random() * Zp);
    inputs.push(r);
    sum = (sum + r) % Zp;
  }
  return {inputs: inputs, output: sum};
};
var runInputParties =function (inputs, done, callback) {
  var promises = [];
  for (var i = 0; i < inputs.length; i++) {
    var child = new ChildProcess('node', ['input-party.js', inputs[i].toString()], done, callback);
    promises.push(child.promise());
  }

  return Promise.all(promises);
};
var runServer = function (done, callback) {
  var child = new ChildProcess('node', ['server.js'], done, callback);
  return child.promise();
};
var runAnalyst = function (done, callback) {
  var child = new ChildProcess('node', ['analyst.js'], done, callback);
  return child.promise();
};
var checkOutput = function (output, analyst, server) {
  // wait until server and analyst are finished
  return Promise.all([analyst, server]).then(function (results) {
    var resultLine = results[0][results[0].length-1].trim();
    var found = parseInt(resultLine.substring('SUM IS: '.length).trim());
    if (output !== found) {
      return new Error('Expected output ' + output + '. found ' + found);
    }
  });
};

// eslint-disable-next-line no-undef
describe('web-mpc', function () {
  this.timeout(0);

  for (var i = 0; i < TEST_COUNT; i++) {
    // eslint-disable-next-line no-undef
    it('10 input parties - no disconnect', function (done) {
      var res = generateInputs(10);
      var inputs = res.inputs;
      var output = res.output;

      var server = runServer(done, function (serverProcess, data) {
        if (data.startsWith('listening on')) {
          // server started: run analyst
          var analyst = runAnalyst(done, function (analystProcess, data) {
            if (data.startsWith('Computation initialized!')) {
              // analyst initialized computation: run input parties
              var inputParties = runInputParties(inputs, done);
              inputParties.then(function () {
                // input parties submitted their inputs! analyst should issue start!
                analystProcess.write('\n');
              });
            }
          });

          // Make sure analyst output is good!
          checkOutput(output, analyst, server).then(done);
        }
      });
    });
  }

  for (i = 0; i < TEST_COUNT; i++) {
    // eslint-disable-next-line no-undef
    it('20 input parties - with disconnect', function (done) {
      var res = generateInputs(20);
      var inputs = res.inputs;
      var output = res.output;

      runServer(done, function (serverProcess, data) {
        if (data.startsWith('listening on')) {
          // server started: run analyst
          var analyst = runAnalyst(done, function (analystProcess, data) {
            if (data.startsWith('Computation initialized!')) {
              // analyst initialized computation: kill analyst, and then start input parties
              analystProcess.kill();
              analyst.then(function () {
                var inputParties = runInputParties(inputs, done);
                inputParties.then(function () {
                  // input parties submitted their inputs! analyst should issue start!
                  var analyst = runAnalyst(done, function (analystProcess, data) {
                    if (data.startsWith('Computation initialized!')) {
                      analystProcess.write('\n');
                    }
                  });

                  // Make sure analyst output is good!
                  checkOutput(output, analyst).then(function (result) {
                    serverProcess.kill(); // avoiding waiting a long time
                    done(result);
                  });
                });
              });
            }
          });
        }
      });
    });
  }
});