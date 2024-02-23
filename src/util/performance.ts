
interface PerformanceSplit {
  operation: string;
  duration: number;
  split: number;
}

interface PerformanceMarker {
  name: string;
  start: number;
  end: number;
  duration: number;
  splits: PerformanceSplit[],
  split: (op:string) => number;
  endMarker: () => number;
}
let performanceMarkers = new Map<string, PerformanceMarker[]>();

export function startMarker(name: string) {
  const marker: PerformanceMarker = {
    name,
    start: performance.now(),
    splits: [],
    end: 0,
    duration: 0,
    split: function (operation: string) {
      const split = performance.now();
      const lastSplit = this.splits[this.splits.length - 1] || { split: this.start };
      this.duration = split - lastSplit.split;
      this.splits.push({
        operation,
        duration: this.duration,
        split
      });
      return this.duration;
    },
    endMarker: function () {
      this.end = performance.now();
      this.duration = this.end - this.start;
      return this.duration;
    }
  }
  if (!performanceMarkers.has(name)) {
    performanceMarkers.set(name, []);
  }

  performanceMarkers.get(name)!.push(marker);
  return marker;
}

interface PerformanceMetric {
  name: string;
  averageDuration: number;
  medianDuration: number;
  dataPoints: number;
}
export function getPerformanceMetrics(): PerformanceMetric[] {
  return Array.from(performanceMarkers.entries()).map(([name, markers]) => {
    const durations = markers.map(marker => marker.duration);
    const dataPoints = durations.length;
    const averageDuration = durations.reduce((acc, cur) => acc + cur, 0) / dataPoints;
    const sortedDurations = durations.sort((a, b) => a - b);
    const medianDuration = sortedDurations[Math.floor(dataPoints / 2)];
    return {
      name,
      averageDuration,
      medianDuration,
      dataPoints,
      sample: {
        min: sortedDurations[0],
        max: sortedDurations[sortedDurations.length - 1],
        splits: markers[0].splits
      }
    }
  });
}

function isClass(func: any): func is StingrayClass {
  return typeof func === 'function'
    && /^class\s/.test(Function.prototype.toString.call(func));
}

type StingrayFn = Function & { __stingray?: boolean };
function isFunction(func: any): func is StingrayFn {
  return typeof func === 'function';
}

type StingrayObj = object & { __stingray?: boolean, [key: string]: unknown };
function isObject(obj: any): obj is StingrayObj {
  return typeof obj === 'object';
}

interface StingrayClass {
  new(...args: any[]): any;
  [key: string]: any;
  prototype: {
    [key: string]: any;
    __stingray?: boolean;
  };
}

export function Stingray<T extends new (...args: any[]) => any>(monitorTarget: T): T;
export function Stingray<T extends Function>(monitorTarget: T): T;
export function Stingray<T extends object>(monitorTarget: T): T;
export function Stingray<T extends object>(monitorTarget: T): T {
  if (isClass(monitorTarget)) {
    if (monitorTarget.prototype.__stingray) {
      return monitorTarget;
    }
    const prototype = monitorTarget.prototype;
    prototype.__stingray = true;
    for (const methodName of Object.getOwnPropertyNames(prototype)) {
      const method = prototype[methodName];
      if (typeof method === 'function') {
        prototype[methodName] = function (...args: any[]) {
          const marker = startMarker(`${monitorTarget.name}.${methodName}`);
          let result;
          try {
            result = method.apply(this, args);
            if (result instanceof Promise) {
              return result.then((res: any) => {
                return res;
              }).finally(() => {
                marker.endMarker();
              });
            }
            return result;
          } finally {
            if (!(result instanceof Promise)) {
              marker.endMarker();
            }
          }
        }
      }
    }
    // check for static methods
    for (const methodName of Object.getOwnPropertyNames(monitorTarget)) {
      const method = monitorTarget[methodName];
      if (typeof method === 'function') {
        interface StingrayClass {
          new(...args: any[]): any;
          prototype: {
            [key: string]: any;
            __stingray?: boolean;
          };
          [key: string]: any; // Add index signature
        }

        (monitorTarget as StingrayClass)[methodName] = function (...args: any[]) {
          const marker = startMarker(`${monitorTarget.name}.${methodName}`);
          let result;
          try {
            result = method.apply(this, args);
            if (result instanceof Promise) {
              return result.then((res: any) => {
                return res;
              }).finally(() => {
                marker.endMarker();
              });
            }
            return result;
          } finally {
            if (!(result instanceof Promise)) {
              marker.endMarker();
            }
          }
        }
      }
    }

    // check parent classes
    let parent = Object.getPrototypeOf(monitorTarget);
    while (parent && parent.prototype) {
      for (const methodName of Object.getOwnPropertyNames(parent.prototype)) {
        const method = parent.prototype[methodName];
        if (typeof method === 'function') {
          parent.prototype[methodName] = function (...args: any[]) {
            const marker = startMarker(`${monitorTarget.name}.${methodName}`);
            let result;
            try {
              result = method.apply(this, args);
              if (result instanceof Promise) {
                return result.then((res: any) => {
                  return res;
                }).finally(() => {
                  marker.endMarker();
                });
              }
              return result;
            } finally {
              if (!(result instanceof Promise)) {
                marker.endMarker();
              }
            }
          }
        }
      }
      parent = Object.getPrototypeOf(parent);
    }
  } else if (isFunction(monitorTarget)) {
    if (monitorTarget.__stingray) {
      return monitorTarget;
    }
    const monitoredFunc = function (this: any, ...args: any[]) {
      const marker = startMarker(monitorTarget.name);
      let result;
      try {
        result = monitorTarget.apply(this, args);
        if (result instanceof Promise) {
          return result.then((res: any) => res).finally(() => marker.endMarker());
        }
        return result;
      } finally {
        if (!(result instanceof Promise)) {
          marker.endMarker();
        }
      }
    };

    monitoredFunc.prototype = monitorTarget.prototype;
    monitoredFunc.__stingray = true;

    return monitoredFunc as unknown as T;
  } else if (isObject(monitorTarget)) {
    for (const methodName of Object.getOwnPropertyNames(monitorTarget)) {
      const method = monitorTarget[methodName];
      if (isFunction(method) && !method.__stingray) {
        (monitorTarget as any)[methodName] = function (...args: any[]) {
          const marker = startMarker(`${monitorTarget.constructor.name}.${methodName}`);
          let result;
          try {
            result = method.apply(this, args);
            if (result instanceof Promise) {
              return result.then((res: any) => {
                return res;
              }).finally(() => {
                marker.endMarker();
              });
            }
            return result;
          } finally {
            if (!(result instanceof Promise)) {
              marker.endMarker();
            }
          }
        }
      }
    }
  } else {
    throw new Error('Invalid target for Stingray');
  }

  // Monitor the constructor
  return monitorTarget;
}
