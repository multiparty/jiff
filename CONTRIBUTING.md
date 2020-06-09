# Contributing to JIFF #

Welcome! These are the guidelines for contributing to JIFF. Feel free to propose new ones via a pull request!

Issues (bugs, feature requests or otherwise feedback) may be reported in the [GitHub issue tracker](https://github.com/multiparty/jiff/issues) for this project. Pull requests are also welcome.

When contributing to this repository, please first discuss the change you wish to make via an issue, unless it's entirely trivial (typo fixes, etc.). If there is already an issue that describes the change you have in mind, comment on it indicating that you're going to work on that. This way we can avoid the situation when several people work on the same thing.

## Guidelines ##
- Code should follow the [AirBnB style guide](https://github.com/airbnb/javascript) (with a few exceptions), check for linting errors before submitting a PR
- New pull requests must be accompanied by **passing tests** written by the task owner
  - see [tests/suite/README.md](https://github.com/multiparty/jiff/tree/master/tests/suite/README.md)
- Code should not use ES6 features, as JIFF aims to be compatible with as many browsers as possible
- Code should be documented using proper JSDoc formatting
- Branch formatting:
  - issueNumber-initials-description
  - ex. 22-LQ-bugFixes
- Demos should be implemented in both the browser and node.js, and accompanied by test cases. Sophisticated demos should include a README as well as a package.json file for managing additional dependencies. *Please Follow the demo template under demos/template closely*.

## Issue Template
* **I'm submitting a ...**
  - [ ] bug report
  - [ ] feature request
  - [ ] support request


* **Do you want to request a *feature* or report a *bug*?**



* **What is the current behavior?**



* **If the current behavior is a bug, please provide the steps to reproduce and if possible a minimal demo of the problem**



* **What is the expected behavior?**



* **What is the motivation / use case for changing the behavior?**



* **Please tell us about your environment:**

  - JIFF Version: [1.X | commit hash]
  - Node Version: XX.XX.X
  - Browser: [all | Chrome XX | Firefox XX | IE XX | Safari XX | Mobile Chrome XX | Android X.X Web Browser | iOS XX Safari | iOS XX UIWebView | iOS XX WKWebView ]


* **Other information** (e.g. detailed explanation, stacktraces, related issues, suggestions how to fix, links for us to have context, eg. stackoverflow, etc)

## Pull Requests (PRs) ##
* **Please check if the PR fulfils these requirements**
- [ ] The commit message follows our guidelines
- [ ] Tests for the changes have been added (for bug fixes / features)
- [ ] Docs have been added / updated (for bug fixes / features)


* **What kind of change does this PR introduce?** (Bug fix, feature, docs update, ...)



* **What is the current behavior?** (You can also link to an open issue here)



* **What is the new behavior (if this is a feature change)?**



* **Does this PR introduce a breaking change?** (What changes might users need to make in their application due to this PR?)



* **Other information**:

### What do I need to know to help? ###
If you are interested in making a code contribution to JIFF, the project is entirely written in JavaScript. If you would like to become more familiar with MPC protocols and the cryptographic tools underlying JIFF, there are a variety of resources to check out:

* [A Pragmatic Introduction to Secure Multi-Party Computation](https://securecomputation.org/)
* [Example of a real-world software deployment that uses JIFF](https://github.com/multiparty/web-mpc)
* [JIFF Documentation](https://multiparty.org/jiff/docs/jsdoc/)
* [JIFF Presentation at DIMACS/MACS Workshop](https://www.youtube.com/watch?v=S-IkyOEgrfI)

Looking at the [/demos/](https://github.com/multiparty/jiff/tree/master/demos) folder is a good way to see how common, simple workflows can be implemented in JIFF.

### Where can I go for help? ###
If you have JIFF-specific questions or issues, you can contact info@multiparty.org
