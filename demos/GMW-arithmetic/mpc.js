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
    // opt.Zp = 101;

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

  exports.compute = function (input, jiff_instance) {
    var i, p_id;
    if (jiff_instance == null) {
      jiff_instance = saved_instance;
    }

    var bit_length = 4;
    var bits = jiff_instance.helpers.number_to_bits(input, bit_length);  // maybe check to enforce correct lengths
    console.log('input    ', bits.join(''), input);

    var shares = Array(jiff_instance.party_count);//Array(1).concat(Array(jiff_instance.party_count).fill([]));
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
    console.log(shares);

    var intermediate_result = jiff_instance.protocols.gmw.bits.smult(shares[1], shares[2]);
    var secondary_result = jiff_instance.protocols.gmw.bits.sadd(intermediate_result, intermediate_result);
    var result = jiff_instance.protocols.gmw.bits.smult(secondary_result, secondary_result);

    // var masks = [];
    // for (var i = 0; i < bit_length; i++) {
    //   let bit = jiff_instance.id-1;//mask_bits[i];
    //   let bit_share = jiff_instance.gmw_share(bit);
    //   let and_value_a = bit_share[1];//.gmw_and(bit_share[2]);
    //   let and_value_b = bit_share[1].gmw_and(bit_share[2]);
    //   // console.log('___gmw_and__:' + i, i, bit, bit_share, and_value);
    //   masks[i] = and_value_a;
    //   masks[i+100] = and_value_b;
    //   delete bit;
    //   delete bit_share;
    //   delete and_value_a;
    //   delete and_value_b;
    // }
    //
    // for (var i = 0; i < bit_length; i++) {
    //   jiff_instance.gmw_open(masks[i]).then( console.log.bind(null, 'open_a', i) );
    //   jiff_instance.gmw_open(masks[i+100]).then( console.log.bind(null, 'open_b', i) );
    // }

    // for (var i = 2; i <= jiff_instance.party_count; i++) {
    //   result = result.gmw_and(shares[i]);
    // }

    // var result = [];
    // for (i = 0; i < bit_length; i++) {
    //   result[i] = shares[1][i].gmw_and(shares[2][i]);
    // }
    // for (i = 0; i < bit_length; i++) {
    //   result[i] = result[i].gmw_xor(shares[1][i].gmw_xor(shares[2][i]));
    // }

    return new Promise(function (resolve) {
      // Wait for arithmetic to complete, then compose.
      Promise.all(result.map(function (bit_share) {
        return bit_share.value;  // a promise, if not ready
      })).then(function () {
        jiff_instance.protocols.gmw.bits.compose(result).then(function (share) {
          share.open().then(function (value) {
            console.log('output   ', value);
            resolve(value);
          });
        });
      });





      // var bit_length = jiff_instance.helpers.number_to_bits(jiff_instance.Zp-1).length;
      // var mask_value = 255;
      // var mask_bits = jiff_instance.helpers.number_to_bits(mask_value, bit_length);

      // // var masks = [];
      // for (var i = 0; i < bit_length; i++) {
      //   let bit = jiff_instance.id-1;//mask_bits[i];
      //   let bit_share = jiff_instance.gmw_share(bit);
      //   let and_value_a = bit_share[1].gmw_and(bit_share[2]);
      //   let and_value_b = bit_share[1].gmw_and(bit_share[1]);
      //   // console.log('___gmw_and__:' + i, i, bit, bit_share, and_value);
      //   // masks[i] = and_value_a;
      //   // masks[i] = and_value_b;
      //   jiff_instance.gmw_open(and_value_a).then( console.log.bind(null, 'open', i) );
      //   jiff_instance.gmw_open(and_value_b).then( console.log.bind(null, 'open', i) );
      //   delete bit;
      //   delete bit_share;
      //   delete and_value_a;
      //   delete and_value_b;
      // }
      // resolve();

      // Promise.all(
      //   masks.map(function (s) { return jiff_instance.gmw_open(s); })
      // ).then(function (masked_bits) {
      //   var masked = jiff_instance.helpers.bits_to_number(masked_bits);
      //   console.log('masked_bits', masked_bits, masked);
      //   console.log('mask_bits', mask_bits, mask_value);
      //   // var share = jiff_instance.share(masked)[1];
      //
      //   resolve(masked);
      // });





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
