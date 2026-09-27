---
name: transom
description: Wire transom into a Claude account or machine so renders reach the wall, diagnose why they are not, or make one repo an exception - back to Preview, or onto a zone that is not its directory name. Triggers on "install transom", "set up the wall on this account", "renders aren't reaching the wall", "agents keep writing images to /tmp", "stop sending renders to the wall here", "open images in Preview in this repo", "use a different zone for this repo", or checking what the current repo does.
---

# Wiring transom to agents, and excepting a repo from it

transom (`~/src/transom`) is a wall of generated images on a side monitor.
Images arrive, live for a while, then expire unless rescued. An agent puts one
there by writing a file into `~/transom/inbox/<zone>/` — that is the entire
protocol. There is nothing to connect to and no client library.

**Per repo there is nothing to install.** Once an account is wired, a new repo
is on the wall the first time it renders: no registration, no config file. The
first section below wires an account; the rest are the per-repo exceptions.

**Zones register themselves.** `bin/transom` writes `~/transom/zones/<zone>.json`
recording which directory the renders came from, and the daemon reads that to
find the project's `.hued` and color the zone. It is written on every send, so
it is never something to maintain by hand.

## Install on a new account or machine

Run `~/src/transom/bin/transom wire`. It is idempotent — re-run it after any change
here rather than reasoning about what is already in place. It reports each
config directory as it goes, and puts three things in front of agents:

- **The skill**, symlinked into every `~/.claude*/skills/`.
- **The wall-nudge hook** (`hooks/wall-nudge.mjs`), registered as a
  `PostToolUse` entry tagged `transom` in each `settings.json`. It fires when
  an agent reads or creates an image that never reached the wall, and exits 2
  with a one-line correction, which Claude Code feeds back to the model.
- **`transom` on PATH**, symlinked into `~/.local/bin`. Without this, an agent that
  half-remembers the rule types `transom post chart.png`, gets `command not found`, and
  falls back to reporting a path.

`transom wire` also checks that some `CLAUDE.md` carries the rule and prints the bullet
if none does. It does not write it: that file is hand-authored prose, and a tool
that rewrites preferences fights their author. Add it by hand.

**Running sessions keep their hook snapshot.** Only sessions started after
`transom wire` pick the hook up — don't conclude from a live session that it failed.

`transom wire --dry` says what would change; `transom wire --off` removes all three.

## When renders still aren't reaching the wall

In order, because each step rules out the one below:

1. `transom zone` in the repo. `command not found` means `transom wire` never ran
   here, or `~/.local/bin` is not on this shell's PATH.
2. Is the repo excepted? See **Status** below — a Preview block silences both
   the rule and the hook.
3. Was the session started before `transom wire`? Its hooks are a snapshot.
4. `curl -s localhost:8787/api/health`. A down daemon is *not* the cause: files
   written while it is down are picked up at its next start, provided they are
   newer than the TTL. Renders that never got sent are the cause.

## Put Preview back for one repo

1. Write the block below into `<repo>/CLAUDE.local.md`, creating the file if
   needed. If a `transom:begin`/`transom:end` pair is already there,
   **replace it in place** — never append a second one.
2. Add `CLAUDE.local.md` to the repo's `.gitignore` if it isn't matched already.
   It is a private per-repo file and must not be committed.
3. Say that renders here open in Preview again, and that every other repo is
   unaffected.

```markdown
<!-- transom:begin -->
## Renders open in Preview here, not on the wall

This repo is an exception to the global rule that image output goes to the
transom wall. Here, `open` the render so it lands on Mike's screen, the way
the preference read before transom became the default. Do not send images to
`~/src/transom/bin/transom` from this repo.

This applies to this repo and nowhere else.
<!-- transom:end -->
```

## Put the repo back on the wall

Remove the marker block from `<repo>/CLAUDE.local.md`. If that leaves the file
empty or whitespace-only, delete the file. The global default takes over again
immediately — there is nothing to re-register, and the zone reappears the next
time the repo renders. Say that Preview is off here again.

## Give a repo a different zone

Only when the user asks for a zone name that isn't the repo's directory name —
several checkouts that should pile onto one zone, say. Get the current name from
`~/src/transom/bin/transom zone` run inside the repo rather than deriving
it: that script is the one implementation of the naming rule, and a name
recorded here that disagrees with the one it writes to splits the repo across
two zones on the wall, silently. Then write this block, same rules as above:

```markdown
<!-- transom:begin -->
## Renders go to the `<zone>` zone

Image output from this repo goes to the wall under a zone name that is not this
directory's name:

    ~/src/transom/bin/transom post --zone <zone> <file>

Pass `--zone <zone>` on every send from this repo. Everything else about the
wall is the global default.
<!-- transom:end -->
```

## Status

Read `<repo>/CLAUDE.local.md` for a `transom:begin` block — its absence means
the repo is on the wall under `transom zone`'s answer, which is the normal
case. Then check the daemon: `curl -s localhost:8787/api/health`. The default
holds whether or not the daemon is running; files written while it is down are
picked up at its next start, provided they are newer than the TTL.

## Notes

- **Zone names come from directory names.** A config file may only decorate a
  zone that already exists by name, so a new zone never needs registering.
- **If a block doesn't take effect** in a fresh session, add `@CLAUDE.local.md`
  as a line in the repo's committed `CLAUDE.md`. That is the documented import
  path and loads it explicitly. Only do this if the user accepts a one-line
  committed change.
- **For one conversation only**, skip all of the above and pipe to
  `~/src/transom/bin/transom post --zone <name>` directly; there is nothing to install.
- **The hook is a backstop, not the rule.** It fires after an image has already
  been missed. The `CLAUDE.md` bullet is what gets it right the first time, so a
  missing rule is worth fixing even with the hook in place.
