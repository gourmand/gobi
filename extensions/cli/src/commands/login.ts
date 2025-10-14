import chalk from "chalk";

import { login as workosLogin } from "../auth/workos.js";
import { gracefulExit } from "../util/exit.js";

import { chat } from "./chat.js";

export async function login() {
  console.info(chalk.yellow("Logging in to Gobi..."));

  try {
    await workosLogin();
    console.info(chalk.green("Successfully logged in!"));

    // Start the CLI session after successful login
    console.info(chalk.blue("Starting Gobi CLI..."));
    await chat();
  } catch (error: any) {
    console.error(chalk.red(`Login failed: ${error.message}`));
    await gracefulExit(1);
  }
}
