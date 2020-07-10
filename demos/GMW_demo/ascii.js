/*
 *  ASCII helpers for showing text based oblivious transfer
 */
const to_array = function (ascii) {
  var array = Array(ascii.length);
  for (var i = 0; i < ascii.length; i++) {
    array[i] = ascii[i].charCodeAt();
  }
  return array;
}
const to_ascii = function (array) {
  return String.fromCharCode.apply(null, array);
}

module.exports = {
  to_array: to_array,
  to_ascii: to_ascii
};
