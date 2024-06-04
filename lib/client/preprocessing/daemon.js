const LinkedList = require('../../../build/linkedlist.js');

class PreprocessDaemon {
  constructor(jiffClient) {
    this.jiffClient = jiffClient;
    this.currentBatchLoad = 0;
    this.suspendedTasks = 0;
  }

  getFirstTask(task) {
    if (task.count > 1) {
      const remainingTasks = Object.assign({}, task);

      const deferred1 = new this.jiffClient.helpers.Deferred();
      const deferred2 = new this.jiffClient.helpers.Deferred();
      Promise.all([deferred1.promise, deferred2.promise]).then(task.deferred.resolve);
      task.deferred = deferred1;
      remainingTasks.deferred = deferred2;

      remainingTasks.count--;
      task.count = 1;
      if (task.id_list != null) {
        task.id = remainingTasks.id_list.shift();
        task.id_list = null;
      }
      this.jiffClient.currentPreprocessingTasks.pushHead(remainingTasks);
    }
    if (task.id_list != null) {
      task.id = task.id_list[0];
      task.id_list = null;
    }
    return task;
  }

  checkIfDone() {
    if (this.currentBatchLoad === 0 && this.suspendedTasks === 0) {
      const callback = this.jiffClient.preprocessingCallback;
      this.jiffClient.preprocessingCallback = null;
      callback(this.jiffClient);
    }
  }

  buildID(task) {
    // Two kinds of operations: one that relies on different sets of senders and receivers, and one that has a set of holders
    if (task.dependent_op === 'open' || task.dependent_op === 'bits.open') {
      // TODO: make this part of the description in table
      const open_parties = task.params['open_parties'] != null ? task.params['open_parties'] : task.receivers_list;
      task.id = this.jiffClient.counters.gen_op_id2_preprocessing(task.dependent_op, open_parties, task.receivers_list);
    } else {
      task.id = this.jiffClient.counters.gen_op_id_preprocessing(task.dependent_op, task.receivers_list);
    }
  }

  taskIsExecutable(task) {
    // if the protocol name is in the map, it can be directly executed
    const namespace = this.find_closest_namespace(task.dependent_op, task.params['namespace']);
    return namespace == null;
  }

  find_closest_namespace(op, starting_namespace) {
    let namespace_index = this.jiffClient.extensions.indexOf(starting_namespace);
    while (namespace_index >= 0) {
      const namespace = this.jiffClient.extensions[namespace_index];
      if (this.jiffClient.preprocessing_function_map[namespace] != null && this.jiffClient.preprocessing_function_map[namespace][op] != null) {
        return namespace;
      }
      namespace_index--;
    }

    return null;
  }

  // execute a task and handle it upon completion
  executeTask(task) {
    this.currentBatchLoad++;

    const _params = Object.assign({}, task.params);
    _params.output_op_id = task.id;

    const protocol = task.protocols[task.dependent_op] || this.jiffClient.default_preprocessing_protocols[task.dependent_op];
    const result = protocol(task.threshold, task.receivers_list, task.compute_list, task.Zp, _params, task.protocols);

    if (result.promise == null || result.promise.then == null) {
      this.taskFinished(task, result);
    } else {
      result.promise.then(this.taskFinished.bind(this, task, result));
    }
  }
  taskFinished(task, result) {
    this.currentBatchLoad--;

    if (task.receivers_list.indexOf(this.jiffClient.id) > -1) {
      this.jiffClient.preprocess.store_preprocessing(task.id, result.share);
    }
    task.deferred.resolve();
    this.preprocessingDaemon();
  }

