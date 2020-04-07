module.exports = {
  '+': function (v1, v2) {
    return v1 + v2;
  },
  '-': function (v1, v2) {
    return v1 - v2;
  },
  '*': function (v1, v2) {
    return v1 * v2;
  },
  '/': function (v1, v2) {
    return v1 / v2;
  },
  '<': function (v1, v2) {
    return v1 < v2;
  },
  '<=': function (v1, v2) {
    return v1 <= v2;
  },
  'floor': function (v) {
    return Math.floor(v);
  },
  'ceil': function (v) {
    return Math.ceil(v);
  },
  'floor/': function (v1, v2) {
    return Math.floor(v1 / v2);
  },
  'pow': function (v1, v2) {
    return Math.pow(v1, v2);
  },
  'binary': function (v) {
    return v === 1 || v === 0;
  },
  'abs': function (v) {
    return Math.abs(v);
  },
  '==': function (v1, v2) {
    return v1 === v2;
  },
  'even': function (v1) {
    return (v1 % 2) === 0;
  }
};