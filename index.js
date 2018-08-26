import { Component, PureComponent, createElement } from 'react';

let storeId = 0;
const isDevMode =
  !process.env.NODE_ENV || process.env.NODE_ENV === 'development';

function isComponent(component) {
  return (
    typeof component === 'function' &&
    (component.prototype instanceof Component ||
      component.prototype instanceof PureComponent)
  );
}

function compute(computedProps, getState, onUpdate) {
  const state = getState();
  const hasSetter = typeof state.set === 'function';

  for (let computedPropName in computedProps) {
    const evalutator = computedProps[computedPropName];
    if (evalutator.inMemory) continue;

    const value = evalutator(state);

    if (hasSetter) {
      state.set(computedPropName, value);
    } else {
      state[computedPropName] = value;
    }
  }
}

function shallowEqual(value1, value2, ignoreFuncs) {
  if (value1 === value2) return true;
  if (value1 instanceof Date && value2 instanceof Date) {
    return value1.getTime() === value2.getTime();
  }
  if (value1 && value2) {
    if (Array.isArray(value1)) {
      const length = value1.length;
      if (length !== value2.length) return false;
      for (let i = 0; i < length; i++) {
        const value1Prop = value1[i];
        const value2Prop = value2[i];
        if (
          ignoreFuncs &&
          typeof value1Prop === 'function' &&
          typeof value2Prop === 'function'
        )
          continue;
        if (value1Prop !== value2Prop) return false;
      }
      return true;
    }
    const value1Keys = Object.keys(value1);
    if (value1Keys.length !== Object.keys(value2).length) return false;
    for (let key of value1Keys) {
      const value1Prop = value1[key];
      const value2Prop = value2[key];
      if (
        ignoreFuncs &&
        typeof value1Prop === 'function' &&
        typeof value2Prop === 'function'
      )
        continue;
      if (value1Prop !== value2Prop) return false;
    }
    return true;
  }
  return false;
}

