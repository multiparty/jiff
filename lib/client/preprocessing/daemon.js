/*
 * Generate values used for jiff operations in advance of the general computation
 * @method __preprocessing
 * @memberof jiff-instance
 * @instance
 * @param {string} dependent_op - name of the operation that will later use the pre_processed values
 * @param {Number} count - number of times the protocol should be performed, number of values that will be generated
 * @param {Object} [protocols=defaults] - a mapping from base preprocessing elements (triplets, bit arrays) to functions that can pre-process them
 *                               the function must implement the same interface as the JIFF provided protocols (e.g. jiff.protocols.generate_beaver_bgw).
 *                               missing mappings indicate that JIFF must use the default protocols.
 * @param {Number} [threshold=receivers_list.length] - the threshold of the preprocessed shares.
 * @param {Array} [receivers_list=all_parties] - the parties that will receive the preprocsssed shares.
 * @param {Array} [compute_list=all_parties] - the parties that will compute the preprocsssed shares.
 * @param {Array} [Zp=jiff.Zp] - the Zp of the preprocessed shares.
 * @param {Array} [id_list=auto_gen()] - array of ids to be used sequentially to identify the pre_processed values. Optional.
 * @param {Object} params - any additional protocol-specific parameters.
 * @return {promise} a promise that is resolved when preprocessing is completed.
 */
jiff.__preprocessing = function (dependent_op, count, protocols, threshold, receivers_list, compute_list, Zp, id_list, params) {
  var find_closest_namespace = function (op, starting_namespace) {
    var namespace_index = jiff.extensions.indexOf(starting_namespace);
    while (namespace_index >= 0) {
      var namespace = jiff.extensions[namespace_index];
      if (jiff.preprocessing_function_map[namespace] != null && jiff.preprocessing_function_map[namespace][op] != null) {
        return namespace;
      }
      namespace_index--;
    }

    return null;
  };

  // read only copy of params
  var _params = params;

  // Recursively follow jiff.preprocessing_function_map
  // to figure out the sub-components/nested primitives of the given operation
  // and pre-process those with the right op_ids.
  var promises = [];
  for (var i = 0; i < count; i++) {
    params = Object.assign({}, _params);
    if (params.op_id != null) {
      params.op_id = params.op_id + i;
    }

    var id = id_list[i];
    if (id == null) {
      // Two kinds of operations: one that relies on different sets of senders and receivers, and one that has a set of holders
      if (dependent_op === 'open' || dependent_op === 'bits.open') { // TODO: make this part of the description in table
        var open_parties = params['open_parties'] != null ? params['open_parties'] : receivers_list;
        id = jiff.counters.gen_op_id2(dependent_op, open_parties, receivers_list);
      } else {
        id = jiff.counters.gen_op_id(dependent_op, receivers_list);
      }
    }

    var namespace = find_closest_namespace(dependent_op, params['namespace']);
    if (namespace == null) {
      var protocol = protocols[dependent_op];
      params.output_op_id = id;
      var result = protocol(threshold, receivers_list, compute_list, Zp, params, protocols);
      promises.push(result.promise);
      if (receivers_list.indexOf(jiff.id) > -1) {
        jiff.store_preprocessing(id, result.share);
      }
    } else {
      var preprocessing_dependencies = jiff.preprocessing_function_map[namespace][dependent_op];
      if (typeof(preprocessing_dependencies) === 'function') {
        preprocessing_dependencies = preprocessing_dependencies(dependent_op, count, protocols, threshold, receivers_list, compute_list, Zp, id_list, params);
      }
      for (var k = 0; k < preprocessing_dependencies.length; k++) {
        var dependency = preprocessing_dependencies[k];
        var next_op = dependency['op'];

        // copy both the originally given extra_params and the extra params of the dependency and merge them
        // together, dependency params overwrite duplicate keys.
        // If params are ever needed in non-leaf operations, this must be changed to accommodate
        var extra_params = Object.assign({}, params, dependency['params']);
        extra_params['namespace'] = dependency['namespace'] != null ? dependency['namespace'] : 'base';
        if (dependency.handler != null) {
          extra_params = dependency.handler(threshold, receivers_list, compute_list, Zp, id, extra_params);
        }
        if (extra_params.ignore === true) {
          continue;
        }

        // compose ids similar to how the actual operation is implemented
        var next_id_list = [];
        var next_count = dependency['count'];

        if (next_count == null) {
          next_count = 1;
          next_id_list[0] = id + dependency['op_id'];
        } else {
          next_count = next_count(threshold, receivers_list, compute_list, Zp, id, extra_params);
          for (var j = 0; j < next_count; j++) {
            next_id_list.push(id + dependency['op_id'] + j);
          }
        }

        if (extra_params['op_id'] != null) {
          extra_params['op_id'] = extra_params['op_id'] + dependency['op_id'];
        }

        promises.push(jiff.__preprocessing(next_op, next_count, protocols, threshold, receivers_list, compute_list, Zp, next_id_list, extra_params));
      }
    }
  }

  return Promise.all(promises);
};

/**
 * Preprocessing Daemon that executes all currently scheduled preprocessing tasks (entries in jiff.preprocessingTasks array) in order.
 * @method preprocessingDaemon
 * @memberof jiff-instance
 * @instance
 */
jiff.preprocessingDaemon = function () {
  if (jiff.preprocessingTasks.length === 0) {
    if (jiff.preprocessingCallback != null) {
      jiff.counters.reset();

      var callback = jiff.preprocessingCallback;
      jiff.preprocessingCallback = null;
      callback(jiff);
    }
    return;
  }

  // execute a single preprocessing task!
  (function () {
    var args = arguments;
    var promise = jiff.__preprocessing.apply(jiff, arguments);
    promise.then(function () {
      jiff.preprocessingTasks.shift();
      jiff.preprocessingDaemon();
    });
  }).apply(jiff, jiff.preprocessingTasks[0]);
};