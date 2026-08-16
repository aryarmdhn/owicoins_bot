import { reactCommand } from "../lib/reactcmd.js";

const cmd = reactCommand("tickle");
export const data = cmd.data;
export const execute = cmd.execute;
