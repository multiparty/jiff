/* global config */
(function () {
  var jiff_instance;

  this.mpc = {
    connect: function (hostname, computation_id, options) {
      var opt = Object.assign({}, options);
      opt['crypto_provider'] = true;
      opt['initialization'] = { role: 'input' };

      // eslint-disable-next-line no-undef
      return jiff_instance = new JIFFClient(hostname, computation_id, opt);
    },
    compute: function (input) {
      // Share with compute parties
      jiff_instance.share(input, null, config.compute_parties, config.input_parties);

      // If this party is still connected after the compute parties are done, it will
      // receive the result.
      var promise = jiff_instance.receive_open(config.compute_parties);
      promise.then(function () {
        jiff_instance.disconnect(true, true);
      });

      return promise;
    }
  };
}());