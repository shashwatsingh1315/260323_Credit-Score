sed -i -e '/if (res) {/i \
          return builder;' src/utils/engine.test.ts

# We need to add mockNeq and mockIs to the builder
sed -i -e '/select: vi.fn()/i \
        neq: vi.fn().mockImplementation((...args) => {\n          const res = mockNeq(...args);\n          if (res) return res;\n          return builder;\n        }),\n        is: vi.fn().mockImplementation((...args) => {\n          const res = mockIs(...args);\n          if (res) return res;\n          return builder;\n        }),' src/utils/engine.test.ts
