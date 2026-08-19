import { generateText, hasToolCall, stepCountIs, streamText, tool, type ToolSet } from "ai";
import { z } from "zod";
import type { ResolvedModel } from "./model";
import type { InvestigationEmitter } from "./events";

// The one agent loop every role runs on. An agent is: a system prompt, a
// task prompt, a set of read-only investigation tools, and a required
// `submit_report` tool whose schema enforces the role's output shape. The
// loop streams, emitting reasoning/tool events in true order, and ends when
// the agent submits (or hits the step budget).

const MAX_STEPS = 10;

export class AgentDidNotSubmitError extends Error {
  constructor(role: string) {
    super(`${role} agent hit the step budget without submitting a report`);
  }
}

export async function runAgentLoop<S extends z.ZodType>(opts: {
  runId: string;
  role: string;
  system: string;
  prompt: string;
  tools: ToolSet;
  reportSchema: S;
  resolved: ResolvedModel;
  emitter: InvestigationEmitter;
}): Promise<z.infer<S>> {
  const { runId, role, emitter } = opts;
  let submitted: z.infer<S> | undefined;

  const submitReport = tool({
    description:
      "Submit your final report. Call this exactly once, when your investigation is complete. This ends your run.",
    inputSchema: opts.reportSchema,
    execute: async (report) => {
      submitted = report as z.infer<S>;
      return { recorded: true };
    },
  });

  const result = streamText({
    model: opts.resolved.model,
    system: opts.system,
    prompt: opts.prompt,
    tools: { ...opts.tools, submit_report: submitReport },
    stopWhen: [stepCountIs(MAX_STEPS), hasToolCall("submit_report")],
  });

  let textBuffer = "";
  for await (const part of result.fullStream) {
    switch (part.type) {
      case "text-delta":
        textBuffer += part.text;
        break;
      case "text-end":
        if (textBuffer.trim()) {
          await emitter.emit({ type: "step", runId, stepType: "reasoning", payload: { text: textBuffer.trim() } });
        }
        textBuffer = "";
        break;
      case "tool-call":
        await emitter.emit({
          type: "step",
          runId,
          stepType: "tool_call",
          payload: { tool: part.toolName, input: part.input },
        });
        break;
      case "tool-result":
        if (part.toolName !== "submit_report") {
          await emitter.emit({
            type: "step",
            runId,
            stepType: "tool_result",
            payload: { tool: part.toolName, output: part.output },
          });
        }
        break;
      case "error":
        throw part.error instanceof Error ? part.error : new Error(String(part.error));
    }
  }

  // An agent can burn its step budget investigating without ever calling
  // submit_report. Rather than failing the run, force one final call that can
  // only submit, based on the evidence it already gathered.
  if (!submitted) {
    await emitter.emit({
      type: "step",
      runId,
      stepType: "reasoning",
      payload: { text: "(step budget reached — forcing report submission from gathered evidence)" },
    });
    const { messages } = await result.response;
    await generateText({
      model: opts.resolved.model,
      system: opts.system,
      messages: [
        { role: "user", content: opts.prompt },
        ...messages,
        {
          role: "user",
          content:
            "You have hit your step budget. Call submit_report now with your best conclusions from the evidence you already gathered. If the evidence is insufficient, submit with an appropriately low confidence or an 'inconclusive' verdict rather than guessing.",
        },
      ],
      tools: { submit_report: submitReport },
      toolChoice: { type: "tool", toolName: "submit_report" },
    });
  }

  if (!submitted) throw new AgentDidNotSubmitError(role);
  return submitted;
}
