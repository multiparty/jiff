(function (exports, node) {
  // linked list implementation
  var linked_list = function () {
    // attributes: list.head and list.tail
    // functions: list.add(object) (returns pointer), list.remove(pointer), list.iter(callback)
    // list.head/list.tail/any element contains:
    //    next: pointer to next,
    //    previous: pointer to previous,
    //    object: stored object.
    var list = {head: null, tail: null};
    list.add = function (obj) {
      list._size++;
      var node = { object: obj, next: null, previous: null };
      if (list.head == null) {
        list.head = node;
        list.tail = node;
      } else {
        list.tail.next = node;
        node.previous = list.tail;
        list.tail = node;
      }
      return node;
    };
    list.remove = function (ptr) {
      list._size--;
      var prev = ptr.previous;
      var next = ptr.next;

      if (prev == null && list.head !== ptr) {
        return;
      } else if (next == null && list.tail !== ptr) {
        return;
      }

      if (prev == null) { // ptr is head (or both head and tail)
        list.head = next;
        if (list.head != null) {
          list.head.previous = null;
        } else {
          list.tail = null;
        }
      } else if (next == null) { // ptr is tail (and not head)
        list.tail = prev;
        prev.next = null;
      } else { // ptr is inside
        prev.next = next;
        next.previous = prev;
      }
    };
    list.iter = function (f) {
      var node = list.head;
      while (node != null) {
        f(node.object);
        node = node.next;
      }
    };
    list._size = 0;
    return list;
  };

  exports.name = 'debugging';
  exports.make_jiff = function (jiff, options) {
    var inspectorPromisesInterval = 1000 * 60 * 12; // 12 minutes
    var inspectorMailboxInterval = 1000 * 60; // 1 minute

    if (options != null) {
      if (options.inspectorPromisesInterval != null) {
        inspectorPromisesInterval = options.inspectorPromisesInterval;
      }
      if (options.inspectMailboxInterval != null) {
        inspectorMailboxInterval = options.inspectMailboxInterval;
      }
    }

    // will store all stacks and time of creation for all deferreds
    var stacks = linked_list();

    // change polyfills to keep track of stacks and time of creation for all promises/deferreds
    jiff.helpers.Deferred = function () {
      var self = this;

      var stackTrace = {};
      Error.captureStackTrace(stackTrace);
      this.ptr = stacks.add({ stack: stackTrace.stack, ts: Date.now() });

      // Polyfill for jQuery Deferred
      // From https://developer.mozilla.org/en-US/docs/Mozilla/JavaScript_code_modules/Promise.jsm/Deferred
      this.resolve = null;

      /* A method to reject the associated Promise with the value passed.
       * If the promise is already settled it does nothing.
       *
       * @param {anything} reason: The reason for the rejection of the Promise.
       * Generally its an Error object. If however a Promise is passed, then the Promise
       * itself will be the reason for rejection no matter the state of the Promise.
       */
      this.reject = null;

      /* A newly created Promise object.
       * Initially in pending state.
       */
      this.promise = new Promise(function (resolve, reject) {
        self.resolve = function () {
          stacks.remove(self.ptr);
          resolve.apply(self.promise, arguments);
        };
        self.reject = reject;
      }.bind(this));
      Object.freeze(this);
    };

    // Inspect stacks of promises and print 'late' ones
    jiff.inspectDebugPromises = function (ts) {
      if (ts == null) {
        ts = Date.now();
      }

      // Inspect every entry in the promise stack
      console.log('Inspector!', jiff.id, 'Size:', stacks._size);
      var f = function (obj) {
        if (ts - obj.ts > inspectorPromisesInterval) {
          console.log(Math.round((ts - obj.ts) / 1000));
          console.log(obj.stack);
        }
      };
      stacks.iter(f);
      console.log('Done!', jiff.id);
    };
    var interval1 = setInterval(jiff.inspectDebugPromises, inspectorPromisesInterval);

    jiff.inspectDebugMailbox = function (ts) {
      var node = jiff.socket.mailbox.head;

      var count = 0;
      while (node != null) {
        count++;
        node = node.next;
      }

      console.log('Inspector Mailbox!', jiff.id, 'found', count, 'messages');
    };
    var interval2 = setInterval(jiff.inspectDebugMailbox, inspectorMailboxInterval);

    // Disconnect/free
    var old_disconnect = jiff.disconnect;
    jiff.disconnect = function () {
      clearInterval(interval1);
      clearInterval(interval2);
      old_disconnect.apply(jiff, arguments);
    };

    return jiff;
  }
}((typeof exports === 'undefined' ? this.jiff_performance = {} : exports), typeof exports !== 'undefined'));
