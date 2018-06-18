// Chai 
// var expect = require('chai').expect;
const assert = require('chai').assert;

const mpc = require('./mpc.js');

const testCasesCount = 10;
const maximumPartiesCount = 4;

const maximumInputArrayLength = 5;
const maximumInputNumber = 100;
const maximumQueriesCount = 5;

class Node {
  constructor(share, leftNode, rightNode) {
    this.share = share;
    this.left = leftNode;
    this.right = rightNode;
    this.openedValue = null;
  }
}
const makeTree = (arr, start, end) => {
  if (start > end)
    return null;
  ++nodesCount;
  const middle = Math.floor((start + end) / 2);
  const node = new Node(arr[middle], makeTree(arr, start, middle-1), makeTree(arr, middle+1, end));
  return node;
}
class ResultNode {
  constructor(value, leftResultNode, rightResultNode) {
    this.value = value;
    this.left = leftResultNode;
    this.right = rightResultNode;
  }
}
const makeResultTree = (arr, start, end) => {
  if (start > end)
    return null;
  const middle = Math.floor((start + end) / 2);
  const node = new ResultNode(arr[middle], makeResultTree(arr, start, middle-1), makeResultTree(arr, middle+1, end));
  return node;
}

/**
 * @returns An array of objects, each object holds the inputs to the test case
 * as well as the data structures needed to be kept throughout the computation.
 * [
 *   {
 *     'party_id1': {},
 *     'party_id2': {},
 *     ...      
 *   },
 *   {
 *     'party_id1': {},
 *     'party_id2': {},
 *     ...      
 *   },
 *   ...
 * ]
 */
const generateInputs = (testCasesCount) => {
  const r = [];
  for (let i = 0; i < testCasesCount; i++) {
    const testCaseData = {};

    // generate a number between 2 and maximumPartiesCount
    let partiesCount = Math.floor(Math.random()*(maximumPartiesCount - 1) + 2);
    let queriesInTree = [];

    for (let j = 1; j <= partiesCount; j++) {
      const inputArray = [];
      let arrayLength = Math.floor(Math.random()*(maximumInputArrayLength) + 1);
      for (let k = 0; k < arrayLength; k++) {
        let randomNumber = Math.floor(Math.random()*(maximumInputNumber + 1));
        queriesInTree.push(randomNumber);
        inputArray.push(randomNumber);
      }
      testCaseData[j] = {
        inputArray:inputArray
      };
    }

    const queries = [];
    //generate 5 queries, half of which are in the tree and the other half is random.
    for (let j = 0; j < maximumQueriesCount; j++) {
      if (j < maximumQueriesCount / 2) {
        // remove a random element from queriesInTree and adds it to queries
        queries.push(queriesInTree.splice(Math.floor(Math.random()*queriesInTree.length), 1)[0]);
      } else {
        // add a random number not in the tree.
        let randomNumber;
        do {
          randomNumber = Math.floor(Math.random()*(maximumInputNumber + 1));
        } while (queriesInTree.includes(randomNumber))
        queries.push(randomNumber);
      }
    }
    for (let p in testCaseData) {
      testCaseData[p].queries = queries.slice();
    }
    r.push(testCaseData);
  }
  r.forEach(tc => console.log(tc));
  return r;
}

/**
 * @returns The results of the computation.
 * [
 *   [{result1}, {result2}, ...]
 * ]
 */
const computeResults = (testCases) => {
  const r = [];

  for (let i = 0; i < testCases.length; i++) {
    const tc = testCases[i];
    const results = [];

    let allValuesArray = [];
    for (let p in tc) {
      allValuesArray = allValuesArray.concat(tc[p].inputArray.slice());
    }
    allValuesArray = allValuesArray.sort(function(a, b) { return a - b; });


    // all parties' queries should be the same.
    const queries = tc[Object.keys(tc)[0]].queries;

    for (let j = 0; j < queries.length; j++) {
      if (allValuesArray.includes(queries[j]))
        results.push(1);
      else
        results.push(0);
    }

    results.push(makeResultTree(allValuesArray, 0, allValuesArray.length - 1));

    r.push(results);
  }

  console.log(r);
  return r;
}

computeResults(generateInputs(testCasesCount));