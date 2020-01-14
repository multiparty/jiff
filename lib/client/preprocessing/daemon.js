module.exports = function (jiffClient) {
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
  }

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
      executeTask(task).then(jiffClient.preprocessingDaemon);
    } else {
    //expand single task
      expandTask(task); // this co-recursively calls preprocessingDaemon()
    }
  };
};
