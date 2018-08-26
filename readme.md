# stateapi

A state management for React. It is lightweight but powerful

## Features

1.  Lightweight
1.  Simple API
1.  Support middleware
1.  Support computed props
1.  Support multiple state updating modes
1.  Support Sync and Async update
1.  Support Async Component
1.  Support immutablejs

## Counter sample

```jsx
import React from "react";
import { render } from "react-dom";
import create from "stateapi";

// create counter store with initial state and return its apis
const { app, get, set } = create({ counter: 0 });

// define some actions, remmeber that action always returns new state.
// returning undefined means nothing to change
// increase counter
const increase = set(state => ({ counter: state.counter + 1 }));
// decrease counter
const decrease = set(state => ({ counter: state.counter - 1 }));

render(
  app(state => (
    <div>
      <h1>{state.counter}</h1>
      <button onClick={increase}>+</button>
      <button onClick={decrease}>-</button>
    </div>
  )),
  document.body
);
```

## Middleware

```js
import create from "stateapi";
const { use, set } = create({ counter: 0 });

// increase counter
const increase = set(
  state => ({ counter: state.counter + 1 }),
  "increase-action"
);
// decrease counter
const decrease = set(state => ({ counter: state.counter - 1 }));

use(context => next => (newState, action) => {
  const { get, set } = context;
  if (action === decrease) {
    console.log("decrease-action");
  } else if (action === "increase-action") {
    console.log(action);
  } else if (!action) {
    console.log("unknown-action");
  }

  console.log("before-change");
  console.log("new-state", newState);
  console.log("current-state", get());
  next(newState);
  console.log("after-change");
});
```

## High Order Component

```jsx
import create from "stateapi";
const { get, hoc } = create({ counter: 0 });

// the component re-renders if state changed
const Counter = get(state => <div>{state.counter}</div>);
// using stateToProps() as first param
// the component only re-renders if counter changed
const Coutner = get(
  state => ({ counter: state.counter }),
  props => <div>{props.counter}</div>
);
// using hoc to get same effect as above
const CounterHoc = hoc(state => ({ counter: state.counter }));
const Counter = CounterHoc(props => <div>{props.counter}</div>);
```

## Get and Set state directly

```js
import create from "stateapi";
const { get, set } = create({ counter: 0 });
// get current state
console.log(get());
// set new state
set({ counter: 100 });
```

## Handle state change

```js
import create from "stateapi";
const { on, set } = create({ counter: 0 });
on(console.log);
// set new state
set({ counter: 100 });
```

## State replace mode

```js
import create from "stateapi";
const { set } = create({ counter: 0 }, { mode: "replace" });

// increase counter
const increase = set(state => ({ ...state, counter: state.counter + 1 }));
```

## State merge mode (default)

```js
import create from "stateapi";
const { set } = create({ counter: 0 }, { mode: "merge" });

// increase counter
const increase = set(state => ({ counter: state.counter + 1 }));

// stateapi uses shallow comparer to detect new state change
// in this case, nothing to change because counter value is the same of prev one
const doNothing = set(state => ({ counter: state.counter }));
```

## Async updating

```js
import create from "stateapi";
const { set } = create({ counter: 0, todos: undefined });
const increase = set(state => ({ counter: state.counter + 1 }));
increase();

const loadTodosFrom = set((state, url) =>
  fetch(url)
    .then(res => res.json())
    .then(res => ({
      // merge todos with current state
      todos: res
    }))
);

loadTodosFrom("http://tempuri.org");
```

## Async Component

```jsx
import create from "stateapi";
const { get } = create({ source: "http://tempuri.org" });

const TodoList = get(
  state => ({ source: state.source }),
  props =>
    fetch(props.source).then(todos =>
      todos.map(todo => <TodoItem todo={todo} />)
    )
);

const AscynComponentWrapper = get(
  state => ({
    /* Profile props here */
  }),
  props => import("./Profile")
);
```

## Support immutable

```js
const initialState = fromJS({ counter: 0 });
// indicate replace mode when creating store
const { set } = create(initialState, { mode: "replace" });
const increase = set(state => state.set("counter", state.get("counter") + 1));
const newState = increase();
expect(newState).not.toBe(initialState);
expect(newState.get("counter")).toBe(1);
```

## Support computed props

Computed props will be re-computed once state changed

```js
const { get, set, computed } = create({ counter: 0 });
computed({
  isOdd(state) {
    return state.counter % 2 !== 0;
  }
});
const increase = set(state => ({ counter: state.counter + 1 }));

console.log(get().isOdd); // => false
increase();
console.log(get().isOdd); // => true
```

There are 2 computed prop types: In-memory and In-State (default). In order to define In-Memory computed prop, just add prefix @.
Use computed('InMemoryComputedPropNameWithoutAtSign') to get In-Memory computed prop value

```js
const { get, set, computed } = create({ counter: 0 });
computed({
  "@isOdd"(state) {
    return state.counter % 2 !== 0;
  }
});
const increase = set(state => ({ counter: state.counter + 1 }));

console.log(get().isOdd); // => undefined
increase();
console.log(computed("isOdd")); // => true
```

Computed prop can has many dependencies

```js
const { get, computed } = create({
  page: 0,
  pageSize: 10,
  totalItems: 15
});
computed({
  // define in-memory computed prop pageCount
  // it has 2 dependencies: pageSize and totalItems
  "#pageCount pageSize totalItems": (pageSize, totalItems) =>
    Math.ceil(totalItems / pageSize),
  "#canPrev page": (page, pageCount) => page > 0 && page < pageCount,
  "#canNext page pageCount": (page, pageCount) => page < pageCount - 1,
  "pagination pageCount canPrev canNext": (pageCount, canPrev, canNext) => ({
    pageCount,
    canPrev,
    canNext
  })
});

console.log(get().pagination); // => { pageCount: 2, canPrev: false, canNext: true }
```
