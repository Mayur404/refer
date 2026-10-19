import { requestJson } from "./http.js";
import { EDITOR_LIMITS } from "../../shared/limits.js";

const OUTPUT_LIMIT = EDITOR_LIMITS.output;
let compilers;
let compilersExpire = 0;

export async function runRemote(language, code, input, signal) {
  const specifications = {
    cpp: { language: "C++", pattern: /^gcc-\d/ },
    python: { language: "Python", pattern: /^cpython-3\./ },
    java: { language: "Java", pattern: /^openjdk-jdk-\d/ },
  };
  const specification = Object.hasOwn(specifications, language)
    ? specifications[language]
    : null;
  if (!specification)
    throw new Error("Choose Java, C++, or Python before running.");
  if (typeof code !== "string" || !code.trim())
    throw new Error("Write some code before running.");
  if (code.length > EDITOR_LIMITS.code)
    throw new Error(
      `Keep source code below ${EDITOR_LIMITS.code.toLocaleString()} characters.`,
    );
  if (typeof input !== "string" || input.length > EDITOR_LIMITS.input)
    throw new Error(
      `Keep standard input below ${EDITOR_LIMITS.input.toLocaleString()} characters.`,
    );
  if (!compilers || Date.now() >= compilersExpire) {
    const result = await requestJson("https://wandbox.org/api/list.json", {
      signal,
    });
    if (
      !Array.isArray(result) ||
      !result.some(
        (item) =>
          typeof item?.name === "string" && typeof item.language === "string",
      )
    )
      throw new Error(
        "The compiler service returned an invalid language list.",
      );
    compilers = result;
    compilersExpire = Date.now() + 5 * 60 * 1000;
  }
  // Prefer released runtimes: provider "head" builds can be experimental or broken.
  const compiler = compilers.find(
    (item) =>
      typeof item?.name === "string" &&
      item.language === specification.language &&
      specification.pattern.test(item.name),
  );
  if (!compiler) {
    compilers = null;
    throw new Error(
      "This language is not currently available from the execution service. Please try another language or try again later.",
    );
  }
  const result = await requestJson(
    "https://wandbox.org/api/compile.json",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal,
      body: JSON.stringify({
        compiler: compiler.name,
        code,
        stdin: input,
        save: false,
      }),
    },
    30000,
  );
  if (
    !result ||
    Array.isArray(result) ||
    !(
      (typeof result.status === "string" && /^\d+$/.test(result.status)) ||
      (Number.isInteger(result.status) && result.status >= 0) ||
      (typeof result.signal === "string" && result.signal.trim())
    ) ||
    [
      "compiler_error",
      "compiler_message",
      "program_output",
      "program_error",
    ].some((key) => result[key] != null && typeof result[key] !== "string") ||
    (result.signal != null && typeof result.signal !== "string")
  )
    throw new Error("The compiler service returned an incomplete result.");
  const output = [
    result.compiler_error,
    result.compiler_message && !result.compiler_error
      ? result.compiler_message
      : "",
    result.program_output,
    result.program_error,
    result.signal ? `Execution terminated: ${result.signal}` : "",
    String(result.status) !== "0" && result.status !== undefined
      ? `Exit status: ${result.status}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
  const truncated = "\n[Output truncated at 30,000 characters.]";
  return {
    output:
      output.length > OUTPUT_LIMIT
        ? output.slice(0, OUTPUT_LIMIT - truncated.length) + truncated
        : output,
    success: String(result.status) === "0" && !result.signal,
    compiler: compiler.name,
  };
}
