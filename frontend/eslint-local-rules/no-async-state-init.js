/**
 * ESLint rule: no-async-state-init
 *
 * Prevents initializing useState with values derived from useMemo,
 * which causes the anti-pattern where async-loaded data doesn't
 * populate the state because useState only uses the initial value once.
 *
 * Invalid:
 *   const derived = useMemo(() => compute(data), [data]);
 *   const [state, setState] = useState(derived[0] ?? "");
 *
 * Valid:
 *   const [state, setState] = useState("");
 *   useEffect(() => {
 *     if (derived.length > 0) setState(derived[0]);
 *   }, [derived]);
 */

module.exports = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow initializing useState with useMemo-derived values",
      category: "Possible Errors",
      recommended: true,
    },
    messages: {
      noAsyncStateInit:
        "Do not initialize useState with a useMemo result. Use useEffect to sync state when the memo updates instead.",
    },
    schema: [],
  },

  create(context) {
    // Stack of scopes - each scope tracks its own useMemo variables
    const scopeStack = [];
    let currentScope = new Set();

    // Helper: Check if a node references a useMemo variable in current scope
    function referencesUseMemoVariable(node) {
      if (!node) return false;

      // Direct identifier reference
      if (node.type === "Identifier") {
        return currentScope.has(node.name);
      }

      // Member expression (e.g., foo[0], foo.bar)
      if (node.type === "MemberExpression") {
        return referencesUseMemoVariable(node.object);
      }

      // Logical expression (e.g., foo ?? "default")
      if (node.type === "LogicalExpression") {
        return (
          referencesUseMemoVariable(node.left) ||
          referencesUseMemoVariable(node.right)
        );
      }

      // Conditional expression (e.g., foo ? bar : baz)
      if (node.type === "ConditionalExpression") {
        return (
          referencesUseMemoVariable(node.test) ||
          referencesUseMemoVariable(node.consequent) ||
          referencesUseMemoVariable(node.alternate)
        );
      }

      // Binary expression (e.g., foo > 0)
      if (node.type === "BinaryExpression") {
        return (
          referencesUseMemoVariable(node.left) ||
          referencesUseMemoVariable(node.right)
        );
      }

      // Unary expression (e.g., !foo)
      if (node.type === "UnaryExpression") {
        return referencesUseMemoVariable(node.argument);
      }

      return false;
    }

    return {
      // Enter a function/component scope
      FunctionDeclaration() {
        scopeStack.push(currentScope);
        currentScope = new Set();
      },
      FunctionExpression() {
        scopeStack.push(currentScope);
        currentScope = new Set();
      },
      ArrowFunctionExpression() {
        scopeStack.push(currentScope);
        currentScope = new Set();
      },

      // Exit a function/component scope
      "FunctionDeclaration:exit"() {
        currentScope = scopeStack.pop() || new Set();
      },
      "FunctionExpression:exit"() {
        currentScope = scopeStack.pop() || new Set();
      },
      "ArrowFunctionExpression:exit"() {
        currentScope = scopeStack.pop() || new Set();
      },

      // Track variables assigned from useMemo
      VariableDeclarator(node) {
        // Check if this is: const foo = useMemo(...)
        if (
          node.init &&
          node.init.type === "CallExpression" &&
          node.init.callee.type === "Identifier" &&
          node.init.callee.name === "useMemo"
        ) {
          // Add the variable name(s) to current scope
          if (node.id.type === "Identifier") {
            currentScope.add(node.id.name);
          }
        }
      },

      // Check useState calls
      CallExpression(node) {
        // Only check useState calls
        if (
          node.callee.type !== "Identifier" ||
          node.callee.name !== "useState"
        ) {
          return;
        }

        // Check if the argument references a useMemo variable
        const [initValue] = node.arguments;
        if (initValue && referencesUseMemoVariable(initValue)) {
          context.report({
            node: initValue,
            messageId: "noAsyncStateInit",
          });
        }
      },
    };
  },
};