  // expand task by one level and replace the node in the task list
  expandTask(task) {
    // copy of params
    const _params = Object.assign({}, task.params);

    // Recursively follow jiffClient.preprocessing_function_map
    // to figure out the sub-components/nested primitives of the given operation
    // and pre-process those with the right op_ids.

    // ID should never be null
    const namespace = this.find_closest_namespace(task.dependent_op, _params['namespace']);
    let preprocessing_dependencies = this.jiffClient.preprocessing_function_map[namespace][task.dependent_op];

    if (typeof preprocessing_dependencies === 'function') {
      preprocessing_dependencies = preprocessing_dependencies(
        task.dependent_op,
        task.count,
        task.protocols,
        task.threshold,
        task.receivers_list,
        task.compute_list,
        task.Zp,
        task.id,
        _params,
        task,
        this.jiffClient
      );
    }

    const newTasks = new LinkedList();
    const deferredChain = [];
    // build linked list of new dependencies, afterwords merge them with current tasks list
    for (let k = 0; k < preprocessing_dependencies.length; k++) {
      const dependency = preprocessing_dependencies[k];
      const next_op = dependency['op'];

      // copy both the originally given extra_params and the extra params of the dependency and merge them
      // together, dependency params overwrite duplicate keys.
      // If params are ever needed in non-leaf operations, this must be changed to accommodate
      let extra_params = Object.assign({}, _params, dependency['params']);
      extra_params['namespace'] = dependency['namespace'] != null ? dependency['namespace'] : 'base';
      if (dependency.handler != null) {
        extra_params = dependency.handler(task.threshold, task.receivers_list, task.compute_list, task.Zp, task.id, extra_params, task, this.jiffClient);
      }
      if (extra_params.ignore === true) {
        continue;
      }

      // compose ids similar to how the actual operation is implemented
      const next_id_list = [];
      let next_count = dependency['count'];

      if (next_count == null) {
        next_count = 1;
        next_id_list[0] = dependency['absolute_op_id'] || task.id + dependency['op_id'];
      } else {
        next_count = next_count(task.threshold, task.receivers_list, task.compute_list, task.Zp, task.id, extra_params);
        for (let j = 0; j < next_count; j++) {
          next_id_list.push(dependency['absolute_op_id'] || task.id + dependency['op_id'] + j);
        }
      }

      const nextTask = {
        dependent_op: next_op,
        count: next_count,
        threshold: dependency['threshold'] || task.threshold,
        receivers_list: dependency['receivers_list'] || task.receivers_list,
        compute_list: dependency['compute_list'] || task.compute_list,
        Zp: dependency['Zp'] || task.Zp,
        id_list: next_id_list,
        id: null,
        params: extra_params,
        protocols: task.protocols,
        deferred: new this.jiffClient.helpers.Deferred()
      };

      deferredChain.push(nextTask.deferred.promise);
      if (dependency.requires != null) {
        nextTask.wait = true;
        const required_ops = [];
        for (let r = 0; r < dependency.requires.length; r++) {
          if (dependency.requires[r] >= k) {
            throw new Error(
              'Preprocessing dependency "' +
                next_op +
                '" in preprocessingMap for "' +
                task.dependent_op +
                '" at namespace "' +
                namespace +
                '" cannot require subsequent dependency ' +
                dependency.requires[r]
            );
          }
          required_ops.push(deferredChain[dependency.requires[r]]);
        }

        Promise.all(required_ops).then(
          function (nextTask) {
            delete nextTask['wait'];
            this.preprocessingDaemon();
          }.bind(null, nextTask)
        );

        // add waiting task to the tail of the queue
        // jiffClient.currentPreprocessingTasks.add(nextTask);
        newTasks.add(nextTask);
      } else {
        // non-waiting tasks are added to the head of the queue
        newTasks.add(nextTask);
      }
    }

    Promise.all(deferredChain).then(task.deferred.resolve);
    this.jiffClient.currentPreprocessingTasks = newTasks.extend(this.jiffClient.currentPreprocessingTasks);
  }

  /**
   * Preprocessing Daemon that executes all currently scheduled preprocessing tasks (entries in jiffClient.currentPreprocessingTasks array) in order.
   * @method preprocessingDaemon
   * @memberof module:jiff-client~JIFFClient
   * @instance
   */

  preprocessingDaemon() {
    while (this.currentBatchLoad < this.jiffClient.preprocessingBatchSize) {
      let task = this.jiffClient.currentPreprocessingTasks.popHead();

      if (task == null) {
        this.checkIfDone();
        return;
      }

      if (task.object.wait) {
        this.jiffClient.currentPreprocessingTasks.pushHead(task.object);
        break;
      }

      task = this.getFirstTask(task.object);
      if (task.id == null) {
        this.buildID(task);
      }

      // check if task is executable or no
      if (this.taskIsExecutable(task)) {
        this.executeTask(task); // co-recursively calls preprocessingDaemon()
      } else {
        //expand single task
        this.expandTask(task);
      }
    }
  }
}

module.exports = PreprocessDaemon;
