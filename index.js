/**
 * eslint-plugin-simple-key-sort
 *
 * Sort object keys with autofix.
 * Logic based on ESLint's built-in `sort-keys` rule; plugin structure mirrors
 * `eslint-plugin-simple-import-sort`.
 */

// ─── Natural comparison ──────────────────────────────────────────────────────

/**
 * Natural string comparison: treats embedded digit sequences as numbers so
 * that e.g. "item2" sorts before "item10".
 *
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
function naturalCompare(a, b) {
  return a.localeCompare(b, undefined, { numeric: true, caseFirst: "upper" });
}

// ─── Order predicates (mirrors sort-keys, I = insensitive, N = natural) ─────

const isValidOrders = {
  asc:   (a, b) => a <= b,
  ascI:  (a, b) => a.toLowerCase() <= b.toLowerCase(),
  ascN:  (a, b) => naturalCompare(a, b) <= 0,
  ascIN: (a, b) => naturalCompare(a.toLowerCase(), b.toLowerCase()) <= 0,
  desc:  (a, b) => isValidOrders.asc(b, a),
  descI: (a, b) => isValidOrders.ascI(b, a),
  descN: (a, b) => isValidOrders.ascN(b, a),
  descIN:(a, b) => isValidOrders.ascIN(b, a),
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Return the static string name for a Property node key, or null when the key
 * is a dynamic computed expression that cannot be statically determined.
 *
 * @param {import('eslint').Rule.Node} node  A Property AST node.
 * @returns {string | null}
 */
function getPropertyName(node) {
  if (node.computed) {
    // Computed keys with a literal value are still sortable: { ["a"]: 1 }
    const { key } = node;
    if (key.type === "Literal" && typeof key.value !== "symbol") {
      return String(key.value);
    }
    return null;
  }
  if (node.key.type === "Identifier") return node.key.name;
  if (node.key.type === "Literal")    return String(node.key.value);
  return null;
}

/**
 * Build a comparator suitable for Array#sort that orders property names
 * according to the configured direction, case-sensitivity, and natural mode.
 *
 * @param {"asc"|"desc"} order
 * @param {boolean} caseSensitive
 * @param {boolean} natural
 * @returns {(a: string, b: string) => number}
 */
function makeComparator(order, caseSensitive, natural) {
  const normalize = caseSensitive ? (s) => s : (s) => s.toLowerCase();
  const direction = order === "desc" ? -1 : 1;

  return (a, b) => {
    const na = normalize(a);
    const nb = normalize(b);
    if (natural) return direction * naturalCompare(na, nb);
    return direction * (na < nb ? -1 : na > nb ? 1 : 0);
  };
}

/**
 * Return true when all consecutive, non-null name pairs satisfy isValidOrder.
 *
 * @param {Array<string|null>} names
 * @param {(a: string, b: string) => boolean} isValidOrder
 */
function areSorted(names, isValidOrder) {
  for (let i = 1; i < names.length; i++) {
    if (names[i - 1] !== null && names[i] !== null && !isValidOrder(names[i - 1], names[i])) {
      return false;
    }
  }
  return true;
}

// ─── Rule definition ──────────────────────────────────────────────────────────

