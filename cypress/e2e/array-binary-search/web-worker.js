importScripts('./mpc.js', '../../../dist/jiff-client.js', '../../../dist/jiff-client-websockets.js');

let elem_instance;
let array_instance;

self.onmessage = function (event) {
  const data = event.data;

  switch (data.type) {
    case 'init_elem':
      elem_instance = mpc.connect(data.hostname, data.computation_id, data.options);
      break;
    case 'init_array':
      array_instance = mpc.connect(data.hostname, data.computation_id, data.options);
      break;
    case 'computeElement':
      mpc.compute(data.input, elem_instance).then((result) => {
        self.postMessage({ result: result, type: 'element' });
      });
      break;
    case 'computeArray':
      mpc.compute(data.input, array_instance).then((result) => {
        self.postMessage({ result: result, type: 'array' });
      });
      break;
  }
};
