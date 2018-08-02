/** Doubly linked list with add and remove functions and pointers to head and tail**/
var linked_list = function () {
  // attributes: list.head and list.tail
  // functions: list.add(object) (returns pointer), list.remove(pointer)
  // list.head/list.tail/any element contains:
  //    next: pointer to next,
  //    previous: pointer to previous,
  //    object: stored object.
  var list = {head: null, tail: null};
  list.add = function (obj) {
    var node = {object: obj, next: null};
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
    var prev = ptr.previous;
    var next = ptr.next;
    if (prev == null) {
      list.head = next;
      if (list.head != null) {
        list.head.previous = null;
      } else {
        list.tail = null;
      }
    } else {
      prev.next = next;
      if (next != null) {
        next.previous = prev;
      }
    }
  };
  return list;
};

module.exports = linked_list;
