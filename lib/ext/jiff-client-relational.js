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
 *        Calling code on the user-side will use that name (jiff_relational) to access the
 *        functions you choose to expose. For nodejs the name space will be ignored and calling code can use the object
 *        returned by the require() call corresponding to this extension.
 *
 *     3) Inside the top-level function, create a function called make_jiff. The function should take two parameters:
 *            (a) base_instance, (b) options.
 *        base_instance: the base instance to wrap the extension around, it can be a basic jiff-client.js instance or
 *            an instance of another extension, you can use this instance to perform the basic operation that build
 *            your extensions (sharing of integers, simple operations on ints, etc)
 *        options: should be an object that provides your extension with whatever options it requires. The options for
 *            the base_instance will be passed to it prior to calling your extensions and may not be inside the options
 *            object, but you can access them using base_instance.
 *
 *     X) If your extension requires other extensions be applied to the base instance, you can force this by performing a
 *        a check, by calling <base_instance>.has_extension(<extension_name>).
 *
 *     5) Adding functionality: You have two options:
 *            (A) use hooks to modify the functionality of the base instance "in place"
 *                and then return the base instance.
 *        --->(B) Create a new object that contains the base_instance (perhaps as an attribute named "base"), you will
 *                need to recreate the JIFF API at the new object level. The implementation of this API can use functionality
 *                from base_instance. Return the new object.
 *
 *     6) If you need to override any feature in jiff (change how share work, or how open work, or how beaver_triplets
 *        work etc), look at the hooks documentation to see if it is available as a hook. If it is, your best bet would
 *        be to use hooks on top of the base_instance. Another approach could be to override functions inside the base_instance
 *        or to create a new object with brand new functions (that may or may not refer to base_instance). These approaches
 *        can be mixed.
 *
 * --->7) If you want to add additional feature that does not override any other feature in jiff, implement that in a
 *        function under a new appropriate name, make sure to document the function properly.
 *
 *     8) at the end of the top-level function and after make_jiff is done, make sure to have an
 *        if(node) { ... } else { ... } block, in which you expose the make_jiff function.
 *
 *     9) do not forget to export the name of the extension.
 *
 * Keep in mind that others may base extensions on your extension, or that clients may want to combine functionality from two extensions
 * together. If you have specific dependencies or if you know that the extension will be incompatible with other extensions, make sure
 * to enforce it by performing checks and throwing errors, as well as potentially overriding the can_apply_extension function
 * which will be called when future extensions are applied after your extension.
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
      console.log(typeof arr);

      console.log("start len: ", arr.length);
      res = [];
      for (var i=0; i<arr.length; i++) {
        res.push(jiff.secret_share(arr[i].jiff,false,fun(arr[i]), undefined, arr[i].holders,arr[i].threshold, arr[i].Zp));
        console.log(typeof res[i]);
      }
      return res;
    };

    /**
    * Replaces list items not satifying a filter with a default value
    * @method filter
    * @memberof jiff-instance.helpers
    * @instance
    * @param {Array} arr - array of vales
    * @param {function(elt)} fun - boolean function that operates on array elements
    * @param {} nil - This item replaces any element that does not satisfy fun
    * @return {Array} - originl array, but with elements that don't satisfy fun replaced by nil
    */
    jiff.helpers.filter = function(arr, fun, nil) {
      for (var i=0; i<arr.length; i++){
        arr[i] = fun(arr[i]).if_else(arr[i], nil);
      }
      return arr;
    };

  }

  exports.make_jiff = make_jiff;

}((typeof exports === 'undefined' ? this.jiff_relational= {} : exports), typeof exports !== 'undefined'));
