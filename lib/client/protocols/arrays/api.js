const _ShareArray = require('./share.js');
const _OpenArray = require('./open.js');
const util = require('./util.js');

const OpenArray = new _OpenArray();
const ShareArray = new _ShareArray();

module.exports = {
  jiff_share_array: ShareArray.share_array,
  jiff_share_2D_array: ShareArray.share_2D_array,
  jiff_share_ND_array: ShareArray.share_ND_array,
  jiff_share_ND_array_static: ShareArray.share_ND_array_static,
  jiff_share_ND_array_deferred: ShareArray.share_ND_array_deferred,

  jiff_skeleton_of: util.skeleton_of,

  jiff_open_array: OpenArray.open_array,
  jiff_open_ND_array: OpenArray.open_ND_array,
  jiff_receive_open_ND_array: OpenArray.receive_open_ND_array
};
