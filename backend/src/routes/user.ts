import { Hono } from "hono";
import { PrismaClient } from "@prisma/client/edge";
import { withAccelerate } from "@prisma/extension-accelerate";
import { sign } from "hono/jwt";
import { signinInput, signupInput } from "@pitifulhawk/medium-commons";

interface CustomContext {
  Bindings: { DATABASE_URL: string; JWT_SECRET: string };
  Variables: {
    userId: string;
    prisma: PrismaClient;
  };
}
// Define the type of the extended Prisma client
type ExtendedPrismaClient = PrismaClient & ReturnType<typeof withAccelerate>;

const createPrismaClient = (databaseUrl: string): ExtendedPrismaClient => {
  return new PrismaClient({
    datasourceUrl: databaseUrl,
  }).$extends(withAccelerate()) as unknown as ExtendedPrismaClient;
};

export const userRouter = new Hono<CustomContext>();

userRouter.use("*", async (c, next) => {
  const prisma = createPrismaClient(c.env.DATABASE_URL);

  c.set("prisma", prisma);

  await next();
});

userRouter.post("/signup", async (c) => {
  const prisma = c.get("prisma");

  const { email, name, password } = await c.req.json();

  const { success } = signupInput.safeParse({ email, name, password });

  if (!success) {
    c.status(411);
    return c.json({
      Error: "Input not correct",
    });
  }

  const userData = {
    email,
    name,
    password,
  };

  try {
    const user = await prisma.user.create({
      data: userData,
    });

    const jwt = await sign({ id: user.id }, c.env.JWT_SECRET);
    console.log("Generated JWT:", jwt);
    return c.json({ jwt });
  } catch (err) {
    c.status(403);
    return c.json({ error: "error while signup" });
  }
});

userRouter.post("/signin", async (c) => {
  const prisma = c.get("prisma");

  const { email, password } = await c.req.json();

  const { success } = signinInput.safeParse({ email, password });

  if (!success) {
    c.status(411);
    return c.json({
      Error: "input not correct",
    });
  }

  const user = await prisma.user.findUnique({
    where: {
      email,
    },
  });
  if (!user) {
    c.status(403);
    return c.json({ error: "user not found " });
  }
  if (user.password != password) {
    c.status(403);
    return c.json({ error: "password incorrect" });
  }

  const jwt = await sign({ id: user.id }, c.env.JWT_SECRET);
  console.log("Generated JWT:", jwt);
  return c.json({ jwt });
});
