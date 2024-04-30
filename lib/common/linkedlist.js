class linkedList {
  constructor() {
    this.head = null;
    this.tail = null;
  }

  add(obj) {
    const node = { object: obj, next: null, previous: null };
    if (this.head == null) {
      this.head = node;
      this.tail = node;
    } else {
      this.tail.next = node;
      node.previous = this.tail;
      this.tail = node;
    }
    return node;
  }

  pushHead(obj) {
    const newNode = { object: obj, next: this.head, previous: null };
    if (this.head != null) {
      this.head.previous = newNode;
    }
    this.head = newNode;
    if (this.tail == null) {
      this.tail = newNode;
    }
  }

  popHead() {
    if (this.head == null) {
      return null;
    }

    const currHead = this.head;
    this.head = this.head.next;
    if (this.head != null) {
      this.head.previous = null;
    } else {
      this.tail = null;
    }

    return currHead;
  }

  // merges two linked lists and return a pointer to the head of the merged list
  // the head will be the head of list and the tail the tail of l2
  extend(l2) {
    if (this.head == null) {
      return l2;
    }
    if (l2.head == null) {
      return this;
    }
    this.tail.next = l2.head;
    l2.head.previous = this.tail;
    this.tail = l2.tail;

    return this;
  }

  remove(ptr) {
    let prev = ptr.previous;
    let next = ptr.next;

    if (prev == null && this.head !== ptr) {
      return;
    } else if (next == null && this.tail !== ptr) {
      return;
    }

    if (prev == null) {
      // ptr is head (or both head and tail)
      this.head = next;
      if (this.head != null) {
        this.head.previous = null;
      } else {
        this.tail = null;
      }
    } else if (next == null) {
      // ptr is tail (and not head)
      this.tail = prev;
      prev.next = null;
    } else {
      // ptr is inside
      prev.next = next;
      next.previous = prev;
    }
  }
  slice(ptr) {
    // remove all elements from head to ptr (including ptr).
    if (ptr == null) {
      return;
    }

    /* CONSERVATIVE: make sure ptr is part of the list then remove */
    let current = this.head;
    while (current != null) {
      if (current === ptr) {
        this.head = ptr.next;
        if (this.head == null) {
          this.tail = null;
        }

        return;
      }
      current = current.next;
    }
  }
}

module.exports = linkedList;
