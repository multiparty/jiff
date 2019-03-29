// Create a new collection of intervals initially covering [ start, end ] inclusive.
// An interval is an array of interval objects, and represents the union of all them..
// The intervals in the array are guaranteed to be non-overlapping given proper initialization,
// and are sorted from the interval with the smallest left end point to the one with the largest one.
// intervals are inclusive of endpoints: [ start, end ].
function intervals(start, end) {
  var obj = {};
  obj.val = [{start: start, end: end}];
  obj.is_free = function (point) {
    return find_point(obj.val, point) > -1;
  };
  obj.reserve = function (point) {
    return remove_point(obj.val, point);
  };
  obj.create_free = function () {
    return get_first_point(obj.val);
  };
  return obj;
}

// Remove a point from the collection of intervals
// will splice the interval containing point into two intervals (or less) [ start, point-1 ], [ point+1, end ]
// return true if the point was removed, false if the point was not contained in the intervals.
function remove_point(intervals, point) {
  if (intervals.length === 0) {
    return false; // empty intervals
  }

  // assumes that: intervals[index].start <= point <= intervals[index].end
  //   and index is in range.
  // removes the point from the interval at the given index.
  function remove_from_interval(index) {
    var current_interval = intervals[index];
    if (current_interval.start === current_interval.end) {
      intervals.splice(index, 1);
    } else if (current_interval.start === point) {
      intervals[index] = {start: current_interval.start + 1, end: current_interval.end};
    } else if (current_interval.end === point) {
      intervals[index] = {start: current_interval.start, end: current_interval.end - 1};
    } else {
      intervals[index] = {start: current_interval.start, end: point - 1};
      intervals.splice(index+1, 0, {start: point + 1, end: current_interval.end});
    }

    return true;
  }

  // Find the interval containing the point, then remove it.
  var index = find_point(intervals, point);
  if (index === -1) {
    // point not found
    return false;
  }
  return remove_from_interval(index);
}

// Searches for the point in the given intervals.
// If the point is contained by the intervals, the
// index of the exact interval containing it is
// returned.
// Otherwise, -1 is returned.
function find_point(intervals, point) {
  if (intervals.length === 0) {
    return -1; // empty intervals
  }

  function interval_contains(index) {
    return (intervals[index].start <= point && point <= intervals[index].end);
  }

  function go_left(index) {
    return point < intervals[index].start;
  }

  // special case optimization
  if (interval_contains(0)) {
    return 0;
  }

  // binary search
  var st = 0;
  var nd = intervals.length;
  while (st < nd) {
    var mid = Math.floor((st + nd) / 2);
    if (interval_contains(mid)) {
      return mid;
    } else if (go_left(mid)) {
      nd = mid;
    } else {
      st = mid + 1;
    }
  }

  return -1;
}

// Returns the smallest point contained in the intervals and remove it.
// If the intervals are empty, returns null.
function get_first_point(intervals) {
  if (intervals.length === 0) {
    return null; // empty intervals
  }

  var point = intervals[0].start;
  return point;
}

module.exports = intervals;
