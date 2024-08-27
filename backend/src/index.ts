import { Hono } from "hono";
import { userRouter } from "./routes/user";
import { blogRouter } from "./routes/blog";
import { cors } from 'hono/cors'

// interface JWTPayload {
//   id: string;
// }

const app = new Hono();

app.use('*', cors())
app.route('/api/v1/user', userRouter)
app.route('/api/v1/blog', blogRouter)

app.notFound((c) => {
  console.log("404 Not Found");
  return c.text("404 Not Found", 404);
});

export default app;
