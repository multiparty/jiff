// Chai 
// var expect = require('chai').expect;
const assert = require('chai').assert;

const mpc = require('./mpc.js');

const testCasesCount = 2;
const maximumPartiesCount = 4;

const maximumInputArrayLength = 5;
const maximumInputNumber = 100;
const maximumQueriesCount = 5;

let nodesCount = 0;
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
const displayOpenedTree = (node, string) => {
  if(!node)
      return;
  console.log(string + ": " + node.openedValue);
  displayOpenedTree(node.left, string + ",left");
  displayOpenedTree(node.right, string + ",right");
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
const displayResultTree = (node, string) => {
  if(!node)
    return;
  console.log(string + ": " + node.value);
  displayResultTree(node.left, string + ",left");
  displayResultTree(node.right, string + ",right");
}

const compareTwoTrees = (openedNode, resultsNode, string, done) => {
  if (!openedNode && !resultsNode)
    return 0;
  try {
    // console.log(string + ": " + openedNode.openedValue + "==" + resultsNode.value);
    assert.equal(openedNode.openedValue, resultsNode.value, string + ": " + openedNode.openedValue);
  } catch(assertionError) {
    done(assertionError);
    done = function(){}
    return 1;
  }
  let acc = compareTwoTrees(openedNode.left, resultsNode.left, string + ",left");
  acc += compareTwoTrees(openedNode.right, resultsNode.right, string + ",right");
  return acc;
}



/**
 * @returns An array of objects, each object holds the inputs to the test case
 * as well as the data structures needed to be kept throughout the computation.
 * [
 *   {
 *     computation_id:string,
 *     partiesData:
 *     {
 *       'party_id1': {},
 *       'party_id2': {},
 *       ...      
 *     },
 *     computation_id:string,
 *     partiesData:
 *     {
 *       'party_id1': {},
 *       'party_id2': {},
 *       ...      
 *     }
 *   },
 *   {
 *     computation_id:string,
 *     partiesData:
 *     {
 *       'party_id1': {},
 *       'party_id2': {},
 *       ...      
 *     },
 *     computation_id:string,
 *     partiesData:
 *     {
 *       'party_id1': {},
 *       'party_id2': {},
 *       ...      
 *     }
 *   },
 *   ...
 * ]
 */
const generateTestCases = (testCasesCount) => {
  const r = [];
  let computationIdPrefix = "mocha-test";
  for (let i = 0; i < testCasesCount; i++) {
    let id = computationIdPrefix+i;
    const testCaseData = {computation_id:id, partiesData:{}};

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
      testCaseData.partiesData[j] = {
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
    for (let p in testCaseData.partiesData) {
      testCaseData.partiesData[p].queries = queries.slice();
    }
    r.push(testCaseData);
  }
  //r.forEach(tc => console.log(tc));
  return r;
}

/**
 * @returns The results of the computation.
 * [{result1}, {result2}, ...]
 */
const computeResult = (tc) => {
  const results = [];

  // sorted array holding all values.
  let allValuesArray = [];
  for (let p in tc.partiesData) {
    allValuesArray = allValuesArray.concat(tc.partiesData[p].inputArray.slice());
  }
  allValuesArray = allValuesArray.sort(function(a, b) { return a - b; });
  console.log(allValuesArray);

  // array holding all queries (generated randomly).
  // all parties' queries should be the same.
  const queries = tc.partiesData[Object.keys(tc.partiesData)[0]].queries;
  console.log(queries);
  for (let j = 0; j < queries.length; j++) {
    let counter = 0;
    for (let k = 0; k < allValuesArray.length; k++)
      counter = allValuesArray[k] === queries[j] ? counter + 1 : counter;
    results.push(counter);
    // existence check
    // if (allValuesArray.includes(queries[j]))
    //   results.push(1);
    // else
    //   results.push(0);
  }

  results.push(makeResultTree(allValuesArray, 0, allValuesArray.length - 1));

  return results;
}

describe('Test', function () {
  this.timeout(0);

  it('Exhaustive', function(done) {
    let i = 0;
    // let doneExistsCounter = 0;
    let doneOpenTreeCounter = 0;
    let testCases = generateTestCases(testCasesCount);

    // recursive test case runner
    (runTestCase = (i) => {
      let tc = testCases[i];
      let queriesResult = computeResult(tc); 
      let treeResult = queriesResult.splice(-1,1)[0];
      displayResultTree(treeResult, "root");

      
      let onConnect = function(jiff_instance) {
        let instanceData = tc.partiesData[jiff_instance.id];
        mpc.submitArray(instanceData.inputArray, jiff_instance).then(function(sortedShares) {
          instanceData.root = makeTree(sortedShares, 0, sortedShares.length-1);
          
          instanceData.nodesCount = nodesCount;
          nodesCount = 0;

          let promises = [];
          instanceData.queries.forEach(query => {
            promises.push(mpc.exists(instanceData.nodesCount, instanceData.root, query, jiff_instance));
          });

          Promise.all(promises).then(results => {
            let msg = "Party: " + jiff_instance.id + ". Input: " + results + ".";
            try {
              assert.deepEqual(results, queriesResult, msg);
              // open the tree
              mpc.openTree(instanceData.nodesCount, instanceData.root).then((root, string) => {
                let assertion = compareTwoTrees(root, treeResult, string, done);
                if (assertion === 0) {
                  if (--doneOpenTreeCounter === 0) {
                    if (i+1 === testCasesCount) {
                      done();
                    }
                    else
                      runTestCase(i+1);
                  }
                }
                else {
                  console.log("Trees not equal!");
                  displayOpenedTree(root, "root");
                  displayResultTree(treeResult, "root");
                  done(new Error("Trees not equal."));
                  done = ()=>{};
                }
              });
            } catch(assertionError) {
              done(assertionError);
              done = function(){}
            }
          });

        });

      }

  
      for (let party in tc.partiesData) {
        ++doneOpenTreeCounter;
        let options = { party_count: Object.keys(tc.partiesData).length, onError: console.log, onConnect: onConnect, party_id: parseInt(party)};
        mpc.connect("http://localhost:8080", tc.computation_id, options);
      }
    })(i)
  });
});