"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

exports.default = function () {
  var initialState = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
  var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

  var state = initialState;
  var _options$mode = options.mode,
      mode = _options$mode === undefined ? "merge" : _options$mode;

  var context = (0, _react.createContext)();
  var handlers = [];
  var middlewares = [];

  var Provider = function (_Component) {
    _inherits(Provider, _Component);

    function Provider() {
      _classCallCheck(this, Provider);

      return _possibleConstructorReturn(this, (Provider.__proto__ || Object.getPrototypeOf(Provider)).apply(this, arguments));
    }

    _createClass(Provider, [{
      key: "componentDidMount",
      value: function componentDidMount() {
        var _this2 = this;

        this.off = on(function () {
          return _this2.forceUpdate();
        });
      }
    }, {
      key: "componentWillUnmount",
      value: function componentWillUnmount() {
        this.off();
      }
    }, {
      key: "render",
      value: function render() {
        return (0, _react.createElement)(context.Provider, { value: state }, this.props.children(state));
      }
    }]);

    return Provider;
  }(_react.Component);

  var Consumer = function (_PureComponent) {
    _inherits(Consumer, _PureComponent);

    function Consumer() {
      _classCallCheck(this, Consumer);

      return _possibleConstructorReturn(this, (Consumer.__proto__ || Object.getPrototypeOf(Consumer)).apply(this, arguments));
    }

    _createClass(Consumer, [{
      key: "render",
      value: function render() {
        var _this4 = this;

        if (this.lastProps === this.props) {
          // is async component
          if (this.promise) {
            return this.promiseResult;
          }
        } else {
          // props has been changed
        }

        this.lastProps = this.props;
        var component = this.props.__component;
        var isClass = isComponent(component);
        var props = Object.assign({}, this.props);
        delete props.__component;
        if (isClass) {
          return (0, _react.createElement)(component, props);
        }
        var renderResult = component(props, this);
        if (renderResult && typeof renderResult.then === "function") {
          this.promise = renderResult;
          renderResult.then(function (result) {
            if (_this4.promise !== renderResult) return;
            if (_this4.lastResult === result) return;

            _this4.lastResult = result;

            if ((typeof result === "undefined" ? "undefined" : _typeof(result)) === "object" && result.default) {
              // support import() result
              result = result.default;
            }

            var success = props.success,
                failure = props.failure,
                loading = props.loading,
                normalizedProps = _objectWithoutProperties(props, ["success", "failure", "loading"]);

            if (success) {
              result = success(result);
            }

            if (typeof result === "function") {
              if (isComponent(result)) {
                result = (0, _react.createElement)(result, normalizedProps);
              } else {
                result = result(normalizedProps);
              }
            }

            _this4.promiseResult = result;
            _this4.forceUpdate();
          }, function (error) {
            if (_this4.promise !== renderResult) return;
            _this4.lastResult = error;
            _this4.promiseResult = typeof props.failure === "function" ? props.failure(error) : props.failure !== undefined ? props.failure : error;
          });
          return props.loading === undefined ? null : props.loading;
        }
        return renderResult;
      }
    }]);

    return Consumer;
  }(_react.PureComponent);

  function on(handler) {
    handlers.push(handler);
    return function () {
      var index = handlers.indexOf(handler);
      if (index !== -1) {
        handlers.splice(index, 1);
      }
    };
  }

  function notifyChange(target) {
    for (var i = 0, length = handlers.length; i < length; i++) {
      handlers[i](state);
    }
  }

  function use() {
    middlewares.push.apply(middlewares, arguments);
  }

  function app(view) {
    return (0, _react.createElement)(Provider, {}, view);
  }

  function get() {
    if (!arguments.length) return state;
    if (arguments.length > 1) {
      var stateToProps = arguments[0];
      var component = arguments[1];
      return function (props) {
        return (0, _react.createElement)(context.Consumer, {}, function (state) {
          return (0, _react.createElement)(Consumer, Object.assign({ __component: component }, stateToProps(state, props)));
        });
      };
    }
    var view = arguments[0];
    return function (props) {
      return (0, _react.createElement)(context.Consumer, {}, function (state) {
        return view(state, props);
      });
    };
  }

  function set(newState, target) {
    if (typeof newState === "function") {
      var action = newState;

      var dispatcher = function dispatcher() {
        for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
          args[_key] = arguments[_key];
        }

        return set(action.apply(undefined, [state].concat(args)), target);
      };

      if (target === undefined) {
        target = dispatcher;
      }

      return dispatcher;
    }

    var isMergingMode = mode === "merge";
    var context = { get: get, set: set };
    var process = function process(result) {
      middlewares.reduce(function (next, current) {
        return function (result, newTarget) {
          current(context)(next)(result, newTarget === undefined ? target : newTarget);
        };
      }, function (result) {
        if (result !== undefined && result !== null && result !== state) {
          if (isMergingMode) {
            var changed = false;
            for (var key in result) {
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
      })(result, target);

      return state;
    };

    if (newState && typeof newState.then === "function") {
      isMergingMode = true;
      return newState.then(process);
    }
    return process(newState);
  }
  return {
    app: app,
    get: get,
    set: set,
    on: on,
    use: use,
    hoc: function hoc(stateToProps) {
      return function (component) {
        return get(stateToProps, component);
      };
    }
  };
};

var _react = require("react");

function _objectWithoutProperties(obj, keys) { var target = {}; for (var i in obj) { if (keys.indexOf(i) >= 0) continue; if (!Object.prototype.hasOwnProperty.call(obj, i)) continue; target[i] = obj[i]; } return target; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

function isComponent(component) {
  return typeof component === "function" && (component.prototype instanceof _react.Component || component.prototype instanceof _react.PureComponent);
}
//# sourceMappingURL=index.js.map