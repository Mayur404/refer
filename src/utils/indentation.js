const INDENT = "    ";

export function indentationEdit(value, start, end, outdent = false) {
  const firstLine = value.slice(0, start).lastIndexOf("\n") + 1;
  if (!outdent && start === end) {
    const spaces = INDENT.slice((start - firstLine) % INDENT.length);
    return {
      from: start,
      to: end,
      text: spaces,
      start: start + spaces.length,
      end: end + spaces.length,
    };
  }

  // A selection ending at the next line's start does not include that line.
  const lastPosition = end > start && value[end - 1] === "\n" ? end - 1 : end;
  const newline = value.indexOf("\n", lastPosition);
  const lastLine = newline === -1 ? value.length : newline;
  let offset = firstLine;
  let nextStart = start;
  let nextEnd = end;
  const text = value
    .slice(firstLine, lastLine)
    .split("\n")
    .map((line) => {
      const removed = outdent
        ? line.match(/^(?:\t| {1,4})/)?.[0].length || 0
        : 0;
      if (outdent) {
        nextStart -= Math.min(removed, Math.max(0, start - offset));
        nextEnd -= Math.min(removed, Math.max(0, end - offset));
      } else {
        if (start >= offset) nextStart += INDENT.length;
        if (end >= offset) nextEnd += INDENT.length;
      }
      offset += line.length + 1;
      return outdent ? line.slice(removed) : INDENT + line;
    })
    .join("\n");
  return {
    from: firstLine,
    to: lastLine,
    text,
    start: nextStart,
    end: nextEnd,
  };
}
