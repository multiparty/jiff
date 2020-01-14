module.exports = function (jiffClient) {
  var linkedList = require('./common/linkedlist.js');
  var currentBatchLoad = 0;

  var getFirstTask = function (task) {
    if (task.count > 1) {
      var remainingTasks = Object.assign({}, task);
      remainingTasks.count--;
      task.count = 1;
      if (task.id_list != null) {
        task.id = [remainingTasks.id_list.shift()];
        task.id_list = null;
      }
      jiffClient.preprocessingTasks.pushHead(remainingTasks);
    }
    if (task.id_list != null) {
      task.id = task.id_list[0];
      task.id_list = null;
    }
    return task;
  }

  var checkIfDone = function () {
    if (jiffClient.preprocessingCallback != null && currentBatchLoad === 0) {
      jiffClient.counters.reset();

      var callback = jiffClient.preprocessingCallback;
      jiffClient.preprocessingCallback = null;
      callback(jiffClient);
    }
  };

  var buildID = function (task) {
    // Two kinds of operations: one that relies on different sets of senders and receivers, and one that has a set of holders
    if (task.dependent_op === 'open' || task.dependent_op === 'bits.open') { // TODO: make this part of the description in table
      var open_parties = task.params['open_parties'] != null ? task.params['open_parties'] : task.receivers_list;
      task.id = jiffClient.counters.gen_op_id2(task.dependent_op, open_parties, task.receivers_list);
    } else {
      task.id = jiffClient.counters.gen_op_id(task.dependent_op, task.receivers_list);
    }
  };

  var taskIsExecutable = function (task) {
    // if the protocol name is in the map, it can be directly executed
    // TODO: check this is true for bit_protocols as well
    if (jiffClient.default_preprocessing_protocols[task.dependent_op] != null) {
      return true;
    }
    return false;
  };

  var find_closest_namespace = function (op, starting_namespace) {
    var namespace_index = jiffClient.extensions.indexOf(starting_namespace);
    while (namespace_index >= 0) {
      var namespace = jiffClient.extensions[namespace_index];
      if (jiffClient.preprocessing_function_map[namespace] != null && jiffClient.preprocessing_function_map[namespace][op] != null) {
        return namespace;
      }
      namespace_index--;
    }

    return null;
  };
  var executeTask = function (task) {
    currentBatchLoad++;

    //taksn from daemonCOPY.js lines 58-66
    var namespace = find_closest_namespace(task.dependent_op, task.params['namespace']);
    if (namespace == null) {
      var protocol = task.protocols[task.dependent_op] || jiffClient.default_preprocessing_protocols[task.dependent_op];
      task.params.output_op_id = task.id;
      var result = protocol(task.threshold, task.receivers_list, task.compute_list, task.Zp, task.params, task.protocols);
      // TODO: confirm the promise structure is correct
      result.promise.then(function (value) {
        if (task.receivers_list.indexOf(jiffClient.id) > -1) {
          jiffClient.store_preprocessing(task.id, value.share);
        }
        currentBatchLoad--;
        // call Daemon again
        jiffClient.preprocessingDaemon();
      });
    }
  };

  // expand task by one level and replace the node in the task list
  var expandTask = function (task) {

    // read only copy of params
    var _params = task.params;

    // Recursively follow jiffClient.preprocessing_function_map
    // to figure out the sub-components/nested primitives of the given operation
    // and pre-process those with the right op_ids.
    task.params = Object.assign({}, _params);

    // ID should never be null
    var namespace = find_closest_namespace(task.dependent_op, task.params['namespace']);
    var preprocessing_dependencies = jiffClient.preprocessing_function_map[namespace][task.dependent_op];
    //TODO: Figure out how to handle this case, the bits handler functions
    /*if (typeof(preprocessing_dependencies) === 'function') {
     *  preprocessing_dependencies = preprocessing_dependencies(dependent_op, count, protocols, threshold, receivers_list, compute_list, Zp, id_list, params);
     *}
     */
    var newTasks = linkedList();
    // build linked list of new dependencies, afterwords merge them with current tasks list
    for (var k = 0; k < preprocessing_dependencies.length; k++) {
      var dependency = preprocessing_dependencies[k];
      var next_op = dependency['op'];

      // copy both the originally given extra_params and the extra params of the dependency and merge them
      // together, dependency params overwrite duplicate keys.
      // If params are ever needed in non-leaf operations, this must be changed to accommodate
      var extra_params = Object.assign({}, task.params, dependency['params']);
      extra_params['namespace'] = dependency['namespace'] != null ? dependency['namespace'] : 'base';
      if (dependency.handler != null) {
        extra_params = dependency.handler(task.threshold, task.receivers_list, task.compute_list, task.Zp, task.id, extra_params);
      }
      if (extra_params.ignore === true) {
        continue;
      }

      // compose ids similar to how the actual operation is implemented
      var next_id_list = [];
      var next_count = dependency['count'];

      if (next_count == null) {
        next_count = 1;
        next_id_list[0] = task.id + dependency['op_id']; // TODO ideally next_id can be this and no need for next_id_list
      } else {
        next_count = next_count(task.threshold, task.receivers_list, task.compute_list, task.Zp, task.id, extra_params);
        // TODO: confirm next_count should always be 1 (bits case may be different)
        // can get rid of this for loop when that is the case
        for (var j = 0; j < next_count; j++) {
          next_id_list.push(task.id + dependency['op_id'] + j);
        }
      }

      if (extra_params['op_id'] != null) {
        extra_params['op_id'] = extra_params['op_id'] + dependency['op_id'];
      }

      var nextTask = {
        'dependent_op' : next_op,
        'count' : next_count, // maybe should always be 1
        'threshold' : task.threshold,
        'receivers_list' : task.receivers_list,
        'compute_list' : task.compute_list,
        'Zp' : task.Zp,
        'id_list' : next_id_list,
        //TODO give this a value (e.g. 'next_id_list[0]' or 'task.id + dependency['op_id']')
        'id' : null,
        'params' : extra_params,
        'protocols' : task.protocols
      };
      newTasks.add(nextTask);
    }
    jiffClient.preprocessingTasks =  newTasks.extend(jiffClient.preprocessingTasks);
    jiffClient.preprocessingDaemon();
  };

  /**
   * Preprocessing Daemon that executes all currently scheduled preprocessing tasks (entries in jiffClient.preprocessingTasks array) in order.
   * @method preprocessingDaemon
   * @memberof module:jiff-client~JIFFClient
   * @instance
   */
  jiffClient.preprocessingDaemon = function () {
    if (currentBatchLoad >= jiffClient.preprocessingBatchSize) {
      return;
    }

    var task = jiffClient.preprocessingTasks.popHead();

    if (task == null) {
      checkIfDone();
      return;
    }

    task = getFirstTask(task);
    if (task.id == null) {
      buildID(task);
    }

    // check if task is executable or no
    if (taskIsExecutable(task)) {
      // execute single task
      executeTask(task).then(jiffClient.preprocessingDaemon);// co-recursively calls preprocessingDaemon()
    } else {
      //expand single task
      expandTask(task); // co-recursively calls preprocessingDaemon()
    }
  };
};
