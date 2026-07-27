import { vi } from 'vitest';

/**
 * supabase-js exposes a chainable builder that only resolves when awaited.
 * This proxy records the chain and hands it to a per-table handler, so route
 * tests can assert on real query shape without a live database.
 */
function createQuery(table, resolve, calls) {
  const chain = { table, ops: [] };

  const record = (name) => (...args) => {
    chain.ops.push({ name, args });
    return builder;
  };

  const builder = {
    select: record('select'),
    insert: record('insert'),
    upsert: record('upsert'),
    update: record('update'),
    delete: record('delete'),
    eq: record('eq'),
    in: record('in'),
    order: record('order'),
    limit: record('limit'),
    single: record('single'),
    maybeSingle: record('maybeSingle'),
    then(onFulfilled, onRejected) {
      calls.push(chain);
      return Promise.resolve(resolve(chain)).then(onFulfilled, onRejected);
    },
  };

  return builder;
}

const opArg = (chain, name, index = 0) =>
  chain.ops.find((op) => op.name === name)?.args[index];

export const chainHelpers = {
  values: (chain) => opArg(chain, 'insert') ?? opArg(chain, 'upsert') ?? opArg(chain, 'update'),
  conflictTarget: (chain) => opArg(chain, 'upsert', 1)?.onConflict,
  filters: (chain) =>
    Object.fromEntries(
      chain.ops.filter((op) => op.name === 'eq').map((op) => [op.args[0], op.args[1]])
    ),
  usedOp: (chain, name) => chain.ops.some((op) => op.name === name),
};

/**
 * @param handlers map of table name -> (chain) => ({ data, error, count })
 */
export function createSupabaseMock(handlers) {
  const calls = [];

  const client = {
    from: vi.fn((table) =>
      createQuery(
        table,
        (chain) => {
          const handler = handlers[table];
          if (!handler) {
            throw new Error(`No mock handler for table "${table}"`);
          }
          const result = typeof handler === 'function' ? handler(chain) : handler;
          return { data: null, error: null, ...result };
        },
        calls
      )
    ),
  };

  return { client, calls };
}
