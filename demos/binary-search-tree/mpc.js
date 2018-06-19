(function(exports, node) {
  var saved_instance;

  /**
   * Connect to the server and initialize the jiff instance
   */
  exports.connect = function (hostname, computation_id, options) {
    var opt = Object.assign({}, options);
    // Added options goes here

    if(node) {
      jiff = require('../../lib/jiff-client');
      $ = require('jquery-deferred');
    }

    saved_instance = jiff.make_jiff(hostname, computation_id, opt);
    // if you need any extensions, put them here

    return saved_instance;
  };

  /**
   * The MPC computation
   */
  exports.submitArray = function (arr, jiff_instance) {
    if(jiff_instance == null) jiff_instance = saved_instance;
    let final_deferred = $.Deferred();
    let final_promise = final_deferred.promise();

    jiff_instance.share_array(arr).then(function(arr) {
      let concat = [];
      for(let party in arr)
        concat = [...concat, ...arr[party]];
    
      const sortedShares = bubbleSort(concat);
      final_deferred.resolve(sortedShares);
    });
    return final_promise;
  };

  const bubbleSort = function(arr) {
    for (var i = 0; i < arr.length; i++)
      for (var j = 0; j < (arr.length - i - 1); j++) {
        var a = arr[j];
        var b = arr[j+1];
        var c = a.lt(b);
        var d = c.not();
        arr[j] = (a.mult(c)).add((b.mult(d)));
        arr[j+1] = (a.mult(d)).add((b.mult(c)));
      }
    return arr; 
  }

  exports.openTree = (openedNodesCounter, root, jiff_instance) => {
    if(jiff_instance == null) jiff_instance = saved_instance;
    let final_deferred = $.Deferred();
    let final_promise = final_deferred.promise();
    
    let pointer = {c:openedNodesCounter};
    openTreeRecurse(root, root, pointer, final_deferred);
    return final_promise;
  }

  const openTreeRecurse = (node, root, counterPointer, final_deferred) => {
    if(node) {
      (function(n) {
        n.share.open(function(o) {
          n.openedValue = o;
          if(--counterPointer.c === 0)
            final_deferred.resolve(root, "root");            
        });
      })(node);

      openTreeRecurse(node.left, root, counterPointer, final_deferred);
      openTreeRecurse(node.right, root, counterPointer, final_deferred);
    }
  }

  exports.exists = (nodesCount, root, query, jiff_instance) => {
    if(jiff_instance == null) jiff_instance = saved_instance;    
    let final_deferred = $.Deferred();
    let final_promise = final_deferred.promise();

    let pointer = {counter:nodesCount, exists:null};
    existsRecurse(root, query, pointer, final_deferred);
    return final_promise;
  }

  const existsRecurse = (node, query, pointer, final_deferred) => {
    if(node) {
      pointer.exists = pointer.exists ? pointer.exists.add(node.share.eq(query)) : node.share.eq(query);
      existsRecurse(node.left, query, pointer, final_deferred);
      existsRecurse(node.right, query, pointer, final_deferred);
      if(--pointer.counter === 0) {
        pointer.exists.open(function(exists_opened) {
          final_deferred.resolve(exists_opened, query);
        });
      }
    }
  }

}((typeof exports == 'undefined' ? this.mpc = {} : exports), typeof exports != 'undefined'));