export default function(initialState = {}, options = {}) {
  let state = initialState;
  const { mode = 'merge' } = options;
  const handlers = [];
  const middlewares = [];
  const computedProps = {};
  const connected = {};
  const id = storeId++;
  const defaultStateToProps = x => x;

  class Wrapper extends Component {
    constructor(props) {
      super(props);

      this.off = on(() => {
        // this might cause unwanted error
        // typically should use this.setState(dummyState) to force component re-render
        // but for performance improving, setState(dummyState) leads to more validation steps and get slow,
        // so I use forceUpdate for the best performance (~2x)
        try {
          if (!this.shouldComponentUpdate(this.props)) return;
        } catch (ex) {
          if (isDevMode) {
            console.warn(ex);
          }
          return;
        }
        this.forceUpdate();
      });

      this.shouldComponentUpdate(this.props);
    }

    mapProps(props) {
      return this.props.stateToProps(state, props);
    }

    shouldComponentUpdate(nextProps) {
      const nextMappedProps = this.mapProps(nextProps.ownedProps);
      if (shallowEqual(nextMappedProps, this.mappedProps, true)) {
        return false;
      }
      this.mappedProps = nextMappedProps;
      return true;
    }

    componentWillUnmount() {
      this.unmount = true;
      this.off();
    }

    render() {
      const props = this.mappedProps;
      const component = this.props.component;
      if (this.lastProps === props) {
        // is async component
        if (this.promise) {
          return this.promiseResult;
        }
      } else {
        // props has been changed
        // clean last result
        delete this.lastResult;
      }

      this.lastProps = props;
      if (this.props.isComp) {
        return createElement(component, props);
      }
      const renderResult = component(props, this);
      // renderResult might be promise (import, custom data loading)
      if (renderResult && typeof renderResult.then === 'function') {
        this.promise = renderResult;
        renderResult.then(
          result => {
            if (this.promise !== renderResult) return;
            if (this.lastResult === result) return;

            this.lastResult = result;

            // handle import default
            if (
              typeof result === 'object' &&
              typeof result.default === 'function'
            ) {
              result = result.default;
            }

            // exclude async props
            const { success, failure, loading, ...normalizedProps } = props;

            // call success handling if any
            if (success) {
              result = success(result);
            }

            // result might be component, so we poss all props of current to it
            if (typeof result === 'function') {
              if (isComponent(result)) {
                result = createElement(result, normalizedProps);
              } else {
                result = result(normalizedProps, this);
              }
            }

            this.promiseResult = result;
            this.forceUpdate();
          },
          error => {
            if (this.promise !== renderResult) return;
            this.lastResult = error;
            this.promiseResult =
              typeof props.failure === 'function'
                ? props.failure(error)
                : props.failure !== undefined
                ? props.failure
                : error;
          }
        );
        return props.loading === undefined ? null : props.loading;
      }
      return renderResult;
    }
  }

  function on(handler) {
    handlers.push(handler);
    return function() {
      const index = handlers.indexOf(handler);
      if (index !== -1) {
        handlers.splice(index, 1);
      }
    };
  }

  function notifyChange(target) {
    for (let i = 0, length = handlers.length; i < length; i++) {
      const handler = handlers[i];
      handler && handler(state);
    }
  }

  function use() {
    middlewares.push(...arguments);
  }

  function wrapComponent(stateToProps = (state, props) => props, component) {
    return props =>
      createElement(Wrapper, {
        stateToProps,
        component,
        ownedProps: props,
        isComp: isComponent(component)
      });
  }

  function get() {
    if (!arguments.length) return state;
    if (arguments.length > 1) {
      return wrapComponent(arguments[0], arguments[1]);
    }
    return wrapComponent(defaultStateToProps, arguments[0]);
  }

  function createDispatcher(action, target, slice) {
    const dispatcher = function(...args) {
      return set(action(slice ? state[slice] : state, ...args), target, slice);
    };

    if (target === undefined) {
      target = dispatcher;
    }

    return dispatcher;
  }

  function set() {
    if (typeof arguments[0] === 'function') {
      return createDispatcher(arguments[0], arguments[1]);
    }

    if (typeof arguments[0] === 'string') {
      return createDispatcher(arguments[1], arguments[2], arguments[0]);
    }

    const newState = arguments[0];
    const target = arguments[1];
    const slice = arguments[2];
    let isMergingMode = mode === 'merge';
    const context = { get, set };
    const compareState = (current, next) => {
      let changed = false;
      if (isMergingMode) {
        for (let key in next) {
          if (current[key] !== next[key]) {
            changed = true;
            break;
          }
        }
      }
      return changed;
    };
    const process = result => {
      middlewares.reduce(
        (next, current) => (result, newTarget) => {
          current(context)(next)(
            result,
            newTarget === undefined ? target : newTarget
          );
        },
        // default middle, process result
        result => {
          if (slice) {
            if (compareState(state[slice], result)) return;
            result = Object.assign({}, state, { [slice]: result });
          }

          if (result === undefined || result === null || result === state)
            return;
          if (compareState(state, result)) {
            result = Object.assign({}, state, result);
          }

          state = result;
          // call computed props
          compute(computedProps, get, notifyChange);
          notifyChange(target);
        }
      )(result, target);

      return state;
    };

    if (newState && typeof newState.then === 'function') {
      isMergingMode = true;
      return newState.then(process);
    }
    return process(newState);
  }

  function app(view) {
    return get(view)();
  }

  function computed(props) {
    if (typeof props === 'string') {
      if (!(props in computedProps)) {
        throw new Error(`No computed prop named ${props}`);
      }
      return computedProps[props](state);
    }
    let hasChanged = false;
    Object.keys(props).forEach(i => {
      const func = selector(props[i]);
      const parts = i.split(/\s+/);
      // prop name is first part
      let prop = parts.shift();
      let isAsync = false;
      if (prop.startsWith('async ')) {
        isAsync = true;
        prop = prop.substr(6).trim();
      }

      const inMemory = prop[0] === '@';
      if (inMemory) {
        prop = prop.substr(1);
      }

      computedProps[prop] = Object.assign(
        selector(function(state) {
          const mappedArgs = parts.map(part => {
            const argSelector = computedProps[part];
            if (argSelector) {
              return argSelector(state);
            }
            return state[part];
          });

          return func.apply(null, mappedArgs);
        }),
        {
          inMemory,
          isAsync,
          dependencies: parts.reduce((obj, key) => {
            obj[key] = true;
            return obj;
          }, {})
        }
      );
      hasChanged = true;
    });

    // rebuild dependencies
    for (let i in computedProps) {
      const evalutator = computedProps[i];
      evalutator.dependents = [];
      for (let j in computedProps) {
        const subEvalutator = computedProps[j];
        if (subEvalutator.dependencies[i]) {
          evalutator.dependents.push(j);
        }
      }
    }

    if (hasChanged) {
      // re-compute once computedProps changed
      compute(computedProps, get, notifyChange);
    }
  }

  function validateConnection(store) {
    Object.values(store.connected).forEach(connection => {
      if (connection.store.id === id) throw new Error('Circular connect');
      validateConnection(connection.store);
    });
  }

  // create one way connection
  function connect(store, mapper) {
    if (typeof mapper === 'string') {
      const [destProp, sourceProp = destProp] = mapper.split(/\s*=\s*/);

      mapper = function(destState, sourceState) {
        const sourceValue =
          sourceProp && sourceProp !== '*'
            ? sourceState[sourceProp]
            : sourceState;
        // nothing to change
        if (sourceValue === destState[destProp]) return destState;
        return {
          ...destState,
          [destProp]: sourceValue
        };
      };
    }
    validateConnection(store);
    connected[store.id] = {
      store
    };

    function handleChange(destState) {
      const nextState = mapper(state, destState);
      if (nextState !== state) {
        set(nextState);
      }
    }

    store.on(handleChange);

    handleChange(store.get());
  }

  return {
    id,
    app,
    get,
    set,
    on,
    use,
    connect,
    connected,
    computed,
    hoc: stateToProps => component => get(stateToProps, component)
  };
}

export function selector(...funcs) {
  const lastFunc = funcs.pop();
  let lastArgs, lastResult;
  const wrapper = function(...args) {
    if (shallowEqual(lastArgs, args)) {
      return lastResult;
    }
    lastArgs = args;
    return (lastResult = lastFunc.apply(null, args));
  };

  if (!funcs.length) {
    return wrapper;
  }

  const argSelectors = funcs.map(x => selector(x));
  return function(...args) {
    const mappedArgs = argSelectors.map(x => x.apply(null, args));
    return wrapper.apply(null, mappedArgs);
  };
}