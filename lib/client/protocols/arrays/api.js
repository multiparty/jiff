const share = require('./share.js');
const _ArrayOpen = require('./open.js');
const util = require('./util.js');

const ArrayOpen = new _ArrayOpen();

module.exports = {
  jiff_share_array: share.share_array,
  jiff_share_2D_array: share.share_2D_array,
  jiff_share_ND_array: share.share_ND_array,
  jiff_share_ND_array_static: share.share_ND_array_static,
  jiff_share_ND_array_deferred: share.share_ND_array_deferred,

  jiff_skeleton_of: util.skeleton_of,

  jiff_open_array: ArrayOpen.open_array,
  jiff_open_ND_array: ArrayOpen.open_ND_array,
  jiff_receive_open_ND_array: ArrayOpen.receive_open_ND_array
};
