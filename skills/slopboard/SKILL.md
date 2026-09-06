---
name: slopboard
description: Take one repo off the slopboard wall and back to Preview, put it back on, or give it a zone name other than its directory name. The wall is the default everywhere, so use this only for an exception. Triggers on "stop sending renders to the wall here", "open images in Preview in this repo", "put this repo back on the wall", "use a different zone for this repo", or checking what the current repo does.
---

# Excepting a repo from the slopboard wall

slopboard (`~/src/slopboard`) is a wall of generated images on a side monitor.
Images arrive, live for a while, then expire unless rescued. An agent puts one
there by writing a file into `~/slop/inbox/<zone>/` — that is the entire
protocol. There is nothing to connect to and no client library.

**The wall is the default in every repo.** Each harness `CLAUDE.md`
(`~/.claude`, `~/.claude-msb`, `~/.claude-pw`) tells agents to send renders to
`~/src/slopboard/bin/slop` and not to open them in Preview, so a new repo is on
the wall the first time it renders, with nothing to install and nothing to
register. This skill exists only for the exceptions below.

**Zones register themselves.** `bin/slop` writes `~/slop/zones/<zone>.json`
recording which directory the renders came from, and the daemon reads that to
find the project's `.hued` and color the zone. It is written on every send, so
it is never something to maintain by hand.

## Put Preview back for one repo

1. Write the block below into `<repo>/CLAUDE.local.md`, creating the file if
   needed. If a `slopboard:begin`/`slopboard:end` pair is already there,
   **replace it in place** — never append a second one.
2. Add `CLAUDE.local.md` to the repo's `.gitignore` if it isn't matched already.
   It is a private per-repo file and must not be committed.
3. Say that renders here open in Preview again, and that every other repo is
   unaffected.

```markdown
<!-- slopboard:begin -->
## Renders open in Preview here, not on the wall

This repo is an exception to the global rule that image output goes to the
slopboard wall. Here, `open` the render so it lands on Mike's screen, the way
the preference read before slopboard became the default. Do not send images to
`~/src/slopboard/bin/slop` from this repo.

This applies to this repo and nowhere else.
<!-- slopboard:end -->
```

## Put the repo back on the wall

Remove the marker block from `<repo>/CLAUDE.local.md`. If that leaves the file
empty or whitespace-only, delete the file. The global default takes over again
immediately — there is nothing to re-register, and the zone reappears the next
time the repo renders. Say that Preview is off here again.

## Give a repo a different zone

Only when the user asks for a zone name that isn't the repo's directory name —
several checkouts that should pile onto one zone, say. Get the current name from
`~/src/slopboard/bin/slop --print-zone` run inside the repo rather than deriving
it: that script is the one implementation of the naming rule, and a name
recorded here that disagrees with the one it writes to splits the repo across
two zones on the wall, silently. Then write this block, same rules as above:

```markdown
<!-- slopboard:begin -->
## Renders go to the `<zone>` zone

Image output from this repo goes to the wall under a zone name that is not this
directory's name:

    ~/src/slopboard/bin/slop --zone <zone> <file>

Pass `--zone <zone>` on every send from this repo. Everything else about the
wall is the global default.
<!-- slopboard:end -->
```

## Status

Read `<repo>/CLAUDE.local.md` for a `slopboard:begin` block — its absence means
the repo is on the wall under `slop --print-zone`'s answer, which is the normal
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
  `~/src/slopboard/bin/slop --zone <name>` directly; there is nothing to install.
