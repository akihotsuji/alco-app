import type { Auth } from "./auth.ts";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
};

export type AppEnv = {
  Bindings: Env;
  Variables: {
    auth: Auth;
    user: SessionUser;
  };
};
