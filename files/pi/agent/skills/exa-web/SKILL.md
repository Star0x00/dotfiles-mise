---
name: exa-web
description: Call the Exa MCP web search and page fetch tools from a codemode script. Use whenever searching the web or reading URLs via exa, to avoid the common argument and result-shape mistakes.
---

# Calling Exa MCP from codemode

The exa MCP server exposes exactly two tools. Both are callable only from a `codemode` script, never directly:

- `tools.mcp__exa__web_search_exa(args)`
- `tools.mcp__exa__web_fetch_exa(args)`

Use the exact names. A wrong name throws `TypeError: tools.mcp__exa__web_search does not exist`.

## Canonical prelude

Put this at the top of any script that searches or fetches. It fixes argument validation and the result shape in one place.

```js
const exaSearch = (query, objective, numResults = 8) =>
  tools.mcp__exa__web_search_exa({ query, objective, numResults });

const exaFetch = (urls, maxCharacters = 12000) =>
  tools.mcp__exa__web_fetch_exa({ urls: [].concat(urls), maxCharacters });

// Both tools resolve to a CallToolResult { content: [{ type: "text", text }] }.
const exaText = (r) => {
  if (!r || r.isError) throw new Error(JSON.stringify(r?.content ?? r));
  return (r.content ?? []).filter((c) => c.type === "text").map((c) => c.text).join("\n");
};
```

Then:

```js
const r = await exaSearch(
  "blog post comparing React and Vue performance",
  "rank hands-on benchmark posts first; pull concrete frame-time numbers",
);
return exaText(r);
```

## Required arguments

`web_search_exa`:

| arg | required | notes |
|---|---|---|
| `query` | yes | Semantically rich description of the ideal page, not keywords. May include `category:people` or `category:company`. |
| `objective` | yes | Required even though it looks optional. Omitting it fails with `must have required properties objective`. State which docs should rank first, what to exclude, and which facts to pull. |
| `numResults` | no | Default 10. Lower it to keep the script output small. |

`web_fetch_exa`:

| arg | required | notes |
|---|---|---|
| `urls` | yes | Must be a **string array**. Passing a bare string fails with `urls: must be array`. |
| `maxCharacters` | no | Default 3000, which truncates long pages. Set 8000–20000 for full content. |

Always pass an argument object. Never pass positional args.

## Result shape

MCP tools resolve to a `CallToolResult`, not to text:

```js
{ content: [{ type: "text", text: "Title: ...\nURL: ...\nHighlights:\n..." }] }
```

- These two tools return no `structuredContent`; read `content`.
- `content` may hold several blocks. Filter by `type === "text"` and join, as in `exaText`.
- Never `text(r)` or `return r` — that dumps the object instead of the readable content.
- Check `r.isError`. A search or fetch can return `isError: true` with an error message in `content`.
- Validation failures (missing `objective`, non-array `urls`, unknown tool name) **reject** the promise and throw, unlike `isError` results. `exaText` rethrows on `isError`; wrap in try/catch or `Promise.allSettled` when one bad call must not kill the batch.

## Batching

Search and fetch are independent calls; run them in parallel and keep partial results.

```js
const queries = [
  ["exa api rate limits documentation", "find the official limits page"],
  ["exa contents endpoint parameters", "find the parameter reference"],
];
const settled = await Promise.allSettled(
  queries.map(([query, objective]) => exaSearch(query, objective)),
);
for (const s of settled) {
  if (s.status === "fulfilled") text(exaText(s.value));
  else text("search failed: " + s.reason.message);
}
```

For full page reads, batch URLs in one `web_fetch_exa` call rather than looping.

## Workflow

1. Search with `web_search_exa`; the returned `Highlights` are often enough.
2. If highlights are thin or you need the whole page, call `web_fetch_exa` on the best URLs from step 1.
3. Return only the text you need. Filter in the script before it reaches the model; do not dump every result.