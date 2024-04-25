importScripts('./mpc.js', '../../../dist/jiff-client.js', '../../../dist/jiff-client-websockets.js');

let instance1;
let instance2;

self.onmessage = function (event) {
  const data = event.data;

  switch (data.type) {
    case 'init_1':
      instance1 = mpc.connect(data.hostname, data.computation_id, data.options);
      break;
    case 'init_2':
      instance2 = mpc.connect(data.hostname, data.computation_id, data.options);
      break;
    case 'compute1':
      mpc.compute(data.input, instance1).then((result) => {
        self.postMessage({ result: result, type: 'result1' });
      });
      break;
    case 'compute2':
      mpc.compute(data.input, instance2).then((result) => {
        self.postMessage({ result: result, type: 'result2' });
      });
      break;
  }
};