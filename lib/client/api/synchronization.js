module.exports = function (jiffClient) {
  var maxBarrierId = 10000000;
  var currentBarrierId = 0;
  var openBarriers = 0;

  /**
   * Starts a new barrier, all promises and secret shares created between this call and the corresponding start_barrier
   * call will be part of this barrier. start_barrier may be called before previous barriers are resolved, in which
   * case promises / secret shares created will be part of the new barrier as well as any previous barriers.
   * @memberof module:jiff-client~JIFFClient
   * @method start_barrier
   * @instance
   * @returns {number} a barrier id that identifies this barrier.
   */
  jiffClient.start_barrier = function () {
    openBarriers++;
    currentBarrierId = (currentBarrierId + 1 % maxBarrierId);
    jiffClient.barriers[currentBarrierId] = [];
    return currentBarrierId;
  };

  /**
   * Adds given promise to all active barriers.
   * @memberof module:jiff-client~JIFFClient
   * @method add_to_barriers
   * @instance
   * @param {promise} promise - the promise to add.
   */
  jiffClient.add_to_barriers = function (promise) {
    if (openBarriers > 0) {
      for (var id in jiffClient.barriers) {
        if (jiffClient.barriers.hasOwnProperty(id)) {
          jiffClient.barriers[id].push(promise);
        }
      }
    }
  };

  /**
   * Executes the callback only after all promises / secret shares in the barrier were resolved.
   * @memberof module:jiff-client~JIFFClient
   * @method end_barrier
   * @instance
   * @param {number} [barrier_id=jiff.barriers.length - 1] - identifies the barrier, should be returned by start_barrier.
   *                                                         by default, barrier_id will refer to the last barrier.
   * @returns {promise} a promise that resolves after the secret shares are resolved.
   */
  jiffClient.end_barrier = function (barrier_id) {
    if (openBarriers === 0) {
      return;
    }

    openBarriers--;
    if (barrier_id == null) {
      barrier_id = currentBarrierId;
    }

    var promise = Promise.all(jiffClient.barriers[barrier_id]);
    delete jiffClient.barriers[barrier_id];
    return promise;
  };
};