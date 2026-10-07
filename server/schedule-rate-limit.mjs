import { ApiError, UUID_PATTERN } from "./schedule-service.mjs";

// Creation has a project-wide storage budget. Existing events have independent
// write budgets so traffic to one shared link cannot block another group's saves.
export function createScheduleRateLimit(store) {
  return async ({ request, pathname }) => {
    let key;
    let limit;
    if (request.method === "POST" && pathname === "/events") {
      key = "schedule:create";
      limit = 100;
    } else {
      const route =
        /^\/events\/([^/]+)\/participants(?:\/([^/]+)(?:\/(edit-access))?)?$/.exec(
          pathname
        );
      if (
        !route ||
        !UUID_PATTERN.test(route[1]) ||
        (route[2] && !UUID_PATTERN.test(route[2]))
      )
        return;
      const expectedMethod = !route[2] || route[3] ? "POST" : "PUT";
      if (request.method !== expectedMethod) return;
      // Do not create arbitrary limit buckets for nonexistent event identifiers.
      await store.read(route[1]);
      key = `schedule:mutate:${route[1].toLowerCase()}`;
      limit = 1000;
    }
    if (!(await store.consumeLimit(key, limit, 3600))) {
      throw new ApiError(
        429,
        key === "schedule:create"
          ? "The scheduling service has reached its hourly event limit. Please try again later."
          : "This schedule has reached its hourly save limit. Please try again later."
      );
    }
  };
}
