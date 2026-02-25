# eslint-plugin-simple-key-sort

Sort object keys alphabetically — with **autofix**.

The rule logic is based on ESLint's built-in [`sort-keys`](https://eslint.org/docs/latest/rules/sort-keys), extended with an autofix that reorders properties in one shot, and a plugin structure that mirrors [`eslint-plugin-simple-import-sort`](https://github.com/lydell/eslint-plugin-simple-import-sort).

---

## Why this plugin?

`sort-keys` only reports violations; it cannot fix them. This plugin adds the missing autofix so you can enforce sorted keys and let the linter clean them up automatically, the same way `eslint-plugin-simple-import-sort` does for imports.

---

## Installation

```sh
npm install --save-dev eslint-plugin-simple-key-sort
```

> **Peer dependency:** `eslint` (any version that supports flat config, i.e. v9+).

---

## Usage

### Flat config (`eslint.config.js`)

```js
import simpleKeySort from 'eslint-plugin-simple-key-sort'

export default [
  {
    plugins: {
      'simple-key-sort': simpleKeySort,
    },
    rules: {
      'simple-key-sort/sort': 'error',
    },
  },
]
```

### With options

```js
'simple-key-sort/sort': [
  'error',
  'asc',
  {
    allowLineSeparatedGroups: false,
    caseSensitive:            true,
    ignoreComputedKeys:       false,
    minKeys:                  2,
    natural:                  false,
  },
]
```

---

## Rule: `simple-key-sort/sort`

Requires all object keys to be sorted. Reports a single error per unsorted group and provides an autofix that sorts the entire group at once.

### Options

#### Argument 1 — order

`"asc"` *(default)* | `"desc"`

Direction of the sort.

```js
// ✓ "asc"
const a = { bar: 2, foo: 1 }

// ✓ "desc"
const b = { foo: 1, bar: 2 }
```

#### Argument 2 — options object

| Option | Type | Default | Description |
|---|---|---|---|
| `allowLineSeparatedGroups` | `boolean` | `false` | When `true`, a blank line between properties starts a new independent sort group. Keys in different groups are not compared with each other. |
| `caseSensitive` | `boolean` | `true` | When `true`, uppercase letters sort before lowercase (`A < a`). When `false`, case is ignored during comparison. |
| `ignoreComputedKeys` | `boolean` | `false` | When `true`, a computed property with a dynamic key (e.g. `{ [expr]: 1 }`) acts as a group separator instead of being sorted. Computed properties with static literal keys (e.g. `{ ["foo"]: 1 }`) are always sortable. |
| `minKeys` | `integer` (≥ 2) | `2` | Minimum number of keys in an object before the rule is enforced. |
| `natural` | `boolean` | `false` | When `true`, uses natural sort order so that digit sequences are compared numerically (`item2` before `item10`). |

---

### Examples

#### `allowLineSeparatedGroups`

```js
/* eslint simple-key-sort/sort: ["error", "asc", { allowLineSeparatedGroups: true }] */

// ✓  each blank-line group is sorted independently
const config = {
  alpha: 1,
  beta:  2,

  x: 10,
  y: 20,
}

// ✗  within a group, keys must still be sorted
const config = {
  beta:  2,  // ← "Run autofix to sort these keys!"
  alpha: 1,
}
```

#### `caseSensitive`

```js
/* eslint simple-key-sort/sort: ["error", "asc", { caseSensitive: true }] */

// ✓  uppercase before lowercase (Unicode order)
const a = { Bar: 1, foo: 2 }

/* eslint simple-key-sort/sort: ["error", "asc", { caseSensitive: false }] */

// ✓  case is ignored, so "bar" and "Bar" are equivalent
const b = { Bar: 1, foo: 2 }
const c = { bar: 1, Foo: 2 }
```

#### `ignoreComputedKeys`

```js
/* eslint simple-key-sort/sort: ["error", "asc", { ignoreComputedKeys: true }] */

const KEY = 'dynamic'

// ✓  the dynamic computed key resets sorting; each segment is sorted independently
const a = {
  alpha: 1,
  beta:  2,
  [KEY]: 3,   // ← group separator
  x:     4,
  y:     5,
}

// ✓  computed keys with a literal value are still sorted
const b = { ["bar"]: 1, ["foo"]: 2 }
```

#### `minKeys`

```js
/* eslint simple-key-sort/sort: ["error", "asc", { minKeys: 3 }] */

// ✓  only 2 keys — below the threshold
const a = { b: 2, a: 1 }

// ✗  3 keys — rule is active
const b = { c: 3, a: 1, b: 2 }
```

#### `natural`

```js
/* eslint simple-key-sort/sort: ["error", "asc", { natural: true }] */

// ✓  natural order treats digit sequences as numbers
const a = {
  item1:  true,
  item2:  true,
  item10: true,  // after item2, not after item1
}

/* eslint simple-key-sort/sort: ["error", "asc", { natural: false }] */

// ✓  lexicographic order
const b = {
  item1:  true,
  item10: true,  // "10" < "2" lexicographically
  item2:  true,
}
```

---

### Spread elements

Spread elements (`...obj`) always act as group separators. Keys before and after a spread are sorted independently so that spreading semantics are never broken.

```js
// ✓
const merged = {
  alpha: 1,
  beta:  2,
  ...defaults,
  x: 10,
  y: 20,
}
```

---

### Autofix

When the rule reports a violation, running `eslint --fix` (or the editor quick-fix action) will reorder all keys in the unsorted group in a single operation. The fixer replaces each property's source text in place — comments and trailing commas are preserved exactly as they appear in the original source.

```js
// Before fix
const options = {
  timeout: 5000,
  method:  'GET',   // ← "Run autofix to sort these keys!"
  baseUrl: 'https://api.example.com',
}

// After fix
const options = {
  baseUrl: 'https://api.example.com',
  method:  'GET',
  timeout: 5000,
}
```

---

## Comparison with `sort-keys`

| Feature | `sort-keys` | `simple-key-sort/sort` |
|---|---|---|
| Autofix | No | **Yes** |
| Spread separators | Yes | Yes |
| `allowLineSeparatedGroups` | Yes | Yes |
| `caseSensitive` | Yes | Yes |
| `ignoreComputedKeys` | Yes | Yes |
| `minKeys` | Yes | Yes |
| `natural` | Yes | Yes |
| Error per key | Yes (one per violation) | No (one per group) |

---

## License

MIT © [Joaquin Aguirre](https://github.com/joaguirrem)
