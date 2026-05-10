import type { Route } from "./+types/welcome";
import Welcome from "../welcome/welcome";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "sol-trace" },
    {
      name: "description",
      content:
        "sol-trace helps you inspect Solana RPC calls, decode instructions, and replay transactions.",
    },
  ];
}

export default function WelcomeRoute() {
  return <Welcome />;
}
