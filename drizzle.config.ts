import { defineConfig } from "drizzle-kit";

// Only configure Drizzle if DATABASE_URL is provided (for migration purposes)
if (process.env.DATABASE_URL) {
  export default defineConfig({
    out: "./migrations",
    schema: "./shared/schema.ts",
    dialect: "postgresql",
    dbCredentials: {
      url: process.env.DATABASE_URL,
    },
  });
} else {
  // Export empty config for Firebase
  export default defineConfig({
    out: "./migrations",
    schema: "./shared/schema.ts",
    dialect: "postgresql",
    dbCredentials: {
      url: "postgresql://dummy:dummy@localhost:5432/dummy",
    },
  });
}
