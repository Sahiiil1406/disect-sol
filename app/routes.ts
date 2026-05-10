import { type RouteConfig, index } from "@react-router/dev/routes";

// Use the welcome route as the index so the landing page is reachable
export default [index("routes/welcome.tsx")] satisfies RouteConfig;
