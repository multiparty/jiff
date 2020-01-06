module.exports = function (jiffClient, __internal_socket) {
  __internal_socket.safe_emit = __internal_socket.emit;

  __internal_socket.resend_mailbox = function () {};

  __internal_socket.disconnect = function () {
    jiffClient.execute_array_hooks('beforeOperation', [jiffClient, 'disconnect', {}], -1);
  };

  __internal_socket.safe_disconnect = function (free, callback) {
    if (free) {
      jiffClient.free();
    }
    jiffClient.socket.disconnect();
    if (callback != null) {
      callback();
    }
  };

  return __internal_socket;
};