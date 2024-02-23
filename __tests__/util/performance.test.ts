import { expect, mock, describe, beforeEach, it, beforeAll } from "bun:test";
import { Stingray } from '../../src/util/performance';

describe('Stingray', () => {
  class TestClass {
    method1() {
      return 'method1';
    }

    async method2() {
      return 'method2';
    }
  }

  it('should wrap class methods with performance markers', () => {
    const monitoredClass = Stingray(TestClass);
    const instance = new monitoredClass();

    const result1 = instance.method1();
    expect(result1).toBe('method1');

    const result2 = instance.method2();
    expect(result2).resolves.toBe('method2');
  });

  it('should wrap static class methods with performance markers', () => {
    class StaticTestClass {
      static staticMethod1() {
        return 'staticMethod1';
      }

      static async staticMethod2() {
        return 'staticMethod2';
      }
    }

    const monitoredClass = Stingray(StaticTestClass);

    const result1 = monitoredClass.staticMethod1();
    expect(result1).toBe('staticMethod1');

    const result2 = monitoredClass.staticMethod2();
    expect(result2).resolves.toBe('staticMethod2');
  });

  it('should wrap parent class methods with performance markers', () => {
    class ParentClass {
      parentMethod() {
        return 'parentMethod';
      }
    }

    class ChildClass extends ParentClass {
      childMethod() {
        return 'childMethod';
      }
    }

    const monitoredClass = Stingray(ChildClass);
    const instance = new monitoredClass();

    const result1 = instance.parentMethod();
    expect(result1).toBe('parentMethod');

    const result2 = instance.childMethod();
    expect(result2).toBe('childMethod');
  });

  it('should wrap function with performance markers', () => {
    function testFunction() {
      return 'testFunction';
    }

    const monitoredFunction = Stingray(testFunction);

    const result = monitoredFunction();
    expect(result).toBe('testFunction');
  });

  it('should wrap object methods with performance markers', () => {
    const testObject = {
      method1() {
        return 'method1';
      },

      async method2() {
        return 'method2';
      },
    };

    const monitoredObject = Stingray(testObject);

    const result1 = monitoredObject.method1();
    expect(result1).toBe('method1');

    const result2 = monitoredObject.method2();
    expect(result2).resolves.toBe('method2');
  });
});