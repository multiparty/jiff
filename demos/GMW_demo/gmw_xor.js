
//public xor locally on my shares a0,b0, var ci=ai^bi;
function gmw_xor(jiff,share1,share2) {
  if (!(share1.jiff === share2.jiff)) {
    throw new Error('shares do not belong to the same instance (^)');
  }
  if (!share1.jiff.helpers.Zp_equals(share1, share2)) {
    throw new Error('shares must belong to the same field (^)');
  }
  if (!share1.jiff.helpers.array_equals(share1.holders, share2.holders)) {
    throw new Error('shares must be held by the same parties (^)');
  }

  // XOR the two shares when ready locally
  var ready = function () {
    return share1.value ^ share2.value;
  };

  // promise to execute ready_XOR when both are ready
  return new share1.jiff.SecretShare(share1.when_both_ready(share2, ready), share1.holders, Math.max(share1.threshold, share2.threshold), share1.Zp);
}

module.exports = {
  gmw_xor: gmw_xor
};
