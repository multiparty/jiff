// Manages op_id counters and generation
module.exports = function (jiffClient) {

  /**
   * Resets all the counters for op_ids
   * @method counters.reset
   * @memberof module:jiff-client~JIFFClient
   * @instance
   */
  jiffClient.counters.reset = function () {
    jiffClient.counters.op_count = {};
    jiffClient.counters.op_count_preprocessing = {};

    if (jiffClient.counters.pending_opens == null) {
      jiffClient.counters.pending_opens = 0;
    }

    // stores a seed for generating unique op_ids.
    jiffClient.op_id_seed = '';
  };

  // initialize the counters for the first time
  jiffClient.counters.reset();

  /**
   * Shorthand for generating unique operation ids.
   * All primitives called after this seed will use their usual default ids prefixed by the seed.
   * Helpful when we have nested callbacks/functions (e.g. share_arrays) that may be executed in arbitrary order,
   * using this function as a the first call inside such callbacks with an appropriate deterministic unique base_op_id
   * ensures that regardless of the order of execution, operations in the same callback are matched correctly across
   * all parties.
   * Check out demos/graph-pip/mpc.js for an example on using this.
   * @method seed_ids
   * @memberof module:jiff-client~JIFFClient
   * @instance
   * @param {string|number} base_op_id - the base seed to use as a prefix for all future op_ids.
   */
  jiffClient.seed_ids = function (base_op_id) {
    if (base_op_id == null || base_op_id === '') {
      jiffClient.op_id_seed = '';
    } else {
      jiffClient.op_id_seed = base_op_id.toString() + ':';
    }
  };

  /**
   * Generate a unique operation id for a new operation object.
   * The returned op_id will be unique with respect to other operations, and identifies the same
   * operation across all parties, as long as all parties are executing instructions in the same order.
   * @method gen_op_id
   * @memberof module:jiff-client~JIFFClient
   * @instance
   * @param {string} op - the type/name of operation performed.
   * @param {Array} holders - an array containing the ids of all the parties carrying out the operation.
   * @return {string} the op_id for the operation.
   */
  jiffClient.counters.gen_op_id = function (op, holders) {
    var label = jiffClient.op_id_seed + op + ':' + holders.join(',');
    if (jiffClient.counters.op_count[label] == null) {
      jiffClient.counters.op_count[label] = 0;
    }
    return label + ':' + (jiffClient.counters.op_count[label]++);
  };

  /**
   * Generate a unique operation id for a new operation object given two distinct executing parties lists.
   * For example, when sharing, this is given two potentially different lists of senders and receivers.
   * The returned op_id will be unique with respect to other operations, and identifies the same
   * operation across all parties, as long as all parties are executing instructions in the same order.
   * @method gen_op_id2
   * @memberof module:jiff-client~JIFFClient
   * @instance
   * @param {string} op - the type/name of operation performed.
   * @param {Array} receivers - an array containing the ids of all the parties carrying out the receiving portion of the operation.
   * @param {Array} senders - an array containing the ids of all the parties carrying out the sending portion of the operation.
   * @return {string} the op_id for the operation.
   */
  jiffClient.counters.gen_op_id2 = function (op, receivers, senders) {
    var label = jiffClient.op_id_seed + op + ':' + senders.join(',') + ':' + receivers.join(',');
    if (jiffClient.counters.op_count[label] == null) {
      jiffClient.counters.op_count[label] = 0;
    }
    return label + ':' + (jiffClient.counters.op_count[label]++);
  };

  /**
   * Generate a unique operation id for a new operation object (for preprocessing)
   * The returned op_id will be unique with respect to other operations, and identifies the same
   * operation across all parties, as long as all parties are executing instructions in the same order.
   * @method gen_op_id_preprocessing
   * @memberof module:jiff-client~JIFFClient
   * @instance
   * @param {string} op - the type/name of operation performed.
   * @param {Array} holders - an array containing the ids of all the parties carrying out the operation.
   * @return {string} the op_id for the operation.
   */
  jiffClient.counters.gen_op_id_preprocessing = function (op, holders) {
    var label = jiffClient.op_id_seed + op + ':' + holders.join(',');
    if (jiffClient.counters.op_count_preprocessing[label] == null) {
      jiffClient.counters.op_count_preprocessing[label] = 0;
    }
    return label + ':' + (jiffClient.counters.op_count_preprocessing[label]++);
  };

  /**
   * Generate a unique operation id for a new operation object given two distinct executing parties lists (for preprocessing).
   * For example, when sharing, this is given two potentially different lists of senders and receivers.
   * The returned op_id will be unique with respect to other operations, and identifies the same
   * operation across all parties, as long as all parties are executing instructions in the same order.
   * @method gen_op_id2_preprocessing
   * @memberof module:jiff-client~JIFFClient
   * @instance
   * @param {string} op - the type/name of operation performed.
   * @param {Array} receivers - an array containing the ids of all the parties carrying out the receiving portion of the operation.
   * @param {Array} senders - an array containing the ids of all the parties carrying out the sending portion of the operation.
   * @return {string} the op_id for the operation.
   */
  jiffClient.counters.gen_op_id2_preprocessing = function (op, receivers, senders) {
    var label = jiffClient.op_id_seed + op + ':' + senders.join(',') + ':' + receivers.join(',');
    if (jiffClient.counters.op_count_preprocessing[label] == null) {
      jiffClient.counters.op_count_preprocessing[label] = 0;
    }
    return label + ':' + (jiffClient.counters.op_count_preprocessing[label]++);
  };
};