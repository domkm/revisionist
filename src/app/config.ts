import { Data, Effect } from "effect";

export class ConfigurationError
  extends Data.TaggedError("ConfigurationError")<{ message: string; }>
{}

export interface Configuration {
  readonly port: number;
  readonly webOnly: boolean;
}

export const readConfiguration = (args: readonly string[]) =>
  Effect.try({
    try: (): Configuration => {
      let port = 0;
      let webOnly = false;
      for (let i = 0; i < args.length; i++) {
        const argument = args[i]!;
        if (argument === "--web-only") {
          webOnly = true;
          continue;
        }
        const separator = argument.indexOf("=");
        const key = separator < 0 ? argument : argument.slice(0, separator);
        const inline = separator < 0 ? undefined : argument.slice(separator + 1);
        if (key !== "--port" && key !== "--host") throw new Error(`Unknown option: ${argument}`);
        const value = inline ?? args[++i];
        if (key === "--host") {
          if (value !== "127.0.0.1") {
            throw new Error("Only --host 127.0.0.1 is supported (local-only).");
          }
        } else {
          if (value === undefined || !/^\d+$/.test(value) || Number(value) > 65535) {
            throw new Error("--port must be an integer from 0 to 65535.");
          }
          port = Number(value);
        }
      }
      return { port, webOnly };
    },
    catch: (error) => new ConfigurationError({ message: String(error) }),
  });
