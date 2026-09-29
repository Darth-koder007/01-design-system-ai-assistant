#!/usr/bin/env node
import { Command } from "commander";
import { checkFiles, formatText } from "./check.js";
import { buildComponentRegistry } from "./component-registry.js";
import { createLlmClient } from "./llm/create-client.js";

const program = new Command();

program.name("assistant").description("Design-system compliance checker");

program
  .command("check")
  .argument("<paths...>", "file paths to analyze")
  .option("--format <format>", "output format: text or json", "text")
  .action(async (paths: string[], options: { format: string }) => {
    const componentRegistry = buildComponentRegistry();
    const llmClient = createLlmClient();
    const results = await checkFiles(paths, componentRegistry, llmClient);

    if (options.format === "json") {
      console.log(JSON.stringify(results, null, 2));
    } else {
      console.log(formatText(results));
    }

    process.exitCode = results.some((r) => r.severity === "error") ? 1 : 0;
  });

program.parse();
