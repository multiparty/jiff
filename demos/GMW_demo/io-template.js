/*
 *  Implement 'give' and 'get' using your appliction'
 *  underlying IO capabilities, and use the IO object
 *  to pass as the IO parameter for 1-out-of-N.
 *
 *  IO template for the user:
 */

// IO send
const give = function (tag, msg) {
  /* give a message */
  return;
};

// IO receive
const get = function (tag) {
  /* get a message */
  return /*msg*/;
};

module.exports = {
  give: give,
  get: get
};
