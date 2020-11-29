var sharing = require('../protocols/gmw/share.js');
var opening = require('../protocols/gmw/open.js');
var arithmetic = require('../protocols/gmw/arithmetic.js');
var composition = require('../protocols/gmw/composition.js');
// var otherProtocols = require('../protocols/gmw/protocols.js');
let ioHandlers = require('../protocols/gmw/io.js');  // used for gmw bit computation (OT lib)
let obliviousTransfer = require('1-out-of-n')(ioHandlers);

/**
 * Contains GMW related protocols (including rejection sampling and bits operations)
 *
 * <b>Important: bit protocols (including bit_decomposition) are unaware of any extension specific customizations, and will operate as
 * on the given shares as if they are natural numbers in Zp. Make sure to take into consideration any magnification/shift transformations
 * needed to translate correctly between plain representations and extension representations of bits! </b>
 * @alias gmw
 * @namespace
 */

module.exports = function (jiffClient) {
  jiffClient.OT = obliviousTransfer;

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
  jiffClient.protocols.gmw.bits.sadd = arithmetic.sadd.bind(null, jiffClient);

  /**
   * Compute sum of bitwise secret shared number and a constant
   * @function cadd
   * @ignore
   * @param {module:jiff-client~JIFFClient} jiff - the jiff client instance
   * @param {module:jiff-client~JIFFClient#SecretShare[]} bits - the bit wise secret shares
   * @param {number} constant - the constant
   * @param {string} [op_id=<auto-generate-id>] - the base operation id to use when generating unique ids for communication
   *                                              default value should suffice when the code of all parties executes all instructions
   *                                              in the same exact order, otherwise, a unique base name is needed here
   * @returns {module:jiff-client~JIFFClient#SecretShare[]} bitwise sharing of the result. Note that the length here will be max(|bits|, |constant|) + 1
   *                          in case of potential overflow / carry
   */
  // jiffClient.protocols.gmw.bits.cadd = arithmetic.cadd.bind(null, jiffClient);

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
  jiffClient.protocols.gmw.bits.smult = arithmetic.smult.bind(null, jiffClient);

  /**
   * [compose description]
   * @type {[type]}
   */
  jiffClient.protocols.gmw.bits.compose = composition.compose.bind(null, jiffClient);
};
