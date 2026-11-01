import {runEquity, type EquityInput} from '../lib/poker/equity';

self.onmessage = (event: MessageEvent<EquityInput>) => {
  try {
    const result = runEquity(event.data, (done, total) => self.postMessage({type: 'progress', done, total}));
    self.postMessage({type: 'result', result});
  } catch (error) {
    self.postMessage({type: 'error', message: error instanceof Error ? error.message : '本次计算失败，请检查输入后重试。'});
  }
};
