// Server extensions management system
module.exports = function (JIFFClient) {
  /**
   * Checks if the given extension is applied.
   * @method has_extension
   * @memberof module:jiff-client~JIFFClient
   * @instance
   * @param {string} name - the extension name (found in the extension filename as jiff-client-[name].js).
   * @return {boolean} true if the extension was applied, false otherwise.
   */
  JIFFClient.prototype.has_extension = function (name) {
    return this.extensions.indexOf(name) > -1;
  };

  /**
   * Checks if a given extension can be safely applied to the instance
   * @method can_apply_extension
   * @memberof module:jiff-client~JIFFClient
   * @instance
   * @param {string} name - the extension name (found in the filename at jiff-client[name].js)
   * @return {boolean} true if the extension can be safely applied, otherwise returns an error message.
   */
  JIFFClient.prototype.can_apply_extension = function (name) {
    return true;
  };

  /**
   * Applies the given extension.
   * If the extension is safe (as per can_apply_extension), it will be applied successfully.
   * If the extension is not safe to be applied, an exception will be thrown with an appropriate error message.
   * @see {@link module:jiff-client~JIFFClient#can_apply_extension}
   * @method apply_extension
   * @memberof module:jiff-client~JIFFClient
   * @instance
   * @param {object} ext - the namespace of the extension acquired when the extension is imported, should contain a make_jiff function.
   * @param {object} [options={}] - optional options to be passed to the extension.
   */
  JIFFClient.prototype.apply_extension = function (ext, options) {
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

  /**
   * Called when an extension is applied successfully. Override to change behavior of your extension based on future extensions.
   * @method extension_applied
   * @memberof module:jiff-client~JIFFClient
   * @instance
   * @param {string} name - the name of the applied extension.
   * @param {object} [options={}] - the options passed by the user to the newly applied extension.
   */
  JIFFClient.prototype.extension_applied = function (name, options) {};
};