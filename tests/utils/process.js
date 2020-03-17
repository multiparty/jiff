var spawn = require('child_process').spawn;

function MyChildProcess(command, args, done, callback) {
  var self = this;

  this.data = [];
  this._promise = new Promise(function (resolve) {
    self._resolve = resolve;
  });

  this.process = spawn(command, args);
  this.process.stdout.on('data', function (data) {
    self.data.push(data.toString());
    if (callback) {
      callback(self, data.toString());
    }
  });

  this.process.stderr.on('data', function (data) {
    self.data.push(data.toString());
    console.log('stderr in', command, args);
    console.log(data.toString());
  });

  this.process.on('error', function (error) {
    console.log('ERROR in', command, args);
    console.log(error);
    if (done == null) {
      process.exit(1);
    } else {
      done(error);
    }
  });

  this.process.on('close', function () {
    self._resolve(self.data);
  });
}

MyChildProcess.prototype.kill = function () {
  this.process.kill();
};

MyChildProcess.prototype.promise = function () {
  return this._promise;
};

MyChildProcess.prototype.write = function (data) {
  this.process.stdin.write(data);
};

module.exports = MyChildProcess;