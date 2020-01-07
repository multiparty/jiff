module.exports = function (jiffClient) {
  /**
   * Wait until the public keys of these parties are known.
   * The public keys may be known before the parties connect (if provided in the options),
   * or they could be sent by the server after the parties connect.
   * Computation specified in the callback may assume that these parties are connected,
   * if they are not, the server will handle storing and relaying the needed messages
   * to them when they connect.
   * @memberof module:jiff-client~JIFFClient
   * @instance
   * @param {Array} parties - an array of party ids to wait for, must explicitly include 's1' if callback must wait for the server.
   * @param {function(jiff-instance)} callback - the function to execute when these parties are known.
   * @param {boolean} [wait_for_initialization=true] - specifies whether to wait for initialization to be complete
   *                                                   before executing the callback (even if parties are available).
   *                                                   Set this to false if you do not need the party count and this
   *                                                   party's id, or if you already have them, and you are certain
   *                                                   they will be accepted by the server on initialization.
   */
  jiffClient.wait_for = function (parties, callback, wait_for_initialization) {
    if (wait_for_initialization == null) {
      wait_for_initialization = true;
    }

    jiffClient.wait_callbacks.push({parties: parties, callback: callback, initialization: wait_for_initialization});
    jiffClient.execute_wait_callbacks(); // See if the callback can be executed immediately
  };

  /**
   * Disconnects from the computation.
   * Allows the client program to exit.
   * @method disconnect
   * @memberof module:jiff-client~JIFFClient
   * @instance
   * @param {boolean} [safe=false] - if true, jiff will disconnect safely (i.e. after ensuring all
   *                                 outgoing pending messages were delivered).
   * @param {boolean} [free=false] - if set to true, it means this party's disconnection is final, and all resources
   *                                 associated with this party must be freed.
   *                                 If all parties in a computation are freed, then all resources associated with the
   *                                 computation are freed, and any subsequent reconnection to the computation is as
   *                                 if a the connection is for a fresh new computation.
   * @param {function()} [callback] - executed after the instance safely disconnects, if safe is set to false, this
   *                                  parameter is ignored.
   */
  jiffClient.disconnect = function (safe, free, callback) {
    if (safe) {
      jiffClient.socket.safe_disconnect(free, callback);
    } else {
      if (free) {
        jiffClient.free();
      }
      jiffClient.socket.disconnect();
    }
  };

  /**
   * Emits event to free up all the resources allocated for this party on the server.
   * It is best not to call this function directly, as it can break things if resources still need to be used.
   * Instead, use jiff.disconnect(safe, free, callback) to free after safely disconnecting.
   * @see {@link module:jiff-client~JIFFClient#disconnect}
   * @method free
   * @memberof module:jiff-client~JIFFClient
   * @instance
   */
  jiffClient.free = function () {
    var msg = jiffClient.hooks.execute_array_hooks('beforeOperation', [jiffClient, 'free', {}], 2);
    jiffClient.socket.safe_emit('free', JSON.stringify(msg));
  };
};