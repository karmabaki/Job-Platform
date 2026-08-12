export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is not set. Add it to apps/api/.env (see apps/api/.env.example).`,
    );
  }
  return value;
}
