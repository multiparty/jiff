/*
 *  Client-Server Communications
 */
var listeners = {};
var mailbox = {};
const dummy_socket = computation_id => ({
  get: function (op_id, tag) {
    return new Promise(function (resolve) {
      tag = computation_id + ':' + op_id + ':' + tag;
      if (mailbox[tag] == null) {
        //console.log('io.get', tag, 'not ready');
        listeners[tag] = resolve;
      } else {
        //console.log('io.get', tag, mailbox[tag]);
        resolve(mailbox[tag]);
        mailbox[tag] = undefined;
      }
    });
  },
  give: function (op_id, tag, msg) {
    tag = computation_id + ':' + op_id + ':' + tag;
    //console.log('io.give', tag, msg);
    if (listeners[tag] == null) {
      mailbox[tag] = msg;
    } else {
      listeners[tag](msg);
      listeners[tag] = undefined;
    }
  },
  listen: function (get, tag, callback, op_id) {
    get = get.bind(null, op_id);
    (function thunk(f) {
      get(tag).then(function (msg) {
        f(msg);
        //console.log('checkmsg',msg);
        thunk(f);
      });
    }(callback));
  }
});

module.exports = dummy_socket('example');
