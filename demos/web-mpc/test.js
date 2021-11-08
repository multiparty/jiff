const child_process = require('child_process');
var Zp = require('../../lib/client/util/constants.js').gZp;

var PARTY_COUNTS = [10,20];
var TEST_COUNT = 2;

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

var runInputParty =function (input) {
  return child_process.spawn('node', ['input-party.js', input]);
};
var runServer = function () {
  return child_process.spawn('node', ['server.js']);
};
var runAnalyst = function () {
  return child_process.spawn('node', ['analyst.js']);
};

var runTest = async function(parties, disconnect) {
  var res = generateInputs(parties);
  var inputs = res.inputs;
  var expectedSum = res.output;

  // Run server
  var serverProcess = runServer();
  var serverExit = new Promise((resolve) => {
    serverProcess.on('exit', () => {
      resolve();
    });
  });
  var serverStart = new Promise((resolve) => {
    serverProcess.stdout.on('data', (data) => {
      if (data.includes("listening on")) {
        resolve();
      }
    });
  });

  // Run analyst when server is set up
  await serverStart;
  var analystProcess = runAnalyst();
  var analystStartResolve;
  var analystStart = new Promise((resolve) => {
    analystStartResolve = resolve;
  });
  analystProcess.stdout.on('data', (data) => {
    if (data.includes('Computation initialized!')) {
      if (disconnect) {
        analystProcess.kill();
      }
      analystStartResolve();
    }
  });

  // Run input parties when analyst is set up
  await analystStart;
  var inputProcesses = [];
  var inputPromises = [];
  for (var i = 0; i < inputs.length; i++) {
    inputProcesses[i] = runInputParty(inputs[i].toString());
    inputPromises[i] = new Promise((resolve) => {
      inputProcesses[i].on('exit', () => {
        resolve();
      });
    });
  }

  // Restart analyst if needed and start computation
  await Promise.all(inputPromises);
  if (disconnect) {
    analystProcess = runAnalyst();
    analystStart = new Promise((resolve) => {
      analystStartResolve = resolve;
    });
  }
  var analystExitResolve;
  var analystExit = new Promise((resolve) => {
    analystExitResolve = resolve;
  });
  analystProcess.stdout.on('data', (data) => {
    if (data.includes('Computation initialized!')) {
      analystStartResolve();
    } else if (data.includes('SUM IS:')) {
      var outputSum = parseInt(data.toString().substring('SUM IS: '.length).trim());
      analystExitResolve(outputSum);
    }
  });
  await analystStart;
  analystProcess.stdin.write('\n');

  // Check results
  await serverExit;
  analystExit.then((outputSum) => {
    if (outputSum != expectedSum) {
      throw new Error("Expected ", expectedSum, ", got ", outputSum);
    }
  });
}

// eslint-disable-next-line no-undef
describe('web-mpc', async function () {
  this.timeout(0);

  for (var parties of PARTY_COUNTS) {
    for (var i = 0; i < TEST_COUNT; i++) {
      // eslint-disable-next-line no-undef
      it(parties + ' input parties - no disconnect', async function () {
        await runTest(parties, false);
      });
    }
    for (var i = 0; i < TEST_COUNT; i++) {
      // eslint-disable-next-line no-undef
      it(parties + ' input parties - with disconnect', async function () {
        await runTest(parties, true);
      });
    }
  }
});