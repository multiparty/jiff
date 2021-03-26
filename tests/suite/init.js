// Base jiff
var jiff = require('../../lib/jiff-client');

// All extensions that have tests
var extensions = {
  bigNumber: require('../../lib/ext/jiff-client-bignumber'),
  fixedpoint: require('../../lib/ext/jiff-client-fixedpoint'),
  negativeNumber: require('../../lib/ext/jiff-client-negativenumber'),
  restAPI: require('../../lib/ext/jiff-client-restful'),
  debugging: require('../../lib/ext/jiff-client-debugging.js'),
  jiff_websockets: require('../../lib/ext/jiff-client-websockets')
};

// Create the jiff instances for tests
exports.createInstances = function (party_count, port, computation_id, options, ext) {
  options.autoConnect = false;

  // Create many instances
  var instances = [];
  for (var i = 0; i < party_count; i++) {
    // Base instance
    var instance = new jiff('http://localhost:' + port, computation_id, options);

    // Apply extensions in order
    if (ext == null) {
      ext = [];
    }
    for (var e = 0 ; e < ext.length; e++) {
      if (ext[e] == null) {
        console.log('could not find extension ' + e);
        continue;
      }
      instance.apply_extension(extensions[ext[e]], options);
    }

    instance.connect();
    instances.push(instance);
  }

  return instances;
};