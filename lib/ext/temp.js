share.smult = function (o, op_id) {
  var final_deferred = new Deferred();
  var final_promise = final_deferred.promise;

  var ready_mult = function () {
    var result = [];
    var promises = [];
    for (var i = 0; i < share.value.length; i++) {
      var share_tmp = jiff.secret_share(share.jiff, true, null, share.value[i], share.holders, share.threshold, share.Zp);
      var o_tmp = jiff.secret_share(o.jiff, true, null, o.value[i], o.holders, o.threshold, o.Zp);
      var multshare = share_tmp.legacy.smult(o_tmp, op_id + ':' + i);
      promises.push(multshare.promise);

      //var cb = function (i, multshare) {
      //  result[i] = multshare.value;
      //};
      //multshare.promise.then(cb.bind(null, i, multshare));

      multshare.promise.then((function (i, multshare){
        result[i] = multshare.value;
      }).bind(null, i, multshare));
    }

    Promise.all(promises).then(function () {
      console.log(result);
      final_deferred.resolve(result);
    }, share.error);
  };

  if (share.ready && o.ready) {
    if (typeof (share.value) === 'number') {
      var res = share.legacy.smult(o, op_id);
      res.promise.then(function () {
        final_deferred.resolve(res.value);
      });
    } else {
      ready_mult();
    }
  }

  // promise to execute ready_add when both are ready
  share.pick_promise(o).then(function () {
    if (typeof (share.value) === 'number') {
      var res = share.legacy.smult(o, op_id);
      res.promise.then(function () {
        final_deferred.resolve(res.value);
      });
    } else {
      ready_mult();
    }
  }, share.error);

  return share.jiff.secret_share(share.jiff, false, final_promise, undefined, share.holders, max(share.threshold, o.threshold), share.Zp);
};