const sortRule = {
  meta: {
    type: "layout",
    fixable: "code",

    docs: {
      description: "Require object keys to be sorted (with autofix)",
    },

    schema: [
      { enum: ["asc", "desc"] },
      {
        type: "object",
        properties: {
          allowLineSeparatedGroups: { type: "boolean" },
          caseSensitive:            { type: "boolean" },
          ignoreComputedKeys:       { type: "boolean" },
          minKeys:                  { type: "integer", minimum: 2 },
          natural:                  { type: "boolean" },
        },
        additionalProperties: false,
      },
    ],

    messages: {
      sort: "Run autofix to sort these keys!",
    },
  },

  create(context) {
    // ── Options ────────────────────────────────────────────────────────────
    const order = context.options[0] ?? "asc";
    const {
      allowLineSeparatedGroups = false,
      caseSensitive            = true,
      ignoreComputedKeys       = false,
      minKeys                  = 2,
      natural                  = false,
    } = context.options[1] ?? {};

    const insensitive  = !caseSensitive;
    const orderKey     = order + (insensitive ? "I" : "") + (natural ? "N" : "");
    const isValidOrder = isValidOrders[orderKey];
    const comparator   = makeComparator(order, caseSensitive, natural);
    const sourceCode   = context.sourceCode;

    // ── Helpers ────────────────────────────────────────────────────────────

    /**
     * True when there is at least one blank line between nodeA and nodeB,
     * considering all tokens (including comments) that appear between them.
     */
    function hasBlankLineBetween(nodeA, nodeB) {
      const tokens = sourceCode.getTokensBetween(nodeA, nodeB, { includeComments: true });

      const pairs = [
        [nodeA.loc.end.line,   tokens.length ? tokens[0].loc.start.line : nodeB.loc.start.line],
        ...tokens.slice(0, -1).map((t, i) => [t.loc.end.line, tokens[i + 1].loc.start.line]),
        ...(tokens.length ? [[tokens[tokens.length - 1].loc.end.line, nodeB.loc.start.line]] : []),
      ];

      return pairs.some(([end, start]) => start - end > 1);
    }

    /**
     * Split node.properties into ordered groups of sortable Property nodes.
     * Groups are delimited by:
     *  • SpreadElement / RestElement — cannot sort across a spread
     *  • Computed keys (when ignoreComputedKeys is true)
     *  • Blank lines (when allowLineSeparatedGroups is true)
     */
    function splitIntoGroups(properties) {
      const groups  = [];
      let   current = [];

      for (const prop of properties) {
        const isSpread          = prop.type === "SpreadElement" || prop.type === "RestElement";
        const isIgnoredComputed = ignoreComputedKeys && prop.computed;

        if (isSpread || isIgnoredComputed) {
          if (current.length) { groups.push(current); current = []; }
          continue;
        }

        if (allowLineSeparatedGroups && current.length > 0) {
          if (hasBlankLineBetween(current[current.length - 1], prop)) {
            groups.push(current);
            current = [];
          }
        }

        current.push(prop);
      }

      if (current.length) groups.push(current);
      return groups;
    }

    // ── Visitor ────────────────────────────────────────────────────────────

    return {
      "ObjectExpression:exit"(node) {
        if (node.properties.length < minKeys) return;

        for (const group of splitIntoGroups(node.properties)) {
          if (group.length < minKeys) continue;

          const names = group.map(getPropertyName);

          if (areSorted(names, isValidOrder)) continue;

          // Locate the first out-of-order key for precise error reporting.
          let firstViolationIdx = 1;
          for (let i = 1; i < names.length; i++) {
            if (names[i - 1] !== null && names[i] !== null && !isValidOrder(names[i - 1], names[i])) {
              firstViolationIdx = i;
              break;
            }
          }

          const reportNode = group[firstViolationIdx];

          // Stable sort: null-named properties sink to the end.
          const sorted = [...group].sort((a, b) => {
            const na = getPropertyName(a);
            const nb = getPropertyName(b);
            if (na === null && nb === null) return 0;
            if (na === null) return 1;
            if (nb === null) return -1;
            return comparator(na, nb);
          });

          context.report({
            node: reportNode,
            loc:  reportNode.key.loc,
            messageId: "sort",
            fix(fixer) {
              // Replace each property's source text with the target sorted
              // property's source text.  The ranges don't overlap (each
              // property occupies a distinct slice of the source), so all
              // fixes are applied simultaneously to the original text.
              return group
                .map((original, i) => {
                  const target = sorted[i];
                  if (original === target) return null;
                  return fixer.replaceText(original, sourceCode.getText(target));
                })
                .filter(Boolean);
            },
          });
        }
      },
    };
  },
};

// ─── Plugin export ────────────────────────────────────────────────────────────

export default {
  meta: {
    name:    "eslint-plugin-simple-key-sort",
    version: "1.0.0",
  },
  rules: {
    sort: sortRule,
  },
};
