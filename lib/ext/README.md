# Extensions

All available extensions can be found under lib/ext.
Extensions extend client, server, or both. Some functionality requires both client and server side 
extensions to be applied (jiff-<client/server>-bignumber.js).
For a concrete example of how an extension is created, look at jiff-client-bignumber.js.

## Creating Extensions
These are the required steps when you want to create a client extension:

1. __File Creation:__ Create your extension file, and write a top-level function to scope the module (checkout
   jiff-client-bignumber.js: something like (function(exports, node) { .... })(typeof(exports) ....) ). This 
   function acts as the scope for the module, which forbids name conflicts as well as forbid others from modifying 
   or messing around with the functions and constants inside. Additionally, it makes the code useable 
   from the browsers and nodejs.

2. __API Name:__ Your API should be reachable through an object name *jiff\_<module_name> = {}*. This is the defacto
   name space for this module. Calling code on the user-side will use that name (jiff_<module_name>) to access the
   functions you choose to expose. For nodejs the name space will be ignored and calling code can use the object
   returned by the require() call corresponding to this module. You will need to modify the parameter passed to
   the top-level function form step 1 to acheive this.

3. __make\_jiff:__ Inside the top-level function, create a function called make_jiff. The function should take two parameters: 
   * _base\_instance:_ the base instance to wrap the extension around, it can be a basic jiff-client.js instance or an instance of another extension, you can use this instance to perform the basic operation that build  your modules (sharing of integers, simple operations on ints, etc).
   * _options:_ should be an object that provides your module with whatever options it requires. The options for the base\_instance will be passed to it prior to calling your modules and may not be inside the options object, but you can access them using base\_instance.

4. __Dependencies:__ If your module requires other extensions be applied to the base instance, you can force this through a
   runtime check (if condition), by seeing if the required extension name exists in base_instance.modules array. You will need to
   add the name of this module to that array as well.

5. __Adding Functionality:__ You have two options:
   * use [__hooks__](Hooks.md) to modify the functionality of the base instance "in place" and then return the base instance.
   * Create a __new object__ that contains the base\_instance (perhaps as an attribute named "base"), you will need to recreate the JIFF API at the new object level. The implementation of this API can use functionality from base\_instance. Return the new object.

6. __Overriding Functionality:__ If you need to override any feature in jiff (change how share work, or how open work, or how beaver_triplets 
   work etc), look at the [hooks documentation](Hooks.md) documentation to see if it is available as a hook, or can be implemented by overriding
   jiff's built-in helper functions.  If it is, your best bet would be to use it on top of base\_instance. Another approach could be to override
   functions inside the base\_instance or to create a new object with brand new functions (that may or may not refer to base\_instance). These approaches
   can be mixed.

7. __New Functionality:__ If you want to add additional feature that does not override any other feature in jiff, implement that in a
   function under a new appropriate name, make sure to document the function properly.

8. __API Exposure:__ Make sure to expose the make\_jiff function, by adding it the exports object passed to the top-level function in step 1.
   You can expose any additional helpers or functions the same way.

Keep in mind that others may base extensions on your extension, or that clients may want to combine functionality from two extensions
together. If you have specific dependencies or if you know that the extension will be incompatible with other extensions, make sure
to check inside the .modules array, and throw the appropriate errors.

**If going with approach 5(b), then you must ensure that your new functions execute the appropriate hooks, either through use of base_instance, or manually.**
