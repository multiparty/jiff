(function (exports, node) {
  var saved_instance;

  /**
   * Connect to the server and initialize the jiff instance
   */
  exports.connect = function (hostname, computation_id, options) {
    var opt = Object.assign({}, options);
    // Added options goes here
    opt.crypto_provider = true;

    if (node) {
      // eslint-disable-next-line no-undef
      JIFFClient = require('../../lib/jiff-client');
    }

    // eslint-disable-next-line no-undef
    saved_instance = new JIFFClient(hostname, computation_id, opt);
    // if you need any extensions, put them here

    return saved_instance;
  };

  /**
   * The MPC computation
   */
  exports.compute = function (input, jiff_instance) {
    if (jiff_instance == null) {
      jiff_instance = saved_instance;
    }

    // inputs
    var threshold = input.threshold;
    var lower_count = input.lower_count;
    input = input.value;

    // sets of parties by role
    var id = jiff_instance.id;
    var upper_parties = [];
    var lower_parties = [];
    var all_parties = [];
    for (var i = 1; i <= jiff_instance.party_count; i++) {
      all_parties.push(i);
      if (i <= lower_count) {
        lower_parties.push(i);
      } else {
        upper_parties.push(i);
      }
    }

    // computation
    if (lower_parties.indexOf(id) > -1) {
      // I am a lower party, I have an input that I submit to the upper parties,
      // and they send me back a result at the end.
      jiff_instance.share(input, upper_parties.length, upper_parties, lower_parties);
      return jiff_instance.receive_open(upper_parties, all_parties);
    } else {
      // I am an upper party, I have no input, but I receive all the lower parties inputs,
      // I count how many of these inputs are above the threshold.
      var shares = jiff_instance.share(input, upper_parties.length, upper_parties, lower_parties);

      var result = shares[1].cgt(threshold);
      for (var p = 2; p <= lower_count; p++) {
        result = result.sadd(shares[p].cgt(threshold));
      }

      return jiff_instance.open(result, all_parties);
    }
  };
}((typeof exports === 'undefined' ? this.mpc = {} : exports), typeof exports !== 'undefined'));
