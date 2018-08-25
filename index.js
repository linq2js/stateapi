import { Component, PureComponent, createContext, createElement } from "react";

function isComponent(component) {
  return (
    typeof component === "function" &&
    (component.prototype instanceof Component ||
      component.prototype instanceof PureComponent)
  );
}

export default function(initialState = {}, options = {}) {
  let state = initialState;
  const { mode = "merge" } = options;
  const context = createContext();
  const handlers = [];
  const middlewares = [];

  class Provider extends Component {
    componentDidMount() {
      this.off = on(() => this.forceUpdate());
    }

    componentWillUnmount() {
      this.off();
    }

    render() {
      return createElement(
        context.Provider,
        { value: state },
        this.props.children(state)
      );
    }
  }

  class Consumer extends PureComponent {
    render() {
      if (this.lastProps === this.props) {
        // is async component
        if (this.promise) {
          return this.promiseResult;
        }
      } else {
        // props has been changed
      }

      this.lastProps = this.props;
      const component = this.props.__component;
      const isClass = isComponent(component);
      const props = Object.assign({}, this.props);
      delete props.__component;
      if (isClass) {
        return createElement(component, props);
      }
      const renderResult = component(props, this);
      if (renderResult && typeof renderResult.then === "function") {
        this.promise = renderResult;
        renderResult.then(
          result => {
            if (this.promise !== renderResult) return;
            if (this.lastResult === result) return;

            this.lastResult = result;

            if (typeof result === "object" && result.default) {
              // support import() result
              result = result.default;
            }

            const { success, failure, loading, ...normalizedProps } = props;

            if (success) {
              result = success(result);
            }

            if (typeof result === "function") {
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
              typeof props.failure === "function"
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

  function app(view) {
    return createElement(Provider, {}, view);
  }

  function get() {
    if (!arguments.length) return state;
    if (arguments.length > 1) {
      const stateToProps = arguments[0];
      const component = arguments[1];
      return function(props) {
        return createElement(context.Consumer, {}, state =>
          createElement(
            Consumer,
            Object.assign(
              { __component: component },
              stateToProps(state, props)
            )
          )
        );
      };
    }
    const view = arguments[0];
    return function(props) {
      return createElement(context.Consumer, {}, state => view(state, props));
    };
  }

  function set(newState, target) {
    if (typeof newState === "function") {
      const action = newState;

      const dispatcher = function(...args) {
        return set(action(state, ...args), target);
      };

      if (target === undefined) {
        target = dispatcher;
      }

      return dispatcher;
    }

    let isMergingMode = mode === "merge";
    const context = { get, set };
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
          if (result !== undefined && result !== null && result !== state) {
            if (isMergingMode) {
              let changed = false;
              for (let key in result) {
                if (result[key] !== state[key]) {
                  changed = true;
                  break;
                }
              }
              if (!changed) return;
              result = Object.assign({}, state, result);
            }

            state = result;
            notifyChange(target);
          }
        }
      )(result, target);

      return state;
    };

    if (newState && typeof newState.then === "function") {
      isMergingMode = true;
      return newState.then(process);
    }
    return process(newState);
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
