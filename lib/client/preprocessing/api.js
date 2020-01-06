/**
 * Checks if the given operation uses preprocessed values.
 * @method has_preprocessing
 * @memberof jiff-instance
 * @instance
 * @param {string} op - name of the operation to check.
 * @return {boolean} true if the op uses preprocessing, false otherwise.
 */
jiff.has_preprocessing = function (op) {
  for (var i = 0; i < jiff.extensions.length; i++) {
    if (jiff.preprocessing_function_map[jiff.extensions[i]][op] != null) {
      return true;
    }
  }

  return false;
};

/**
 * Get a preprocessed share/value by associated op_id. If value does not exist
 * Fallback to some user specified way for creating it.
 * @method get_preprocessing
 * @memberof jiff-instance
 * @instance
 * @param {string} op_id - the op_id associated with the preprocessed value/share.
 * @return {object} the preprocessed share(s).
 */
jiff.get_preprocessing = function (op_id) {
  var values = jiff.preprocessing_table[op_id];
  if (values != null) {
    return values;
  }
  if (jiff.crypto_provider === true) {
    return null;
  }
  throw new Error('No preprocessed value(s) that correspond to the op_id "' + op_id + '"');
};

/**
 * Store a pair of op_id and associated pre-processed value/share.
 * The value/share can be accessed later during the computation through jiff.get_preprocessing(op_id).
 * @method store_preprocessing
 * @memberof jiff-instance
 * @instance
 * @param {string} op_id - the op_id associated with the preprocessed value/share.
 * @param {SecretShare} share - the share/value to store.
 */
jiff.store_preprocessing = function (op_id, share) {
  jiff.preprocessing_table[op_id] = share;
};

/**
 * Generate values used for jiff operations in advance of the general computation
 * @method preprocessing
 * @memberof jiff-instance
 * @instance
 * @param {string} dependent_op - name of the operation that will later use the pre_processed values
 * @param {Number} [count=1] - number of times the protocol should be performed, number of values that will be generated
 * @param {Number} [batch=count] - maximum number of parallel preprocessing tasks to execute in a single batch.
 * @param {Object} [protocols=defaults] - a mapping from base preprocessing elements ('beaver', 'bits', 'sampling') to functions that can pre-process them
 *                               the function must implement the same interface as the JIFF provided protocols (e.g. jiff.protocols.generate_beaver_bgw).
 *                               missing mappings indicate that JIFF must use the default protocols.
 * @param {Number} [threshold=receivers_list.length] - the threshold of the preprocessed shares.
 * @param {Array} [receivers_list=all_parties] - the parties that will receive the preprocsssed shares.
 * @param {Array} [compute_list=all_parties] - the parties that will compute the preprocsssed shares.
 * @param {Array} [Zp=jiff.Zp] - the Zp of the preprocessed shares.
 * @param {Array} [id_list=auto_gen()] - array of ids to be used sequentially to identify the pre_processed values. Optional.
 * @param {Object} [params={}] - any additional protocol-specific parameters.
 * @return {promise} a promise that is resolved when preprocessing is completed, null if this is called by a party that is neither a compute nor receiver party.
 */
jiff.preprocessing = function (dependent_op, count, batch, protocols, threshold, receivers_list, compute_list, Zp, id_list, params) {
  var start = jiff.preprocessingTasks.length === 0;

  // defaults!
  if (receivers_list == null) {
    receivers_list = [];
    for (var p = 1; p <= jiff.party_count; p++) {
      receivers_list.push(p);
    }
  }
  if (compute_list == null) {
    compute_list = [];
    for (var c = 1; c <= jiff.party_count; c++) {
      compute_list.push(c);
    }
  }

  // not a receiver nor a sender
  if (receivers_list.indexOf(jiff.id) === -1 && compute_list.indexOf(jiff.id) === -1) {
    return null;
  }

  // more defaults
  if (params == null) {
    params = {};
  }
  if (Zp == null) {
    Zp = jiff.Zp;
  }
  if (threshold == null) {
    threshold = receivers_list.length;
  }
  if (id_list == null) {
    id_list = [];
  }
  protocols = Object.assign({}, jiff.default_preprocessing_protocols, protocols);

  // actual preprocessing
  if (count == null || count <= 0) {
    count = 1;
  }
  if (params == null) {
    params = {};
  }
  if (params['namespace'] == null) {
    params['namespace'] = jiff.extensions[jiff.extensions.length - 1];
  }
  batch = batch == null ? count : batch;

  // Create preprocessing tasks
  for (var i = 0; i < count; i += batch) {
    jiff.preprocessingTasks.push([dependent_op, Math.min(batch, count - i), protocols, threshold, receivers_list, compute_list, Zp, id_list, params]);
  }

  // Start daemon if not running!
  if (start) {
    jiff.preprocessingDaemon();
  }
};

/**
 * Calls the given callback when all preprocessing tasks have finished!
 * @method onFinishPreprocessing
 * @memberof jiff-instance
 * @instance
 */
jiff.onFinishPreprocessing = function (callback) {
  if (jiff.preprocessingTasks.length === 0) {
    jiff.counters.reset();
    callback(jiff);
  } else {
    jiff.preprocessingCallback = callback;
  }
};