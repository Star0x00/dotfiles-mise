---
name: zmx-jobs
description: Run long shell jobs (builds, test suites, full-repo scans, dev servers) detached in zmx PTY sessions so they don't block the turn, then collect exit code and output afterwards. Use when a command may run longer than ~30s or should outlive the current turn. Do NOT use zmx for short queries — parallelize those with codemode Promise.allSettled over tools.bash.
---

# zmx background jobs

`zmx` keeps terminal sessions alive in a daemon. `zmx run <name> -d <cmd...>` returns immediately (~11 ms measured); the job keeps running independent of the pi process.

There is **no push notification** back into pi. Results are pulled: exit code from `zmx wait` / `zmx ls`, output from a file you redirect to.

## Decide first

- Several short queries/searches → `codemode` with `Promise.allSettled` over `tools.bash`. Measured: 3 rg over the same tree, 448 ms serial → 46 ms parallel.
- One long job (>~30 s) or a job that must survive the turn → zmx.
- Never zmx-parallelize short scans: `zmx wait` polling overhead (~1 s) exceeds the scan cost.

## Launch (output always goes to a file)

Write a script, then run it detached — this is the only reliable retrieval path:

```bash
cat > /tmp/job.sh <<'EOF'
#!/bin/bash
exec > >(tee -a /tmp/job.log) 2>&1
set -x   # optional: trace into the log
make -j8
EOF
zmx run build -d bash /tmp/job.sh
```

Argument rules (verified): every argv is passed to the session shell as its own quoted word, so compound commands must be wrapped in `bash -c` as **separate** args, not hand-quoted:

- OK: `zmx run j -d bash /tmp/job.sh`, `zmx run j -d bash -c sleep 5 ; echo done` (semicolons land inside the -c arg because the local shell splits args)
- FAILS: `zmx run j 'echo hi; pwd'` → `bash: command not found: echo hi; pwd`

One session per concurrent job; commands inside a single session run sequentially (`zmx help`, Run section).

## Collect results

Output — read the file, never the PTY scrollback:

```bash
tail -40 /tmp/job.log
```

Exit code — `zmx wait` blocks until the task finishes and **exits with the task's own exit code**:

```bash
zmx wait build          # prints "completed task=build exit_code=0"; rc=0
zmx wait build || echo "failed with $?"     # rc mirrors the job
```

Status without blocking — `zmx ls` shows `ended=<ts>` and `exit_code=<n>` once the task is done:

```bash
zmx ls | grep build
```

`zmx history <name>` / `zmx history --screen <name>` is unreliable for headless (`clients=0`) sessions — observed `error: session "<name>" is unresponsive (SessionUnresponsive)` and ANSI/powerline prompt noise in the output. Do not parse it; the log file is deterministic.

`zmx wait` is effectively one-shot: once it consumed the completion the session may be gone (`task unreachable: <name> (ConnectionRefused)`), so always capture output to a file rather than fetching it after the wait.

## Hygiene

- `zmx ls` to inspect, `zmx kill <name>... --force` to reap.
- Name sessions after the job (`build`, `test-e2e`), never `s1`/`s2`.
- Check the exit code before trusting the log content.
