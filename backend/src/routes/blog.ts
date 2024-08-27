import { Hono } from "hono";
import { PrismaClient } from "@prisma/client/edge";
import { withAccelerate } from "@prisma/extension-accelerate";
import { verify } from "hono/jwt";
import { createBlogInput, updateBlogInput } from "@pitifulhawk/medium-commons";

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

export const blogRouter = new Hono<CustomContext>();

blogRouter.use("*", async (c, next) => {
  const prisma = createPrismaClient(c.env.DATABASE_URL);

  c.set("prisma", prisma);

  await next();
});

blogRouter.use("/*", async (c, next) => {
  const jwt = (await c.req.header("Authorization")) || "";

  if (!jwt) {
    c.status(401);
    return c.json({ Error: "unauthorized" });
  }

  const token = jwt.split(" ")[1];

  const payload = await verify(
    token,
    c.env.JWT_SECRET
  ); /* as unknow as string */
  if (!payload) {
    c.status(401);
    return c.json({ Error: "unauthorized" });
  }

  const userId = payload.id as string;

  c.set("userId", userId);
  await next();
});

blogRouter.post("/", async (c) => {
  const userId = c.get("userId");
  const prisma = c.get("prisma");
  try {
    const { title, content } = await c.req.json();
    const { success } = createBlogInput.safeParse({
      title,
      content,
    });
    if (!success) {
      c.status(411);
      return c.json({
        message: "incorrect input",
      });
    }
    const post = await prisma.post.create({
      data: {
        title,
        content,
        authorId: userId,
      },
    });
    return c.json({
      id: post.id,
    });
  } catch (e) {
    c.status(411);
    return c.json({
      Error: "something is wrong with post creation",
    });
  }
});

blogRouter.put("/", async (c) => {
  const userId = c.get("userId");
  const prisma = c.get("prisma");

  try {
    const { id, title, content } = await c.req.json();
    const { success } = updateBlogInput.safeParse({
      id,
      title,
      content,
    });
    if (!success) {
      c.status(411);
      return c.json({
        message: "incorrect input",
      });
    }

    prisma.post.update({
      where: {
        id,
        authorId: userId,
      },
      data: {
        title,
        content,
      },
    });

    return c.json({
      post: " update successful ",
    });
  } catch (e) {
    c.status(411);
    return c.json({
      Error: "post update unsuccessful",
    });
  }
});

blogRouter.get("/bulk", async (c) => {
  const prisma = c.get("prisma");

  try {
    const post = await prisma.post.findMany({
      select: {
        content: true,
        title: true,
        id: true,
        author: {
          select: {
            name: true,
          },
        },
      },
    });

    return c.json(post);
  } catch (e) {
    c.status(411);
    return c.json({
      Error: "can not find any post",
    });
  }
});

blogRouter.get("/:id", async (c) => {
  const prisma = c.get("prisma");
  const id = c.req.param("id");

  try {
    const post = await prisma.post.findUnique({
      where: {
        id,
      },
      select: {
        content: true,
        title: true,
        author: {
          select: {
            name: true,
          },
        },
      },
    });

    return c.json(post);
  } catch (e) {
    c.status(411);
    return c.json({
      Error: `can't find the post`,
    });
  }
});
