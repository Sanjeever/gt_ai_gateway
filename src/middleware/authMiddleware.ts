import { Context, MiddlewareHandler } from "hono";
import userService from "../service/userService";
import { UserType, ROOT_USER_ID, UserStatus } from "../constants";

const requireAdmin: MiddlewareHandler = async (c, next) => {
    const authHeader = c.req.header("Authorization");
    console.log(`AUTH_HEADER_RAW: ${JSON.stringify(authHeader)}`);

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        console.log(`AUTH_FAIL: header=${JSON.stringify(authHeader)}`);
        return c.json({ error: "Authorization header is missing or invalid" }, 401);
    }

    const token = authHeader.split(" ")[1];
    console.log(`AUTH DEBUG: req_token=${token.substring(0,8)}..., env_root_token=${(c.env.ROOT_TOKEN as string || '').substring(0,8)}..., match=${token === c.env.ROOT_TOKEN}`);
    const user = await userService.getUserByToken(token, c.env.ROOT_TOKEN);

    if (!user) {
        return c.json({ error: "Invalid token" }, 401);
    }

    if (user.status === UserStatus.DISABLED) {
        return c.json({ error: "User disabled" }, 403);
    }

    c.set("user_type", user.type);

    if (user.type !== UserType.ADMIN && user.type !== UserType.ROOT) {
        return c.json({ error: "Admin access required" }, 403);
    }

    await next();
};

export default { requireAdmin };