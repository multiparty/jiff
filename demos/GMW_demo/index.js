module.exports = function (io, sodium) {
  if (sodium == null) {
    sodium = require('libsodium-wrappers-sumo');
  }

  const ot = require('./lib/ot.js')(io, sodium);

  return new Promise(function (resolve) {
    sodium.ready.then(function () {
      resolve(ot);
    });
  });
};
