/* eslint-env node */
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { ApiError, UUID_PATTERN } from "./schedule-service.mjs";
const queues = new Map();
// All middleware instances in this process share a queue for each storage directory.
function serialize(directory, operation) {
  const previous = queues.get(directory) || Promise.resolve();
  const result = previous.then(operation);
  const settled = result.catch(() => {});
  queues.set(directory, settled);
  settled.then(() => {
    if (queues.get(directory) === settled) queues.delete(directory);
  });
  return result;
}

async function readEvent(directory, id) {
  if (!UUID_PATTERN.test(id))
    throw new ApiError(404, "This schedule could not be found.");
  try {
    return JSON.parse(await readFile(join(directory, `${id}.json`), "utf8"));
  } catch (error) {
    if (error.code === "ENOENT")
      throw new ApiError(404, "This schedule could not be found.");
    throw error;
  }
}

async function saveEvent(directory, event) {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const destination = join(directory, `${event.id}.json`);
  const temporary = `${destination}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, JSON.stringify(event), {
      mode: 0o600,
      flag: "wx",
    });
    await rename(temporary, destination);
  } finally {
    await rm(temporary, { force: true });
  }
}

export function createFileStore(dataDir) {
  const directory = resolve(dataDir);
  return {
    create: (event) => serialize(directory, () => saveEvent(directory, event)),
    read: (id) => serialize(directory, () => readEvent(directory, id)),
    mutate: (id, operation) =>
      serialize(directory, async () => {
        const event = await readEvent(directory, id);
        const result = operation(event);
        await saveEvent(directory, event);
        return result;
      }),
  };
}
