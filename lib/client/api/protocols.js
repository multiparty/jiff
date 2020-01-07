var numbers = require('../protocols/preprocessing/numbers.js');
var bits = require('../protocols/preprocessing/bits.js');
var triplets = require('../protocols/preprocessing/triplets.js');
var quotients = require('../protocols/preprocessing/quotients.js');

/**
 * Contains miscellaneous protocols (mostly used in preprocessing)
 * @name protocols
 * @alias protocols
 * @namespace
 */
module.exports = function (jiffClient) {
  /**
   * Creates shares of an unknown random number. Every party comes up with its own random number and shares it.
   * Then every party combines all the received shares to construct one share of the random unknown number.
   * @method
   * @memberof protocols
   * @param {number} threshold - the min number of parties needed to reconstruct the secret after it is computed.
   * @param {Array} receivers_list - array of party ids to receive the result.
   * @param {Array} compute_list - array of party ids to perform the protocol.
   * @param {number} Zp - the mod.
   * @param {object} params - an object containing extra parameters passed by the user.
   *                                 Expects:
   *                               - op_id: the base id to use for operation during the execution of this protocol, defaults to auto generated.
   *                               - compute_threshold: the threshold to use during computation: defaults to compute_list.length
   * @return {Object} contains 'share' (this party's share of the result) and 'promise'.
   */
  jiffClient.protocols.generate_random_number = numbers.generate_random_number.bind(null, jiffClient);

  /**
   * Creates shares of 0, such that no party knows the other parties' shares.
   * Every party secret shares 0, then every party sums all the shares they received, resulting
   * in a new share of 0 for every party.
   * @method
   * @memberof protocols
   * @param {number} threshold - the min number of parties needed to reconstruct the secret after it is computed.
   * @param {Array} receivers_list - array of party ids to receive the result.
   * @param {Array} compute_list - array of party ids to perform the protocol.
   * @param {number} Zp - the mod.
   * @param {object} params - an object containing extra parameters passed by the user.
   *                                 Expects:
   *                               - op_id: the base id to use for operation during the execution of this protocol, defaults to auto generated.
   *                               - compute_threshold: the threshold to use during computation: defaults to compute_list.length
   * @return {Object} contains 'share' (this party's share of the result) and 'promise'.
   */
  jiffClient.protocols.generate_zero = numbers.generate_zero.bind(null, jiffClient);

  /**
   * Generates a random bit under MPC by xoring all bits sent by participating parties
   * @method
   * @memberof protocols
   * @param {number} threshold - the min number of parties needed to reconstruct the secret after it is computed.
   * @param {Array} receivers_list - array of party ids to receive the result.
   * @param {Array} compute_list - array of party ids to perform the protocol.
   * @param {number} Zp - the mod.
   * @param {object} params - an object containing extra parameters passed by the user.
   *                                 Expects:
   *                               - op_id: the base id to use for operation during the execution of this protocol, defaults to auto generated.
   *                               - compute_threshold: the threshold to use during computation: defaults to compute_list.length
   * @return {Object} contains 'share' (this party's share of the generated bit) and 'promise'.
   */
  jiffClient.protocols.generate_random_bit_bgw = bits.generate_random_bit_bgw.bind(null, jiffClient);

  /**
   * Generates a sequence of random bits under MPC.
   * @method
   * @memberof protocols
   * @param {number} [threshold=receivers_list.length] - the threshold of the bit when stored by receivers after generation.     * @param {number} threshold - the min number of parties needed to reconstruct the secret after it is computed.
   * @param {Array} receivers_list - array of party ids to receive the result.
   * @param {Array} compute_list - array of party ids to perform the protocol.
   * @param {number} Zp - the mod.
   * @param {object} params - an object containing extra parameters passed by the user.
   *                                 Expects:
   *                               - op_id: the base id to use for operation during the execution of this protocol, defaults to auto generated.
   *                               - count: how many random bits to generate.
   *                               - compute_threshold: the threshold to use during computation: defaults to compute_list.length
   * @param {object} protocols - the protocols to use for preprocessing.
   * @return {Object} contains 'share' (array of secret shares bits) and 'promise'.
   */
  jiffClient.protocols.generate_random_bits = bits.generate_random_bits.bind(null, jiffClient);

  /**
   * Generation of beaver triplet via MPC, uses the server for communication channels, but not for generation
   * @method
   * @memberof protocols
   * @param {number} threshold - the threshold of the triplets when stored by receivers after generation
   * @param {Array} receivers_list - array of party ids that want to receive the triplet shares
   * @param {Array} compute_list - array of party ids that will perform this protocol
   * @param {number} Zp - the mod
   * @param {object} params - an object containing extra parameters passed by the user
   *                               Expects:
   *                               - op_id: the base id to use for operation during the execution of this protocol, defaults to auto generated
   *                               - an optional number compute_threshold parameter, which specifies threshold used
   *                               during the protocol execution. By default, this is the length of the (compute_list+1)/2
   * @param {object} protocols - the sub protocols to use for preprocessing
   * @return {object} all pre-processing protocols must return an object with these keys:
   *  {
   *    'share': the share(s)/value(s) to store attached to op_id for later use by the computation (i.e. the result of preprocessing),
   *    'promise': a promise for when this protocol is fully completed (could be null if the protocol was already completed)
   *  }
   *  In this case, 'share' is an array of this party's shares of the resulting triplet, a,b,c such that a*b=c
   */
  jiffClient.protocols.generate_beaver_bgw = triplets.bind(null, jiffClient);

  /**
   * Creates shares of r and x, such that r is a uniform random number between 0 and Zp, and x is floor(r/constant)
   * where constant is provided by the extra params
   * @method
   * @memberof protocols
   * @param {number} threshold - the min number of parties needed to reconstruct the secret after it is computed
   * @param {Array} receivers_list - array of party ids to receive the result
   * @param {Array} compute_list - array of party ids to perform the protocol
   * @param {number} Zp - the mod
   * @param {object} params - an object containing extra parameters passed by the user
   *                                 Expects:
   *                               - op_id: the base id to use for operation during the execution of this protocol, defaults to auto generated
   *                               - compute_threshold: the threshold to use during computation: defaults to compute_list.length
   *                               - constant: the constant to divide the random number by.
   *                               - output_op_id: the set op id of the output quotient and noise
   * @return {Object} contains 'share' (this party's share of the result) and 'promise'
   */
  jiffClient.protocols.generate_random_and_quotient = quotients.bind(null, jiffClient);
};