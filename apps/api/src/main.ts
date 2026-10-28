import "reflect-metadata";
// Do not load account/source modules in data-only hosting: they create SQLite stores.
if (process.env.SPORTS_DATA_ONLY === "true") await import("./data-main.js");
else await import("./full-main.js");
