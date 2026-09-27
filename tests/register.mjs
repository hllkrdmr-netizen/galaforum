// Lets `node --test` run the TypeScript sources directly (Node >= 22.18 strips types natively)
// and resolves extension-less relative imports the way Metro/TypeScript do.
import { register } from 'node:module';

register('./resolve-ts.mjs', import.meta.url);
