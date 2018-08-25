import { Component, PureComponent, createElement } from 'react';

const isDevMode =
  !process.env.NODE_ENV || process.env.NODE_ENV === 'development';

function isComponent(component) {
  return (
    typeof component === 'function' &&
    (component.prototype instanceof Component ||
      component.prototype instanceof PureComponent)
  );
}

function shallowEqual(value1, value2) {
  if (value1 === value2) return true;
  if (value1 instanceof Date && value2 instanceof Date) {
    return value1.getTime() === value2.getTime();
  }
  if (value1 && value2) {
    if (Array.isArray(value1)) {
      const length = value1.length;
      if (length !== value2.length) return false;
      for (let i = 0; i < length; i++) {
        if (value1[i] !== value2[i]) return false;
      }
      return true;
    }
    const value1Keys = Object.keys(value1);
    if (value1Keys.length !== Object.keys(value2).length) return false;
    for (let key of value1Keys) {
      if (value1[key] !== value2[key]) return false;
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

  class Wrapper extends Component {
    constructor(props) {
      super(props);

      this.off = on(() => {
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
      if (shallowEqual(nextMappedProps, this.mappedProps)) {
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
      }

      this.lastProps = props;
      const isClass = isComponent(component);
      if (isClass) {
        return createElement(component, props);
      }
      const renderResult = component(props, this);
      if (renderResult && typeof renderResult.then === 'function') {
        this.promise = renderResult;
        renderResult.then(
          result => {
            if (this.promise !== renderResult) return;
            if (this.lastResult === result) return;

            this.lastResult = result;

            if (typeof result === 'object' && result.default) {
              // support import() result
              result = result.default;
            }

            const { success, failure, loading, ...normalizedProps } = props;

            if (success) {
              result = success(result);
            }

            if (typeof result === 'function') {
              if (isComponent(result)) {
                result = createElement(result, normalizedProps);
              } else {
                result = result(normalizedProps);
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
      handlers[i](state);
    }
  }

  function use() {
    middlewares.push(...arguments);
  }

  function wrapComponent(stateToProps, component) {
    return props =>
      createElement(Wrapper, { stateToProps, component, ownedProps: props });
  }

  function get() {
    if (!arguments.length) return state;
    if (arguments.length > 1) {
      return wrapComponent(arguments[0], arguments[1]);
    }
    const view = arguments[0];
    return function(props) {
      return view(state, props);
    };
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
        (next, current) => {
          return function(result, newTarget) {
            current(context)(next)(
              result,
              newTarget === undefined ? target : newTarget
            );
          };
        },
        function(result) {
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
    return view(state);
  }

  return {
    app,
    get,
    set,
    on,
    use,
    hoc: stateToProps => component => get(stateToProps, component)
  };
}
