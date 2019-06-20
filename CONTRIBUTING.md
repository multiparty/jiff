# Contributing to JIFF #

Welcome! These are the guidelines for contributing to JIFF. Feel free to propose new ones via a pull request!

Issues (bugs, feature requests or otherwise feedback) may be reported in the [GitHub issue tracker](https://github.com/multiparty/jiff/issues) for this project. Pull requests are also welcome.

When contributing to this repository, please first discuss the change you wish to make via an issue, unless it's entirely trivial (typo fixes, etc.). If there is already an issue that describes the change you have in mind, comment on it indicating that you're going to work on that. This way we can avoid the situation when several people work on the same thing.

## Guidelines ##
- Code should follow the [AirBnB style guide](https://github.com/airbnb/javascript), with a few modifications) (check for linting errors before submitting a PR)
- New pull requests must be accompanied by **passing tests** written by the task owner
  - see [tests/suite/README.md]
- Code should not use ES6 features, as JIFF aims to be compatible with as many browsers as possible
- Code should be documented using proper JSDoc formatting
- Branch formatting:
  - issueNumber-initials-description
  - ex. 22-LQ-bugFixes
- Demos should be implemented in both the browser and node.js, and accompanied by test cases. Sophistacted demos should include a README as well as a package.json file for managing additional dependencies. *Please Follow the demo template under demos/template closely*.

## Pull Requests (PRs) ##


### What do I need to know to help? ###
If you are interested in making a code contribution to JIFF, the project is entirely written in JavaScript. If you would like to become more familiar with MPC protocols and the cryptographic tools underlying JIFF, there are a variety of resources to check out:

* [A Pragmatic Introduction to Secure Multi-Party Computation](https://securecomputation.org/)
* [Example of a real-world software deployment that uses JIFF](https://github.com/multiparty/web-mpc)
* [JIFF Documentation](https://multiparty.org/jiff/docs/jsdoc/)
* [JIFF Presentation at DIMACS/MACS Workshop](https://www.youtube.com/watch?v=S-IkyOEgrfI)

Looking at the [/demos/](https://github.com/multiparty/jiff/tree/master/demos) folder is a good way to see how common, simple workflows can be implemented in JIFF.

### Where can I go for help? ###
If you have JIFF-specific questions or issues, you can contact info@multiparty.org
