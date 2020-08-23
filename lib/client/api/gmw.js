var sharing = require('../protocols/gmw/share.js');
var opening = require('../protocols/gmw/open.js');
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
};
