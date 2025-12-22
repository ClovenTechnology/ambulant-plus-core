// codemods/positional-react-query-to-object.js
/**
 * jscodeshift transform
 * Usage:
 *   npx jscodeshift -t codemods/positional-react-query-to-object.js <paths...>
 */

export default function transformer(file, api) {
  const j = api.jscodeshift;
  const root = j(file.source);

  // helpers
  function buildObjectFromPositional(calleeName, args) {
    // args: array of AST nodes
    // returns an ObjectExpression
    if (calleeName === 'useMutation') {
      // useMutation(mutationFn, opts?)
      const mutationFn = args[0] || j.literal(null);
      const opts = args[1] || null;

      const props = [
        j.property('init', j.identifier('mutationFn'), mutationFn),
      ];
      if (opts) {
        if (opts.type === 'ObjectExpression') {
          // merge properties from opts into props
          for (const p of opts.properties) props.push(p);
        } else {
          // opts is identifier or other expr --> add spread: ...opts
          props.push(j.spreadElement(opts));
        }
      }
      return j.objectExpression(props);
    } else {
      // useQuery / useInfiniteQuery: (key, fn, opts?)
      const key = args[0] || j.literal(null);
      const fn = args[1] || j.literal(null);
      const opts = args[2] || null;

      const props = [
        j.property('init',
          j.identifier('queryKey'),
          key
        ),
        j.property('init',
          j.identifier('queryFn'),
          fn
        ),
      ];
      if (opts) {
        if (opts.type === 'ObjectExpression') {
          for (const p of opts.properties) props.push(p);
        } else {
          props.push(j.spreadElement(opts));
        }
      }
      return j.objectExpression(props);
    }
  }

  // Process CallExpressions with callee id of interest
  root.find(j.CallExpression)
    .forEach(path => {
      const callee = path.node.callee;
      if (!callee) return;
      let name = null;
      // handle both identifier and member expressions (rare)
      if (callee.type === 'Identifier') name = callee.name;
      else if (callee.type === 'MemberExpression' && callee.property && callee.property.type === 'Identifier') {
        name = callee.property.name;
      }

      if (!name) return;
      const target = ['useQuery', 'useInfiniteQuery', 'useMutation'];
      if (!target.includes(name)) return;

      const args = path.node.arguments || [];
      // If already object form (single object arg), skip
      if (args.length === 1 && args[0] && args[0].type === 'ObjectExpression') return;

      // Build new single-arg object
      const newObj = buildObjectFromPositional(name, args);
      path.node.arguments = [newObj];
    });

  return root.toSource({ quote: 'single' });
}
