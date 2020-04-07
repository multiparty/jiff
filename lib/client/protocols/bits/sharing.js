module.exports = {
  /**
   * Share a number as an array of secret bits
   * This takes the same parameters as jiff-instance.share, but returns an array of secret bit shares per sending party.
   * Each bit array starts with the least significant bit at index 0, and most significant bit at index length-1
   * @function share_bits
   * @ignore
   * @param {module:jiff-client~JIFFClient} jiff - the jiff client instance
   * @param {number} secret - the number to share (this party's input)
   * @param {number} [bit_length=jiff_instance.Zp] - the number of generated bits, if the secret has less bits, it will be
   *                                                 padded with zeros
   * @param {number} [threshold=receivers_list.length] - threshold of each shared bit
   * @param {Array} [receivers_list=all_parties] - receivers of every bits
   * @param {Array} [senders_list=all_parties] - senders of evey bit
   * @param {number} [Zp=jiff_instance.Zp] - the field of sharing for every bit
   * @param {string|number} [share_id=auto_gen()] - synchronization id
   * @returns {object} a map (of size equal to the number of parties)
   *          where the key is the party id (from 1 to n)
   *          and the value is an array of secret shared bits
   */
  share_bits: function (jiff, secret, bit_length, threshold, receivers_list, senders_list, Zp, share_id) {
    var i;
    if (Zp == null) {
      Zp = jiff.Zp;
    }
    if (receivers_list == null) {
      receivers_list = [];
      for (i = 1; i <= jiff.party_count; i++) {
        receivers_list.push(i);
      }
    } else {
      jiff.helpers.sort_ids(receivers_list);
    }
    if (senders_list == null) {
      senders_list = [];
      for (i = 1; i <= jiff.party_count; i++) {
        senders_list.push(i);
      }
    } else {
      jiff.helpers.sort_ids(senders_list);
    }

    if (share_id == null) {
      share_id = jiff.counters.gen_op_id2('share_bits', receivers_list, senders_list);
    }

    if (bit_length == null) {
      bit_length = Zp.toString(2).length;
    }

    // to allow for secret=null when party is not a sender
    var local_bits = [];
    if (secret != null) {
      local_bits = jiff.helpers.number_to_bits(secret, bit_length);
    }

    var shared_bits = {};
    for (i = 0; i < senders_list.length; i++) {
      shared_bits[senders_list[i]] = [];
    }

    for (i = 0; i < bit_length; i++) {
      var round = jiff.internal_share(local_bits[i], threshold, receivers_list, senders_list, Zp, share_id + ':' + i);
      for (var si = 0; si < senders_list.length; si++) {
        var pid = senders_list[si];
        shared_bits[pid].push(round[pid]);
      }
    }

    return shared_bits;
  },
  /**
   * Opens the given array of secret shared bits.
   * This works regardless of whether the represented value fit inside the corresponding field or not
   * @function open_bits
   * @ignore
   * @param {module:jiff-client~JIFFClient} jiff - the jiff client instance
   * @param {module:jiff-client~JIFFClient#SecretShare[]} bits - an array of the secret shares of bits, starting from least to most significant bits
   * @param {number[]} parties - parties to open (same as jiff_instance.open)
   * @param {string|number} [op_id=auto_gen()] - same as jiff_instance.open
   * @returns {promise} a promise to the number represented by bits
   */
  open_bits: function (jiff, bits, parties, op_id) {
    // Default values
    if (parties == null) {
      parties = [];
      for (var p = 1; p <= jiff.party_count; p++) {
        parties.push(p);
      }
    } else {
      jiff.helpers.sort_ids(parties);
    }

    // Compute operation ids (one for each party that will receive a result
    if (op_id == null) {
      op_id = jiff.counters.gen_op_id2('bits.open', parties, bits[0].holders);
    }

    var opened_bits = [];
    for (var i = 0; i < bits.length; i++) {
      opened_bits[i] = jiff.internal_open(bits[i], parties, op_id + ':' + i);
    }

    return Promise.all(opened_bits).then(function (bits) {
      return jiff.helpers.bits_to_number(bits, bits.length);
    });
  },
  /**
   * Receives an opening of an array of secret bits without owning shares of the underlying value.
   * Similar to jiff.receive_open() but for bits.
   * This works regardless of whether the represented value fit inside the corresponding field or not
   * @function receive_open_bits
   * @memberOf jiff-instance.protocols.bits
   * @param {module:jiff-client~JIFFClient} jiff - the jiff client instance
   * @param {Array} senders - an array with party ids (1 to n) specifying the parties sending the shares
   * @param {Array} [receivers=all_parties] - an array with party ids (1 to n) specifying the parties receiving the result
   * @param {number} [count=ceil(log2(Zp))] - the number of bits being opened
   * @param {number} [threshold=parties.length] - the min number of parties needed to reconstruct the secret, defaults to all the senders
   * @param {number} [Zp=jiff_instance.Zp] - the mod (if null then the default Zp for the instance is used)
   * @param {string|number|object} [op_id=auto_gen()] - unique and consistent synchronization id between all parties
   * @returns {promise} a (JQuery) promise to the open value of the secret
   */
  receive_open_bits: function (jiff, senders, receivers, count, threshold, Zp, op_id) {
    if (senders == null) {
      throw new Error('Must provide "senders" parameter in receive_open');
    }
    jiff.helpers.sort_ids(senders);
    // Default values
    if (receivers == null) {
      receivers = [];
      for (i = 1; i <= jiff.party_count; i++) {
        receivers.push(i);
      }
    } else {
      jiff.helpers.sort_ids(receivers);
    }

    if (op_id == null) {
      op_id = jiff.counters.gen_op_id2('bits.open', receivers, senders);
    }

    if (count == null) {
      if (Zp == null) {
        Zp = jiff.Zp;
      }
      count = Zp.toString(2).length;
    }

    var opened_bits = [];
    for (var i = 0; i < count; i++) {
      opened_bits[i] = jiff.receive_open(senders, receivers, threshold, Zp, op_id + ':' + i);
    }

    return Promise.all(opened_bits).then(function (bits) {
      return jiff.helpers.bits_to_number(bits, bits.length);
    });
  }
};