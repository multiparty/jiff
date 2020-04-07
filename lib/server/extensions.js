// Server extensions management system
module.exports = function (JIFFServer) {
  JIFFServer.prototype.has_extension = function (name) {
    return this.extensions.indexOf(name) > -1;
  };

  JIFFServer.prototype.can_apply_extension = function (name) {
    return true;
  };

  JIFFServer.prototype.apply_extension = function (ext, options) {
    if (options == null) {
      options = {};
    }

    var name = ext.name;
    var status = this.can_apply_extension(name);

    if (status === true) {
      ext.make_jiff(this, options);

      this.extensions.push(name);
      this.extension_applied(name, options);
    } else {
      throw status;
    }
  };

  JIFFServer.prototype.extension_applied = function (name, options) {};
};