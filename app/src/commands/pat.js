import { reactCommand } from "../lib/reactcmd.js";

const cmd = reactCommand("pat");
export const data = cmd.data;
export const execute = cmd.execute;
