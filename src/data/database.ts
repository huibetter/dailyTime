import Database from '@tauri-apps/plugin-sql';

export const DATABASE_PATH = 'sqlite:dailytime.db';

let databasePromise: Promise<Database> | null = null;

export function openDatabase(): Promise<Database> {
  databasePromise ??= Database.load(DATABASE_PATH);
  return databasePromise;
}

export async function closeDatabase(): Promise<void> {
  if (!databasePromise) return;
  const database = await databasePromise;
  await database.close();
  databasePromise = null;
}
