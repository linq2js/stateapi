'use strict';

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
      mode = _options$mode === undefined ? 'merge' : _options$mode;

  var handlers = [];
  var middlewares = [];

  var Wrapper = function (_Component) {
    _inherits(Wrapper, _Component);

    function Wrapper(props) {
      _classCallCheck(this, Wrapper);

      var _this = _possibleConstructorReturn(this, (Wrapper.__proto__ || Object.getPrototypeOf(Wrapper)).call(this, props));

      _this.off = on(function () {
        try {
          if (!_this.shouldComponentUpdate(_this.props)) return;
        } catch (ex) {
          if (isDevMode) {
            console.warn(ex);
          }
          return;
        }
        _this.forceUpdate();
      });

      _this.shouldComponentUpdate(_this.props);
      return _this;
    }

    _createClass(Wrapper, [{
      key: 'mapProps',
      value: function mapProps(props) {
        return this.props.stateToProps(state, props);
      }
    }, {
      key: 'shouldComponentUpdate',
      value: function shouldComponentUpdate(nextProps) {
        var nextMappedProps = this.mapProps(nextProps.ownedProps);
        if (shallowEqual(nextMappedProps, this.mappedProps)) {
          return false;
        }
        this.mappedProps = nextMappedProps;
        return true;
      }
    }, {
      key: 'componentWillUnmount',
      value: function componentWillUnmount() {
        this.unmount = true;
        this.off();
      }
    }, {
      key: 'render',
      value: function render() {
        var _this2 = this;

        var props = this.mappedProps;
        var component = this.props.component;
        if (this.lastProps === props) {
          // is async component
          if (this.promise) {
            return this.promiseResult;
          }
        } else {
          // props has been changed
        }

        this.lastProps = props;
        var isClass = isComponent(component);
        if (isClass) {
          return (0, _react.createElement)(component, props);
        }
        var renderResult = component(props, this);
        if (renderResult && typeof renderResult.then === 'function') {
          this.promise = renderResult;
          renderResult.then(function (result) {
            if (_this2.promise !== renderResult) return;
            if (_this2.lastResult === result) return;

            _this2.lastResult = result;

            if ((typeof result === 'undefined' ? 'undefined' : _typeof(result)) === 'object' && result.default) {
              // support import() result
              result = result.default;
            }

            var success = props.success,
                failure = props.failure,
                loading = props.loading,
                normalizedProps = _objectWithoutProperties(props, ['success', 'failure', 'loading']);

            if (success) {
              result = success(result);
            }

            if (typeof result === 'function') {
              if (isComponent(result)) {
                result = (0, _react.createElement)(result, normalizedProps);
              } else {
                result = result(normalizedProps);
              }
            }

            _this2.promiseResult = result;
            _this2.forceUpdate();
          }, function (error) {
            if (_this2.promise !== renderResult) return;
            _this2.lastResult = error;
            _this2.promiseResult = typeof props.failure === 'function' ? props.failure(error) : props.failure !== undefined ? props.failure : error;
          });
          return props.loading === undefined ? null : props.loading;
        }
        return renderResult;
      }
    }]);

    return Wrapper;
  }(_react.Component);

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
      var handler = handlers[i];
      handler && handler(state);
    }
  }

  function use() {
    middlewares.push.apply(middlewares, arguments);
  }

  function wrapComponent(stateToProps, component) {
    return function (props) {
      return (0, _react.createElement)(Wrapper, { stateToProps: stateToProps, component: component, ownedProps: props });
    };
  }

  function get() {
    if (!arguments.length) return state;
    if (arguments.length > 1) {
      return wrapComponent(arguments[0], arguments[1]);
    }
    var view = arguments[0];
    return function (props) {
      return view(state, props);
    };
  }

  function createDispatcher(action, target, slice) {
    var dispatcher = function dispatcher() {
      for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
        args[_key] = arguments[_key];
      }

      return set(action.apply(undefined, [slice ? state[slice] : state].concat(args)), target, slice);
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

    var newState = arguments[0];
    var target = arguments[1];
    var slice = arguments[2];
    var isMergingMode = mode === 'merge';
    var context = { get: get, set: set };
    var compareState = function compareState(current, next) {
      var changed = false;
      if (isMergingMode) {
        for (var key in next) {
          if (current[key] !== next[key]) {
            changed = true;
            break;
          }
        }
      }
      return changed;
    };
    var process = function process(result) {
      middlewares.reduce(function (next, current) {
        return function (result, newTarget) {
          current(context)(next)(result, newTarget === undefined ? target : newTarget);
        };
      }, function (result) {
        if (slice) {
          if (compareState(state[slice], result)) return;
          result = Object.assign({}, state, _defineProperty({}, slice, result));
        }

        if (result === undefined || result === null || result === state) return;
        if (compareState(state, result)) {
          result = Object.assign({}, state, result);
        }

        state = result;
        notifyChange(target);
      })(result, target);

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

var _react = require('react');

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function _objectWithoutProperties(obj, keys) { var target = {}; for (var i in obj) { if (keys.indexOf(i) >= 0) continue; if (!Object.prototype.hasOwnProperty.call(obj, i)) continue; target[i] = obj[i]; } return target; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var isDevMode = !process.env.NODE_ENV || process.env.NODE_ENV === 'development';

function isComponent(component) {
  return typeof component === 'function' && (component.prototype instanceof _react.Component || component.prototype instanceof _react.PureComponent);
}

function shallowEqual(value1, value2) {
  if (value1 === value2) return true;
  if (value1 instanceof Date && value2 instanceof Date) {
    return value1.getTime() === value2.getTime();
  }
  if (value1 && value2) {
    if (Array.isArray(value1)) {
      var length = value1.length;
      if (length !== value2.length) return false;
      for (var i = 0; i < length; i++) {
        if (value1[i] !== value2[i]) return false;
      }
      return true;
    }
    var value1Keys = Object.keys(value1);
    if (value1Keys.length !== Object.keys(value2).length) return false;
    var _iteratorNormalCompletion = true;
    var _didIteratorError = false;
    var _iteratorError = undefined;

    try {
      for (var _iterator = value1Keys[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
        var key = _step.value;

        if (value1[key] !== value2[key]) return false;
      }
    } catch (err) {
      _didIteratorError = true;
      _iteratorError = err;
    } finally {
      try {
        if (!_iteratorNormalCompletion && _iterator.return) {
          _iterator.return();
        }
      } finally {
        if (_didIteratorError) {
          throw _iteratorError;
        }
      }
    }

    return true;
  }
  return false;
}
//# sourceMappingURL=index.js.map