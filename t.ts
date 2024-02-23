import { Stingray, getPerformanceMetrics } from "./src/util/performance";

class Test {
  constructor() {
    console.log('Test');
  }

  async longRunning() {
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

function test() {
  console.log('Test');
}

let ibj = {
  test() {
    console.log('Test');
  }
}

let monitoredObj = Stingray(ibj);
let monitoredTest = Stingray(test);
let monitoredTest2 = Stingray(Test);

monitoredTest();
await new monitoredTest2().longRunning();
monitoredObj.test();


// Output:
console.log(JSON.stringify(getPerformanceMetrics(), null, 2));