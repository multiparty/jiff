var arithmetic = require('../protocols/bits/arithmetic.js');
var comparison = require('../protocols/bits/comparison.js');
var otherProtocols = require('../protocols/bits/protocols.js');
var sharing = require('../protocols/bits/sharing.js');

/**
 * Contains bits protocols (including rejection sampling and bits operations)
 *
 * <b>Important: bit protocols (including bit_decomposition) are unaware of any extension specific customizations, and will operate as
 * on the given shares as if they are natural numbers in Zp. Make sure to take into consideration any magnification/shift transformations
 * needed to translate correctly between plain representations and extension representations of bits! </b>
 * @alias bits
 * @namespace
 */

module.exports = function (jiffClient) {
  /**
   * Compute sum of bitwise secret shared number and a constant
   * @method
   * @memberof bits
   * @param {module:jiff-client~JIFFClient#SecretShare[]} bits - the bit wise secret shares
   * @param {number} constant - the constant
   * @param {string} [op_id=<auto-generate-id>] - the base operation id to use when generating unique ids for communication
   *                                              default value should suffice when the code of all parties executes all instructions
   *                                              in the same exact order, otherwise, a unique base name is needed here
   * @returns {module:jiff-client~JIFFClient#SecretShare[]} bitwise sharing of the result. Note that the length here will be max(|bits|, |constant|) + 1
   *                          in case of potential overflow / carry
   */
  jiffClient.protocols.bits.cadd = arithmetic.cadd.bind(null, jiffClient);
  /**
   * Compute [secret bits] - [constant bits]
   * @method
   * @memberof bits
   * @param {number} constant - the constant
   * @param {module:jiff-client~JIFFClient#SecretShare[]} bits - the bit wise secret shares
   * @param {string} [op_id=<auto-generate-id>] - the base operation id to use when generating unique ids for communication.
   *                                              default value should suffice when the code of all parties executes all instructions
   *                                              in the same exact order, otherwise, a unique base name is needed here
   * @returns {module:jiff-client~JIFFClient#SecretShare[]} bitwise sharing of the result. Note that the length of the returned result is |bits|+1, where
   *                          the bit at index 0 is the least significant bit. The bit at index 1 is the most significant bit,
   *                          and the bit at index |bits| is 1 if the result overflows, or 0 otherwise
   */
  jiffClient.protocols.bits.csubl = arithmetic.csubl.bind(null, jiffClient);
  /**
   * Compute [constant bits] - [secret bits]
   * @method
   * @memberof bits
   * @param {number} constant - the constant
   * @param {module:jiff-client~JIFFClient#SecretShare[]} bits - the bit wise secret shares
   * @param {string} [op_id=<auto-generate-id>] - the base operation id to use when generating unique ids for communication.
   *                                              default value should suffice when the code of all parties executes all instructions
   *                                              in the same exact order, otherwise, a unique base name is needed here
   * @returns {module:jiff-client~JIFFClient#SecretShare[]} bitwise sharing of the result. Note that the length of the returned result is |bits|+1, where
   *                          the bit at index 0 is the least significant bit. The bit at index 1 is the most significant bit,
   *                          and the bit at index |bits| is 1 if the result overflows, or 0 otherwise
   */
  jiffClient.protocols.bits.csubr = arithmetic.csubr.bind(null, jiffClient);
  /**
   *
   * Compute [secret bits1] + [secret bits2]
   * @method
   * @memberof bits
   * @param {module:jiff-client~JIFFClient#SecretShare[]} bits1 - the first bitwise shared number: array of secrets with index 0 being least significant bit
   * @param {module:jiff-client~JIFFClient#SecretShare[]} bits2 - the second bitwise shared number (length may be different)
   * @param {string} [op_id=<auto-generate-id>] - the base operation id to use when generating unique ids for communication.
   *                                              default value should suffice when the code of all parties executes all instructions
   *                                              in the same exact order, otherwise, a unique base name is needed here
   * @returns {module:jiff-client~JIFFClient#SecretShare[]} bitwise sharing of the result. Note that the length of the returned result is |bits|+1, where
   *                          the bit at index 0 is the least significant bit
   */
  jiffClient.protocols.bits.sadd = arithmetic.sadd.bind(null, jiffClient);
  /**
   * Compute [secret bits1] - [secret bits2]
   * @method
   * @memberof bits
   * @param {module:jiff-client~JIFFClient#SecretShare[]} bits1 - first bitwise secret shared number: lower indices represent less significant bits
   * @param {module:jiff-client~JIFFClient#SecretShare[]} bits2 - second bitwise secret shared number (length may be different)
   * @param {string} [op_id=<auto-generate-id>] - the base operation id to use when generating unique ids for communication.
   *                                              default value should suffice when the code of all parties executes all instructions
   *                                              in the same exact order, otherwise, a unique base name is needed here
   * @returns {module:jiff-client~JIFFClient#SecretShare[]} bitwise sharing of the result. Note that the length of the returned result is |bits|+1, where
   *                          the bit at index 0 is the least significant bit. The bit at index 1 is the most significant bit,
   *                          and the bit at index |bits| is 1 if the result overflows, or 0 otherwise
   */
  jiffClient.protocols.bits.ssub = arithmetic.ssub.bind(null, jiffClient);
  /**
   * Compute [secret bits] * constant
   * @method
   * @memberof bits
   * @param {module:jiff-client~JIFFClient#SecretShare[]} bits - bitwise shared secret to multiply: lower indices represent less significant bits
   * @param {number} constant - constant to multiply with
   * @param {string} [op_id=<auto-generate-id>] - the base operation id to use when generating unique ids for communication.
   *                                              default value should suffice when the code of all parties executes all instructions
   *                                              in the same exact order, otherwise, a unique base name is needed here
   * @returns {module:jiff-client~JIFFClient#SecretShare[]} bitwise sharing of the result, the length of the result will be bits.length + ceil(log2(constant)), except
   *                          if constant is zero, the result will then be [ zero share ]
   */
  jiffClient.protocols.bits.cmult = arithmetic.cmult.bind(null, jiffClient);
  /**
   * Compute [secret bits1] * [secret bits2]
   * @method
   * @memberof bits
   * @param {module:jiff-client~JIFFClient#SecretShare[]} bits1 - bitwise shared secret to multiply: lower indices represent less significant bits
   * @param {module:jiff-client~JIFFClient#SecretShare[]} bits2 - bitwise shared secret to multiply
   * @param {string} [op_id=<auto-generate-id>] - the base operation id to use when generating unique ids for communication.
   *                                              default value should suffice when the code of all parties executes all instructions
   *                                              in the same exact order, otherwise, a unique base name is needed here
   * @returns {module:jiff-client~JIFFClient#SecretShare[]} bitwise sharing of the result, the length of the result will be bits1.length + bits2.length
   */
  jiffClient.protocols.bits.smult = arithmetic.smult.bind(null, jiffClient);
  /**
   * Computes integer division of [secret bits 1] / [secret bits 2]
   * @method
   * @memberof bits
   * @param {module:jiff-client~JIFFClient#SecretShare[]} bits1 - an array of secret shares of bits, starting from least to most significant bits
   * @param {module:jiff-client~JIFFClient#SecretShare[]} bits2 - the second bitwise shared number
   * @param {string} [op_id=<auto-generate-id>] - the base operation id to use when generating unique ids for multiplications
   *                                              default value should suffice when the code of all parties executes all instructions
   *                                              in the same exact order, otherwise, a unique base name is needed here
   * @returns {{quotient: module:jiff-client~JIFFClient#SecretShare[], remainder: module:jiff-client~JIFFClient#SecretShare[]}} the quotient and remainder bits arrays, note that
   *                                                                the quotient array has the same length as bits1,
   *                                                                and the remainder array has the same length as bits2 or bits1, whichever is smaller.
   *                                                                Note: if bits2 represent 0, the returned result is the maximum
   *                                                                number that fits in the number of bits (all 1), and the remainder
   *                                                                is equal to bits1
   */
  jiffClient.protocols.bits.sdiv = arithmetic.sdiv.bind(null, jiffClient);
  /**
   * Computes integer division of [secret bits] / constant
   * @method
   * @memberof bits
   * @param {module:jiff-client~JIFFClient#SecretShare[]} bits - numerator: an array of secret shares of bits, starting from least to most significant bits
   * @param {number} constant - the denominator number
   * @param {string} [op_id=<auto-generate-id>] - the base operation id to use when generating unique ids for multiplications.
   *                                              default value should suffice when the code of all parties executes all instructions
   *                                              in the same exact order, otherwise, a unique base name is needed here
   * @returns {{quotient: module:jiff-client~JIFFClient#SecretShare[], remainder: module:jiff-client~JIFFClient#SecretShare[]}} the quotient and remainder bits arrays, note that
   *                                                                the quotient array has the same length as bits,
   *                                                                and the remainder array has the same length as
   *                                                                constant or bits, whichever is smaller
   * @throws if constant is 0.
   */
  jiffClient.protocols.bits.cdivl = arithmetic.cdivl.bind(null, jiffClient);
  /**
   * Computes integer division of constant / [secret bits]
   * @method
   * @memberof bits
   * @param {number} constant - the numerator number
   * @param {module:jiff-client~JIFFClient#SecretShare[]} bits - denominator: an array of secret shares of bits, starting from least to most significant bits
   * @param {string} [op_id=<auto-generate-id>] - the base operation id to use when generating unique ids for multiplications.
   *                                              default value should suffice when the code of all parties executes all instructions
   *                                              in the same exact order, otherwise, a unique base name is needed here
   * @returns {{quotient: module:jiff-client~JIFFClient#SecretShare[], remainder: module:jiff-client~JIFFClient#SecretShare[]}} the quotient and remainder bits arrays, note that
   *                                                                the quotient array has the same length as the number of bits in constant,
   *                                                                and the remainder array has the same length as bits or constant, whichever is smaller.
   *                                                                Note: if bits represent 0, the returned result is the maximum
   *                                                                number that fits in its bits (all 1), and the remainder
   *                                                                is equal to constant
   */
  jiffClient.protocols.bits.cdivr = arithmetic.cdivr.bind(null, jiffClient);

  /**
   * Checks whether the given bitwise secret shared number and numeric constant are equal
   * @method
   * @memberof bits
   * @param {module:jiff-client~JIFFClient#SecretShare[]} bits - an array of secret shares of bits, starting from least to most significant bits
   * @param {number} constant - the constant number
   * @param {string} [op_id=<auto-generate-id>] - the base operation id to use when generating unique ids for multiplications.
   *                                              default value should suffice when the code of all parties executes all instructions
   *                                              in the same exact order, otherwise, a unique base name is needed here
   * @returns {SecretShare|boolean} a secret share of 1 if parameters are equal, 0 otherwise. If result is known
   *                                (e.g. constant has a greater non-zero bit than bits' most significant bit), the result is
   *                                returned immediately as a boolean
   */
  jiffClient.protocols.bits.ceq = comparison.ceq.bind(null, jiffClient);
  /**
   * Checks whether the given bitwise secret shared number and numeric constant are not equal
   * @method
   * @memberof bits
   * @param {module:jiff-client~JIFFClient#SecretShare[]} bits - an array of secret shares of bits, starting from least to most significant bits
   * @param {number} constant - the constant number
   * @param {string} [op_id=<auto-generate-id>] - the base operation id to use when generating unique ids for multiplications.
   *                                              default value should suffice when the code of all parties executes all instructions
   *                                              in the same exact order, otherwise, a unique base name is needed here
   * @returns {SecretShare|boolean} a secret share of 1 if parameters are not equal, 0 otherwise. If result is known
   *                                (e.g. constant has a greater non-zero bit than bits' most significant bit), the result is
   *                                returned immediately as a boolean
   */
  jiffClient.protocols.bits.cneq = comparison.cneq.bind(null, jiffClient);
  /**
   * Checks whether given secret shared bits are greater than the given constant
   * @method
   * @memberof bits
   * @param {module:jiff-client~JIFFClient#SecretShare[]} bits - an array of the secret shares of bits, starting from least to most significant bits
   * @param {number} constant - the constant number
   * @param {string} [op_id=<auto-generate-id>] - the base operation id to use when generating unique ids for multiplications
   *                                              default value should suffice when the code of all parties executes all instructions
   *                                              in the same exact order, otherwise, a unique base name is needed here
   * @returns {SecretShare|boolean} a secret share of 1 if bits are greater than constant, 0 otherwise, if result is known
   *                                (e.g. constant has greater non-zero bit than bits' most significant bit), the result is
   *                                returned immediately as a boolean
   */
  jiffClient.protocols.bits.cgt = comparison.cgt.bind(null, jiffClient);
  /**
   * Checks whether given secret shared bits are greater or equal to the given constant
   * @method
   * @memberof bits
   * @param {module:jiff-client~JIFFClient#SecretShare[]} bits - an array of the secret shares of bits, starting from least to most significant bits
   * @param {number} constant - the constant number
   * @param {string} [op_id=<auto-generate-id>] - the base operation id to use when generating unique ids for multiplications.
   *                                              default value should suffice when the code of all parties executes all instructions
   *                                              in the same exact order, otherwise, a unique base name is needed here
   * @returns {SecretShare|boolean} a secret share of 1 if bits are greater or equal to constant, 0 otherwise, if result is known
   *                                (e.g. constant has greater non-zero bit than bits' most significant bit or constant is zero), the result is
   *                                returned immediately as a boolean
   */
  jiffClient.protocols.bits.cgteq = comparison.cgteq.bind(null, jiffClient);
  /**
   * Checks whether given secret shared bits are less than the given constant
   * @method
   * @memberof bits
   * @param {module:jiff-client~JIFFClient#SecretShare[]} bits - an array of the secret shares of bits, starting from least to most significant bits
   * @param {number} constant - the constant number
   * @param {string} [op_id=<auto-generate-id>] - the base operation id to use when generating unique ids for multiplications.
   *                                              default value should suffice when the code of all parties executes all instructions
   *                                              in the same exact order, otherwise, a unique base name is needed here
   * @returns {SecretShare|boolean} a secret share of 1 if bits are less than the constant, 0 otherwise, if result is known
   *                                (e.g. constant has greater non-zero bit than bits' most significant bit), the result is
   *                                returned immediately as a boolean
   */
  jiffClient.protocols.bits.clt = comparison.clt.bind(null, jiffClient);
  /**
   * Checks whether given secret shared bits are less or equal to the given constant
   * @method
   * @memberof bits
   * @param {module:jiff-client~JIFFClient#SecretShare[]} bits - an array of the secret shares of bits, starting from least to most significant bits
   * @param {number} constant - the constant number
   * @param {string} [op_id=<auto-generate-id>] - the base operation id to use when generating unique ids for multiplications.
   *                                              default value should suffice when the code of all parties executes all instructions
   *                                              in the same exact order, otherwise, a unique base name is needed here
   * @returns {SecretShare|boolean} a secret share of 1 if bits are less or equal to constant, 0 otherwise, if result is known
   *                                (e.g. constant has greater non-zero bit than bits' most significant bit), the result is
   *                                returned immediately as a boolean
   */
  jiffClient.protocols.bits.clteq = comparison.clteq.bind(null, jiffClient);
  /**
   * Checks whether the two given bitwise secret shared numbers are equal
   * @method
   * @memberof bits
   * @param {module:jiff-client~JIFFClient#SecretShare[]} bits1 - an array of secret shares of bits, starting from least to most significant bits
   * @param {module:jiff-client~JIFFClient#SecretShare[]} bits2 - the second bitwise shared number
   * @param {string} [op_id=<auto-generate-id>] - the base operation id to use when generating unique ids for multiplications.
   *                                              default value should suffice when the code of all parties executes all instructions
   *                                              in the same exact order, otherwise, a unique base name is needed here
   * @returns {module:jiff-client~JIFFClient#SecretShare} a secret share of 1 if bits are equal, 0 otherwise
   */
  jiffClient.protocols.bits.seq = comparison.seq.bind(null, jiffClient);
  /**
   * Checks whether the two given bitwise secret shared numbers are not equal
   * @method
   * @memberof bits
   * @param {module:jiff-client~JIFFClient#SecretShare[]} bits1 - an array of secret shares of bits, starting from least to most significant bits
   * @param {module:jiff-client~JIFFClient#SecretShare[]} bits2 - the second bitwise shared number
   * @param {string} [op_id=<auto-generate-id>] - the base operation id to use when generating unique ids for multiplications.
   *                                              default value should suffice when the code of all parties executes all instructions
   *                                              in the same exact order, otherwise, a unique base name is needed here
   * @returns {module:jiff-client~JIFFClient#SecretShare} a secret share of 1 if bits are not equal, 0 otherwise
   */
  jiffClient.protocols.bits.sneq = comparison.sneq.bind(null, jiffClient);
  /**
   * Checks whether the first given bitwise secret shared number is greater than the second bitwise secret shared number
   * @method
   * @memberof bits
   * @param {module:jiff-client~JIFFClient#SecretShare[]} bits1 - an array of secret shares of bits, starting from least to most significant bits
   * @param {module:jiff-client~JIFFClient#SecretShare[]} bits2 - the second bitwise shared number
   * @param {string} [op_id=<auto-generate-id>] - the base operation id to use when generating unique ids for multiplications.
   *                                              default value should suffice when the code of all parties executes all instructions
   *                                              in the same exact order, otherwise, a unique base name is needed here
   * @returns {module:jiff-client~JIFFClient#SecretShare} a secret share of 1 if the first number is greater than the second, 0 otherwise
   */
  jiffClient.protocols.bits.sgt = comparison.sgt.bind(null, jiffClient);
  /**
   * Checks whether the first given bitwise secret shared number is greater than or equal to the second bitwise secret shared number
   * @method
   * @memberof bits
   * @param {module:jiff-client~JIFFClient#SecretShare[]} bits1 - an array of secret shares of bits, starting from least to most significant bits
   * @param {module:jiff-client~JIFFClient#SecretShare[]} bits2 - the second bitwise shared number
   * @param {string} [op_id=<auto-generate-id>] - the base operation id to use when generating unique ids for multiplications.
   *                                              default value should suffice when the code of all parties executes all instructions
   *                                              in the same exact order, otherwise, a unique base name is needed here
   * @returns {module:jiff-client~JIFFClient#SecretShare} a secret share of 1 if the first number is greater or equal to the second, 0 otherwise
   */
  jiffClient.protocols.bits.sgteq = comparison.sgteq.bind(null, jiffClient);
  /**
   * Checks whether the first given bitwise secret shared number is less than the second bitwise secret shared number
   * @method
   * @memberof bits
   * @param {module:jiff-client~JIFFClient#SecretShare[]} bits1 - an array of secret shares of bits, starting from least to most significant bits
   * @param {module:jiff-client~JIFFClient#SecretShare[]} bits2 - the second bitwise shared number
   * @param {string} [op_id=<auto-generate-id>] - the base operation id to use when generating unique ids for multiplications.
   *                                              default value should suffice when the code of all parties executes all instructions
   *                                              in the same exact order, otherwise, a unique base name is needed here
   * @returns {module:jiff-client~JIFFClient#SecretShare} a secret share of 1 if the first number is less than the second, 0 otherwise
   */
  jiffClient.protocols.bits.slt = comparison.slt.bind(null, jiffClient);
  /**
   * Checks whether the first given bitwise secret shared number is less or equal to the second bitwise secret shared number
   * @method
   * @memberof bits
   * @param {module:jiff-client~JIFFClient#SecretShare[]} bits1 - an array of secret shares of bits, starting from least to most significant bits
   * @param {module:jiff-client~JIFFClient#SecretShare[]} bits2 - the second bitwise shared number
   * @param {string} [op_id=<auto-generate-id>] - the base operation id to use when generating unique ids for multiplications.
   *                                              default value should suffice when the code of all parties executes all instructions
   *                                              in the same exact order, otherwise, a unique base name is needed here
   * @returns {module:jiff-client~JIFFClient#SecretShare} a secret share of 1 if the first number is less than or equal to the second, 0 otherwise
   */
  jiffClient.protocols.bits.slteq = comparison.slteq.bind(null, jiffClient);

  /**
   * Retrieves preprocessed rejection_sampling bits or performs the rejection sampling on the fly if crypto_provider is enabled
   * @method
   * @memberof bits
   * @param {number} lower_bound - the lower bound, included (can be a bigNumber if using bigNumber extension)
   * @param {number} upper_bound - the upper bound, excluded (can be a bigNumber if using bigNumber extension)
   * @param {number} [threshold=parties.length] - the threshold of the resulting shares after sampling
   * @param {Array} [parties=all_parties] - array of party ids that want to receive (or compute if needed) the sampling shares, by default, this includes all parties
   * @param {number} [Zp=jiff-instance.Zp] - the mod (if null then the default Zp for the instance is used)
   * @param {string} [op_id=auto_gen()] - the operation id which is used to identify this operation.
   *                         This id must be unique, and must be passed by all parties to the same instruction, to
   *                         ensure that corresponding instructions across different parties are matched correctly
   * @returns {SecretShare[]} an array of secret shares, each representing a bit from the sampled value (from least to most significant)
   */
  jiffClient.protocols.bits.rejection_sampling = otherProtocols.rejection_sampling.bind(null, jiffClient);

  /**
   * Creates a secret share of the number represented by the given array of secret shared bits.
   * Requires no communication, only local operations
   * @method
   * @memberof bits
   * @param {module:jiff-client~JIFFClient#SecretShare[]} bits - an array of the secret shares of bits, starting from least to most significant bits.
   * @returns {module:jiff-client~JIFFClient#SecretShare} a secret share of the number represented by bits.
   */
  jiffClient.protocols.bits.bit_composition = otherProtocols.bit_composition;

  /**
   * Share a number as an array of secret bits
   * This takes the same parameters as jiff-instance.share, but returns an array of secret bit shares per sending party.
   * Each bit array starts with the least significant bit at index 0, and most significant bit at index length-1
   * @method
   * @memberof bits
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
  jiffClient.protocols.bits.share = sharing.share_bits.bind(null, jiffClient);
  /**
   * Opens the given array of secret shared bits.
   * This works regardless of whether the represented value fit inside the corresponding field or not
   * @method
   * @memberof bits
   * @param {module:jiff-client~JIFFClient#SecretShare[]} bits - an array of the secret shares of bits, starting from least to most significant bits
   * @param {number[]} parties - parties to open (same as jiff_instance.open)
   * @param {string|number} [op_id=auto_gen()] - same as jiff_instance.open
   * @returns {promise} a promise to the number represented by bits
   */
  jiffClient.protocols.bits.open = sharing.open_bits.bind(null, jiffClient);
  /**
   * Receives an opening of an array of secret bits without owning shares of the underlying value.
   * Similar to jiff.receive_open() but for bits.
   * This works regardless of whether the represented value fit inside the corresponding field or not
   * @method
   * @memberOf jiff-instance.protocols.bits
   * @param {Array} senders - an array with party ids (1 to n) specifying the parties sending the shares
   * @param {Array} [receivers=all_parties] - an array with party ids (1 to n) specifying the parties receiving the result
   * @param {number} [count=ceil(log2(Zp))] - the number of bits being opened
   * @param {number} [threshold=parties.length] - the min number of parties needed to reconstruct the secret, defaults to all the senders
   * @param {number} [Zp=jiff_instance.Zp] - the mod (if null then the default Zp for the instance is used)
   * @param {string|number|object} [op_id=auto_gen()] - unique and consistent synchronization id between all parties
   * @returns {promise} a (JQuery) promise to the open value of the secret
   */
  jiffClient.protocols.bits.receive_open = sharing.receive_open_bits.bind(null, jiffClient);
};