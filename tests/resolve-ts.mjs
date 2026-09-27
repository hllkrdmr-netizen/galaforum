export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    if (specifier.startsWith('.') && !/\.[cm]?[jt]sx?$/.test(specifier)) {
      for (const ext of ['.ts', '/index.ts']) {
        try {
          return await nextResolve(specifier + ext, context);
        } catch {
          // try next candidate
        }
      }
    }
    throw error;
  }
}
