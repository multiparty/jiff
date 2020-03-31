(function (exports, node) {
  if (node) {
    // eslint-disable-next-line no-undef
    JIFFClient = require('../../lib/jiff-client.js');
    // eslint-disable-next-line no-undef
    jiff_restAPI = require('../../lib/ext/jiff-client-restful.js');
  }

  var __jiff_instance, config, all_parties;
  exports.connect = function (hostname, computation_id, options, _config) {
    config = _config;

    all_parties = config.compute_parties.concat(config.input_parties);

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
    // jiff_instance.share_array(input, input.length, null, config.compute_parties, config.input_parties);
    // shares = jiff_instance.share_ND_array(input);
    jiff_instance.share(input[2], null, config.compute_parties, config.input_parties);

    // If this party is still connected after the compute parties are done, it will
    // receive the result.

    // shares.then(function (shares) {
    //   console.log('shares promise resolved to: ', shares);
    //   // shares[5][0].logLEAK('LEAK');
    // });

    var share = new jiff_instance.SecretShare({}, config.compute_parties, 3, 13);
    console.log('share', share);
    var shares = [share, share, share];

    var promise = jiff_instance.open_ND_array(shares, all_parties);

    // var promise = Promise.all([
    //   jiff_instance.open(share, all_parties),
    //   jiff_instance.open(share, all_parties),
    //   jiff_instance.open(share, all_parties)
    // ]);

    promise.then(function (value) {
      console.log('value\tresult', value);
      jiff_instance.disconnect(true, true);
    });

    return promise;
  };
}((typeof exports === 'undefined' ? this.mpc = {} : exports), typeof exports !== 'undefined'));
