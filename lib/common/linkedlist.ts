class LLNode<T> {
  public object: T;
  public next: LLNode<T> | null;
  public previous: LLNode<T> | null;

  constructor(object: T, next: LLNode<T> | null = null, previous: LLNode<T> | null = null) {
    this.object = object;
    this.next = next;
    this.previous = previous;
  }
}

class LinkedList<T> {
  public head: LLNode<T> | null;
  public tail: LLNode<T> | null;

  constructor() {
    this.head = null;
    this.tail = null;
  }

  add(obj: T): LLNode<T> {
    const newNode = new LLNode<T>(obj);
    if (this.head === null) {
      this.head = newNode;
      this.tail = newNode;
    } else {
      if (this.tail) {
        this.tail.next = newNode;
        newNode.previous = this.tail;
      }
      this.tail = newNode;
    }
    return newNode;
  }

  pushHead(obj: T): void {
    const newNode = new LLNode<T>(obj);
    if (this.head === null) {
      this.head = newNode;
      this.tail = newNode;
    } else {
      newNode.next = this.head;
      this.head.previous = newNode;
      this.head = newNode;
    }
  }

  popHead(): LLNode<T> | null {
    if (this.head === null) {
      return null;
    }
    const current = this.head;
    this.head = this.head.next;
    if (this.head !== null) {
      this.head.previous = null;
    } else {
      this.tail = null;
    }
    return current;
  }

  // merges two linked lists and return a pointer to the head of the merged list
  // the head will be the head of list and the tail the tail of l2
  extend(l2: LinkedList<T>): LinkedList<T> {
    if (this.head === null) {
      return l2;
    }
    if (l2.head === null) {
      return this;
    }
    if (this.tail && l2.head) {
      this.tail.next = l2.head;
      l2.head.previous = this.tail;
      this.tail = l2.tail;
    }
    return this;
  }

  remove(ptr: LLNode<T>): void {
    if (!ptr) return;

    let prev = ptr.previous;
    let next = ptr.next;

    if (prev === null && this.head !== ptr) {
      return;
    } else if (next === null && this.tail !== ptr) {
      return;
    }

    if (prev == null) {
      // ptr is head (or both head and tail)
      this.head = next;
      if (this.head !== null) {
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

  slice(ptr: LLNode<T>): void {
    // remove all elements from head to ptr (including ptr).
    if (ptr == null) {
      return;
    }

    /* CONSERVATIVE: make sure ptr is part of the list then remove */
    let current = this.head;
    while (current !== null) {
      if (current === ptr) {
        this.head = ptr.next;
        if (this.head === null) {
          this.tail = null;
        }
        break;
      }
      current = current.next;
    }
  }
}

module.exports = LinkedList;
