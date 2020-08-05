module.exports = function (jiffClient) {
  var linkedList = require('../../common/linkedlist.js');
  var currentBatchLoad = 0;
  var suspendedTasks = 0;

  var getFirstTask = function (task) {
    if (task.count > 1) {
      var remainingTasks = Object.assign({}, task);

      var deferred1 = new jiffClient.helpers.Deferred();
      var deferred2 = new jiffClient.helpers.Deferred();
      Promise.all([deferred1.promise, deferred2.promise]).then(task.deferred.resolve);
      task.deferred = deferred1;
      remainingTasks.deferred = deferred2;

      remainingTasks.count--;
      task.count = 1;
      if (task.id_list != null) {
        task.id = remainingTasks.id_list.shift();
        task.id_list = null;
      }
      jiffClient.currentPreprocessingTasks.pushHead(remainingTasks);
    }
    if (task.id_list != null) {
      task.id = task.id_list[0];
      task.id_list = null;
    }
    return task;
  };

  var checkIfDone = function () {
    if (currentBatchLoad === 0 && suspendedTasks === 0) {
      var callback = jiffClient.preprocessingCallback;
      jiffClient.preprocessingCallback = null;
      callback(jiffClient);
    }
  };

  var buildID = function (task) {
    // Two kinds of operations: one that relies on different sets of senders and receivers, and one that has a set of holders
    if (task.dependent_op === 'open' || task.dependent_op === 'bits.open') { // TODO: make this part of the description in table
      var open_parties = task.params['open_parties'] != null ? task.params['open_parties'] : task.receivers_list;
      task.id = jiffClient.counters.gen_op_id2_preprocessing(task.dependent_op, open_parties, task.receivers_list);
    } else {
      task.id = jiffClient.counters.gen_op_id_preprocessing(task.dependent_op, task.receivers_list);
    }
  };

  var taskIsExecutable = function (task) {
    // if the protocol name is in the map, it can be directly executed
    var namespace = find_closest_namespace(task.dependent_op, task.params['namespace']);
    return (namespace == null);
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

  // execute a task and handle it upon completion
  var executeTask = function (task) {
    currentBatchLoad++;

    var _params = Object.assign({}, task.params);
    _params.output_op_id = task.id;

    var protocol = task.protocols[task.dependent_op] || jiffClient.default_preprocessing_protocols[task.dependent_op];
    var result = protocol(task.threshold, task.receivers_list, task.compute_list, task.Zp, _params, task.protocols);

    if (result.promise == null || result.promise.then == null) {
      taskFinished(task, result);
    } else {
      result.promise.then(taskFinished.bind(null, task, result));
    }
  };
  var taskFinished = function (task, result) {
    currentBatchLoad--;

    if (task.receivers_list.indexOf(jiffClient.id) > -1) {
      jiffClient.store_preprocessing(task.id, result.share);
    }
    task.deferred.resolve();
    jiffClient.preprocessingDaemon();
  };

  // expand task by one level and replace the node in the task list
  var expandTask = function (task) {
    // copy of params
    var _params = Object.assign({}, task.params);

    // Recursively follow jiffClient.preprocessing_function_map
    // to figure out the sub-components/nested primitives of the given operation
    // and pre-process those with the right op_ids.

    // ID should never be null
    var namespace = find_closest_namespace(task.dependent_op, _params['namespace']);
    var preprocessing_dependencies = jiffClient.preprocessing_function_map[namespace][task.dependent_op];

    if (typeof(preprocessing_dependencies) === 'function') {
      preprocessing_dependencies = preprocessing_dependencies(task.dependent_op, task.count, task.protocols, task.threshold, task.receivers_list, task.compute_list, task.Zp, task.id, _params, task, jiffClient);
    }

    var newTasks = linkedList();
    var deferredChain = [];
    // build linked list of new dependencies, afterwords merge them with current tasks list
    for (var k = 0; k < preprocessing_dependencies.length; k++) {
      var dependency = preprocessing_dependencies[k];
      var next_op = dependency['op'];

      // copy both the originally given extra_params and the extra params of the dependency and merge them
      // together, dependency params overwrite duplicate keys.
      // If params are ever needed in non-leaf operations, this must be changed to accommodate
      var extra_params = Object.assign({}, _params, dependency['params']);
      extra_params['namespace'] = dependency['namespace'] != null ? dependency['namespace'] : 'base';
      if (dependency.handler != null) {
        extra_params = dependency.handler(task.threshold, task.receivers_list, task.compute_list, task.Zp, task.id, extra_params, task, jiffClient);
      }
      if (extra_params.ignore === true) {
        continue;
      }

      // compose ids similar to how the actual operation is implemented
      var next_id_list = [];
      var next_count = dependency['count'];

      if (next_count == null) {
        next_count = 1;
        next_id_list[0] = dependency['absolute_op_id'] || (task.id + dependency['op_id']);
      } else {
        next_count = next_count(task.threshold, task.receivers_list, task.compute_list, task.Zp, task.id, extra_params);
        for (var j = 0; j < next_count; j++) {
          next_id_list.push(dependency['absolute_op_id'] || (task.id + dependency['op_id'] + j));
        }
      }

      var nextTask = {
        dependent_op : next_op,
        count : next_count,
        threshold : dependency['threshold'] || task.threshold,
        receivers_list : dependency['receivers_list'] || task.receivers_list,
        compute_list : dependency['compute_list'] || task.compute_list,
        Zp : dependency['Zp'] || task.Zp,
        id_list : next_id_list,
        id : null,
        params : extra_params,
        protocols : task.protocols,
        deferred: new jiffClient.helpers.Deferred()
      };

      deferredChain.push(nextTask.deferred.promise);
      if (dependency.requires != null) {
        nextTask.wait = true;
        var required_ops = [];
        for (var r = 0; r < dependency.requires.length; r++) {
          if (dependency.requires[r] >= k) {
            throw new Error('Preprocessing dependency "' + next_op + '" in preprocessingMap for "' + task.dependent_op
              + '" at namespace "' + namespace + '" cannot require subsequent dependency ' + dependency.requires[r]);
          }
          required_ops.push(deferredChain[dependency.requires[r]]);
        }

        Promise.all(required_ops).then(function (nextTask) {
          delete nextTask['wait'];
          jiffClient.preprocessingDaemon();
        }.bind(null, nextTask));

        // add waiting task to the tail of the queue
        // jiffClient.currentPreprocessingTasks.add(nextTask);
        newTasks.add(nextTask);
      } else {
        // non-waiting tasks are added to the head of the queue
        newTasks.add(nextTask);
      }
    }

    Promise.all(deferredChain).then(task.deferred.resolve);
    jiffClient.currentPreprocessingTasks = newTasks.extend(jiffClient.currentPreprocessingTasks);
  };

  /**
   * Preprocessing Daemon that executes all currently scheduled preprocessing tasks (entries in jiffClient.currentPreprocessingTasks array) in order.
   * @method preprocessingDaemon
   * @memberof module:jiff-client~JIFFClient
   * @instance
   */
  jiffClient.preprocessingDaemon = function () {
    while (currentBatchLoad < jiffClient.preprocessingBatchSize) {
      var task = jiffClient.currentPreprocessingTasks.popHead();

      if (task == null) {
        checkIfDone();
        return;
      }

      if (task.object.wait) {
        jiffClient.currentPreprocessingTasks.pushHead(task.object);
        break;
      }

      task = getFirstTask(task.object);
      if (task.id == null) {
        buildID(task);
      }

      // check if task is executable or no
      if (taskIsExecutable(task)) {
        executeTask(task); // co-recursively calls preprocessingDaemon()
      } else {
        //expand single task
        expandTask(task);
      }
    }
  };
};
