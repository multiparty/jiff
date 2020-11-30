(function (exports, node) {
  var saved_instance;
  // Unique prefix seed for op_ids
  /**
   * Connect to the server and initialize the jiff instance
   */
  exports.connect = function (hostname, computation_id, options) {
    var opt = Object.assign({}, options);
    opt.warn = false;
    opt.crypto_provider = true;
    opt.sodium = false;

    if (node) {
      // eslint-disable-next-line no-undef
      JIFFClient = require('../../lib/jiff-client');
      // eslint-disable-next-line no-undef
      jiff_debugging = require('../../lib/ext/jiff-client-debugging');
    }

    opt.autoConnect = false;
    // eslint-disable-next-line no-undef
    saved_instance = new JIFFClient(hostname, computation_id, opt);
    // eslint-disable-next-line no-undef
    saved_instance.apply_extension(jiff_debugging, opt);
    saved_instance.connect();

    return saved_instance;
  };

  exports.compute = function (input, bit_length, jiff_instance) {
    var i, p_id;
    if (jiff_instance == null) {
      jiff_instance = saved_instance;
    }

    // Do initial conversion to bits locally.
    var bits = jiff_instance.helpers.number_to_bits(input, bit_length);  // maybe check to enforce correct lengths
    console.log('input    ', bits.join(''), input);

    // Share all bits using GMW sharing
    var shares = Array(1).concat(Array(jiff_instance.party_count).fill(Array()));
    for (p_id = 1; p_id <= jiff_instance.party_count; p_id++) {
      shares[p_id] = Array(bit_length);
    }
    for (i = 0; i < bit_length; i++) {
      var bit = bits[i];
      var share = jiff_instance.gmw_share(bit);
      for (p_id = 1; p_id <= jiff_instance.party_count; p_id++) {
        shares[p_id][i] = share[p_id];
      }
    }

    // Multiply everyones' inputs together
    var result = shares[1];
    for (p_id = 2; p_id <= jiff_instance.party_count; p_id++) {
      result = jiff_instance.protocols.gmw.bits.smult(result, shares[p_id]);
    }

    // Compose the GMW shares as a single polynomial share and return a promise to its reconstructed value.
    return new Promise(function (resolve) {
      Promise.all(result.map(function (bit_share) {  // Wait for arithmetic to complete, then compose.
        return bit_share.value;  // a promise, if not ready
      })).then(function () {
        // Compose Shamir from GMW
        jiff_instance.protocols.gmw.bits.compose(result).then(function (share) {
          // Reveal the final output
          share.open().then(function (value) {
            var bits = jiff_instance.helpers.number_to_bits(value);
            console.log('output   ', bits.join(''), value);
            resolve(value);
          });
        });
      });

      // Promise.all(
      //   result.map(function (bit_share) {
      //     return jiff_instance.gmw_open(bit_share);
      //   })
      // ).then(function (bits) {
      //   var number = jiff_instance.helpers.bits_to_number(bits);
      //   console.log('output   ', bits.join(''), number);
      //   resolve(number);
      // });
    });
  }
}((typeof exports === 'undefined' ? this.mpc = {} : exports), typeof exports !== 'undefined'));
