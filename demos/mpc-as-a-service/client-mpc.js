(function (exports, node) {
  if (node) {
    // eslint-disable-next-line no-undef
    JIFFClient = require('../../lib/jiff-client.js');
    // eslint-disable-next-line no-undef
    jiff_restAPI = require('../../lib/ext/jiff-client-restful.js');
  }

  var __jiff_instance, config;
  exports.connect = function (hostname, computation_id, options, _config) {
    config = _config;

    var opt = Object.assign({}, options);
    opt['crypto_provider'] = config.preprocessing === false;
    opt['initialization'] = { role: 'input' };
    opt['party_count'] = config.party_count;
    opt['autoConnect'] = false;

    // eslint-disable-next-line no-undef
    __jiff_instance = new JIFFClient(hostname, computation_id, opt);
    // eslint-disable-next-line no-undef
    __jiff_instance.apply_extension(jiff_restAPI);
    __jiff_instance.connect();
    return __jiff_instance;
  };
  exports.compute = function (input, jiff_instance_) {
    var jiff_instance = __jiff_instance;
    if (jiff_instance_) {
      jiff_instance = jiff_instance_;
    }

    // Share with compute parties
    jiff_instance.share(input, null, config.compute_parties, config.input_parties);

    // If this party is still connected after the compute parties are done, it will
    // receive the result.
    var promise = jiff_instance.receive_open(config.compute_parties);
    promise.then(function () {
      jiff_instance.disconnect(true, true);
    });

    return promise;
  };
}((typeof exports === 'undefined' ? this.mpc = {} : exports), typeof exports !== 'undefined'));