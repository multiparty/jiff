(function (exports, node) {
  if (node) {
    JIFFClient = require('../../lib/jiff-client.js');
    jiff_restAPI = require('../../lib/ext/jiff-client-restful.js');
  }

  let __jiff_instance, config, all_parties;
  exports.connect = function (hostname, computation_id, options, _config) {
    config = _config;

    all_parties = config.compute_parties.concat(config.input_parties);

    const opt = Object.assign({}, options);
    opt['crypto_provider'] = config.preprocessing === false;
    opt['initialization'] = { role: 'input' };
    opt['party_count'] = config.party_count;
    opt['autoConnect'] = false;

    __jiff_instance = new JIFFClient(hostname, computation_id, opt);
    __jiff_instance.apply_extension(jiff_restAPI);
    __jiff_instance.connect();
    return __jiff_instance;
  };
  exports.compute = function (input, jiff_instance_) {
    let jiff_instance = __jiff_instance;
    if (jiff_instance_) {
      jiff_instance = jiff_instance_;
    }

    // Set up array sharing
    const skeleton = jiff_instance.skeleton_of(input);
    const skeletons = {};
    let i, p_id;
    for (i = 0; i < config.input_parties.length; i++) {
      p_id = config.input_parties[i];
      skeletons[p_id] = skeleton;  // Assume same skeleton for all parties
    }

    // Share with compute parties
    jiff_instance.share_ND_array(input, skeletons, null, config.compute_parties, config.input_parties);

    // If this party is still connected after the compute parties are done, it will
    // receive the result.

    const promise = jiff_instance.receive_open_array(all_parties, config.compute_parties);

    promise.then(function (value) {
      jiff_instance.disconnect(true, true);
    });

    return promise;
  };
}((typeof exports === 'undefined' ? this.mpc = {} : exports), typeof exports !== 'undefined'));
