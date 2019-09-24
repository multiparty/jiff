/* global describe it */
var helpers = require('./config/bigNumber/helpers.js');

// Catch and log any uncaught exceptions
process.on('uncaughtException', function (err) {
  console.log('Uncaught Exception!');
  console.log(err);
  throw err;
});
process.on('unhandledRejection', function (reason) {
  console.log('Unhandled Rejection', reason);
});

// Parameters
var name = process.env['JIFF_TEST_NAME']; // the extension(s) to test
var suite = process.env['JIFF_TEST_SUITE']; // the test suite

// Extensions
var init = require('./init.js');

// Computations
var defaultComputation = require('./computations.js');

// JIFF test configuration
var config = require('./config/' + name + '/' + suite + '.json');

// Start tests
describe(name + ': ' + suite, function () {
  this.timeout(0); // Remove timeout
  var tests = config.tests;

  // loop over the tests in the suite
  for (var i = 0; i < tests.length; i++) {
    var test = tests[i];

    // single test
    (function (test) {
      it(test, function (done) {
        // read configuration
        var testConfig = config['testConf'][test];
        if (testConfig == null) {
          testConfig = config['testConf'].default;
        }

        // instance creation parameters
        var port = config['suiteConf'].port;
        var computation_id = name + ':' + suite + ':' + test;

        // computation size
        var testCount = testConfig.count;
        var testParallel = testConfig.parallel;

        // instance options
        var extensions = config['suiteConf']['extensions'];
        var options = testConfig.options;
        var party_count = options.party_count;
        var alias = testConfig.alias != null ? testConfig.alias : test;

        // figure out computation inputs
        var inputs = [];
        if (testConfig['inputs'] != null) {
          inputs = testConfig['inputs'];
        }

        // Generate random inputs
        if (testCount != null && testCount > inputs.length) {
          testCount = testCount - inputs.length;
          var generation = require('./' + config['suiteConf']['generation']['file']);
          try {
            inputs = inputs.concat(generation[config['suiteConf']['generation']['function']](test, testCount, options));
          } catch (error) {
            console.log('Input generation error ', error);
            done(error);
          }
        }

        // Make sure inputs are bignumbers for tests with BigNumber extension
        if (extensions != null && extensions.indexOf('bigNumber') > -1) {
          inputs = helpers.toBigNumber(suite, test, inputs);
        }

        // figure out computation
        var computation = defaultComputation.compute;
        if (config['suiteConf']['computation'] != null) {
          computation = require('./' + config['suiteConf']['computation']['file']);
          computation = computation[config['suiteConf']['computation']['function']];
        }

        // Create and run instances
        options.onConnect = function (jiff_instance) {
          computation(jiff_instance, alias, inputs, testParallel, done, testConfig);
        };
        init.createInstances(party_count, port, computation_id, options, extensions);
      });
    })(test);
  }
});
