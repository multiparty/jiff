// Base jiff
var jiff = require('../../lib/jiff-client');

// All extensions that have tests
var extensions = {
  bigNumber: require('../../lib/ext/jiff-client-bignumber'),
  fixedpoint: require('../../lib/ext/jiff-client-fixedpoint'),
  negativeNumber: require('../../lib/ext/jiff-client-negativenumber')
};

// Create the jiff instances for tests
exports.createInstances = function (party_count, port, computation_id, options, ext) {
  options.autoConnect = false;

  // Create many instances
  var instances = [];
  for (var i = 0; i < party_count; i++) {
    // Base instance
    var instance = jiff.make_jiff('http://localhost:' + port, computation_id, options);

    // Apply extensions in order
    var extArray = ext.split('|');
    for (var e = 0 ; e < extArray.length; e++) {
      if (extArray[e] !== 'base') {
        instance.apply_extension(extensions[extArray[e]], options);
      }
    }

    instance.connect();
    instances.push(instance);
  }

  return instances;
};