/**
 * Tests for no-async-state-init ESLint rule
 */

const { RuleTester } = require("eslint");
const rule = require("./no-async-state-init");

const ruleTester = new RuleTester({
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: "module",
    ecmaFeatures: {
      jsx: true,
    },
  },
});

ruleTester.run("no-async-state-init", rule, {
  valid: [
    // Direct literal
    {
      code: `
        function Component() {
          const [state, setState] = useState(0);
        }
      `,
    },

    // Prop value
    {
      code: `
        function Component(props) {
          const [state, setState] = useState(props.value);
        }
      `,
    },

    // Lazy initializer without useMemo reference
    {
      code: `
        function Component() {
          const [state, setState] = useState(() => expensive());
        }
      `,
    },

    // useMemo result used outside useState
    {
      code: `
        function Component() {
          const derived = useMemo(() => compute(data), [data]);
          return <div>{derived}</div>;
        }
      `,
    },

    // useMemo result used in useEffect (correct pattern)
    {
      code: `
        function Component() {
          const derived = useMemo(() => compute(data), [data]);
          const [state, setState] = useState("");
          useEffect(() => {
            if (derived.length > 0) setState(derived[0]);
          }, [derived]);
        }
      `,
    },

    // Different variable name (not from useMemo)
    {
      code: `
        function Component() {
          const sources = ["a", "b"];
          const [state, setState] = useState(sources[0]);
        }
      `,
    },
  ],

  invalid: [
    // Direct useMemo result
    {
      code: `
        function Component() {
          const derived = useMemo(() => compute(data), [data]);
          const [state, setState] = useState(derived);
        }
      `,
      errors: [
        {
          messageId: "noAsyncStateInit",
        },
      ],
    },

    // useMemo result with member access
    {
      code: `
        function Component() {
          const availableSources = useMemo(() => getSources(data), [data]);
          const [source, setSource] = useState(availableSources[0]);
        }
      `,
      errors: [
        {
          messageId: "noAsyncStateInit",
        },
      ],
    },

    // useMemo result with nullish coalescing
    {
      code: `
        function Component() {
          const availableSources = useMemo(() => getSources(data), [data]);
          const [source, setSource] = useState(availableSources[0] ?? "");
        }
      `,
      errors: [
        {
          messageId: "noAsyncStateInit",
        },
      ],
    },

    // useMemo result with conditional
    {
      code: `
        function Component() {
          const items = useMemo(() => getItems(data), [data]);
          const [state, setState] = useState(items.length > 0 ? items[0] : "");
        }
      `,
      errors: [
        {
          messageId: "noAsyncStateInit",
        },
      ],
    },

    // useMemo result with OR operator
    {
      code: `
        function Component() {
          const sources = useMemo(() => compute(data), [data]);
          const [value, setValue] = useState(sources[0] || "default");
        }
      `,
      errors: [
        {
          messageId: "noAsyncStateInit",
        },
      ],
    },

    // Multiple useMemo variables
    {
      code: `
        function Component() {
          const foo = useMemo(() => a, [a]);
          const bar = useMemo(() => b, [b]);
          const [x, setX] = useState(foo);
          const [y, setY] = useState(bar[0]);
        }
      `,
      errors: [
        {
          messageId: "noAsyncStateInit",
        },
        {
          messageId: "noAsyncStateInit",
        },
      ],
    },
  ],
});

console.log("All tests passed!");
