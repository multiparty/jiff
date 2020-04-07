/** Doubly linked list with add and remove functions and pointers to head and tail**/
module.exports = function () {
  // attributes: list.head and list.tail
  // functions: list.add(object) (returns pointer), list.remove(pointer)
  // list.head/list.tail/any element contains:
  //    next: pointer to next,
  //    previous: pointer to previous,
  //    object: stored object.
  var list = {head: null, tail: null};
  // TODO rename this to pushTail || push
  list.add = function (obj) {
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

  list.pushHead = function (obj) {
    list.head = {object: obj, next : list.head, previous : null};
    if (list.head.next != null) {
      list.head.next.previous = list.head;
    } else {
      list.tail = list.head;
    }
  };

  list.popHead = function () {
    var result = list.head;
    if (list.head != null) {
      list.head = list.head.next;
      if (list.head == null) {
        list.tail = null;
      } else {
        list.head.previous  = null;
      }
    }
    return result;
  };

  // merges two linked lists and return a pointer to the head of the merged list
  // the head will be the head of list and the tail the tail of l2
  list.extend = function (l2) {
    if (list.head == null) {
      return l2;
    }
    if (l2.head == null) {
      return list;
    }
    list.tail.next = l2.head;
    l2.head.previous = list.tail;
    list.tail = l2.tail;

    return list;
  };

  list.remove = function (ptr) {
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
  list.slice = function (ptr) { // remove all elements from head to ptr (including ptr).
    if (ptr == null) {
      return;
    }

    /* CONSERVATIVE: make sure ptr is part of the list then remove */
    var current = list.head;
    while (current != null) {
      if (current === ptr) {
        list.head = ptr.next;
        if (list.head == null) {
          list.tail = null;
        }

        return;
      }
      current = current.next;
    }

    /* MORE AGGRESSIVE VERSION: will be incorrect if ptr is not in the list */
    /*
    list.head = ptr.next;
    if (list.head == null) {
      list.tail = null;
    }
    */
  };
  /*
  list._debug_length = function () {
    var l = 0;
    var current = list.head;
    while (current != null) {
      current = current.next;
      l++;
    }
    return l;
  };
  */
  return list;
};
