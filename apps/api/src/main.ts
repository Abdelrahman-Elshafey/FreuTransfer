import { createApp } from "./app.ts";

const port = Number.parseInt(process.env.PORT ?? "3000", 10);

createApp().listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
