import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { fetchAdminBoundary } from "./admin-boundary.server";

export const getAdminBoundary = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({ state: z.string().min(1).max(80), lga: z.string().min(1).max(120).nullable() })
      .parse(data),
  )
  .handler(async ({ data }) => fetchAdminBoundary(data.state, data.lga));
