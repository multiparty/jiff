/**
 * This defines a library extension for better array operations in JIFF.
 * It defines a relational API over secret arrays.
 * Exposed members can be accessed with jiff_relational.&lt;member-name&gt;
 * in browser JS, or by using require('<path>/lib/ext/jiff-client-relational').&lt;member-name&gt; as usual in nodejs.
 * @namespace jiff_relationl
 * @version 1.0
 *
 * FEATURES: supports all of the regular JIFF API.
 *
 */

(function (exports, node) {
  /**
   * The name of this extension: 'relational'
   * @type {string}
   * @memberOf jiff_relational
   */
  exports.name = "relational";

  function make_jiff(base_instance, options) {
    var jiff = base_instance;

    /* PARSE OPTIONS */
    if (options == null) {
      options = {};
    }

    /* HELPERS */

    /**
     * Map a function over an array
     * @method map
     * @memberof jiff-instance.helpers
     * @instance
     * @param {Array} arr - array of values 
     * @param {function(elt)} fun - function that operates on array elements 
     * @return {Array} - array of results from applying fun to each element of arr
     */
    jiff.helpers.map = function(arr, fun) {
      for (var i=0; i<arr.length; i++) {
        arr[i] = fun(arr[i]);
      }
      return arr;
    };

    /**
     * Replaces list items not satifying a filter with a default value
     * @method filter
     * @memberof jiff-instance.helpers
     * @instance
     * @param {Array} arr - array of vales
     * @param {function(elt)} fun - boolean function that operates on array elements
     * @param {} nil - This item replaces any element that does not satisfy fun
     * @return {Array} - original array, but with elements that don't satisfy fun replaced by nil
     */
    jiff.helpers.filter = function(arr, fun, nil) {
      for (var i=0; i<arr.length; i++){
        arr[i] = fun(arr[i]).if_else(arr[i], nil);
      }
      return arr;
    };

    /**
     * Reduces arr to a value computed by running each element in arr 
     * through a function, where each application also consumes the return value of 
     * the previous application. 
     * If an initial value z is not provided, the first application consumes the
     * first two elements of the list.
     * @method reduce
     * @memberof jiff-instance.helpers
     * @instance
     * @param {Array} arr - 
     * @param {function} iter - accumulator function invoked in each step
     *  takes 2 arguments: array element, accumulation
     * @param {} z - optional initial element
     * @return {} - result after iterating; could be any type
     */
    // TODO: UNTESTED
    jiff.helpers.reduce = function(arr, iter, z) {
      if (arr.length === 0) {
        if (z == null) {
          throw new Error("reduce: folding on an empty list without an initial value");
        } else {
          z.logLEAK("z in f");
          return z;
        }
      }
      // set result to correct start value
      if (z == null) {
        z = arr[0];
      } else {
        z = iter(arr[0],z);
      }
      // reduce over array
      for (var i=1; i<arr.length; i++) {
        z = iter(arr[i],z);
      }
      return z;
    }
  }

  exports.make_jiff = make_jiff;

}((typeof exports === 'undefined' ? this.jiff_relational= {} : exports), typeof exports !== 'undefined'));
