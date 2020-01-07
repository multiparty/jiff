module.exports = function (jiffClient, __internal_socket) {
  __internal_socket.safe_emit = function (label, msg) {
    if (label === 'free') {
      jiffClient.hooks.execute_array_hooks('afterOperation', [this.jiffClient, 'free', msg], 2);
      return;
    }

    __internal_socket.emit(label, msg);
  };

  __internal_socket.resend_mailbox = function () {};

  __internal_socket.disconnect = function () {
    jiffClient.hooks.execute_array_hooks('beforeOperation', [jiffClient, 'disconnect', {}], -1);
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