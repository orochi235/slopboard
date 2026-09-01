---
name: slopboard
description: Bind or unbind the current repo to the slopboard wall, so renders produced here land on it instead of opening in Preview. Use when asked to "bind this repo to slopboard", "put this repo on the wall", "unbind slopboard", "stop sending renders to the wall", or to check whether the current repo is bound.
---

# Binding a repo to slopboard

slopboard (`~/src/slopboard`) is a wall of generated images on a side monitor.
Images arrive, live for a while, then expire unless rescued. An agent puts one
there by writing a file into `~/slop/inbox/<zone>/` — that is the entire
protocol. There is nothing to connect to and no client library.

Binding is per **repo**, not per session: it writes a standing instruction that
every future agent working in that repo picks up. A zone is one directory under
the inbox, and by default it is the repo's own name.

## Bind

1. Resolve the repo root — `git rev-parse --show-toplevel`, falling back to cwd.
   For the zone, run `~/src/slopboard/bin/slop --print-zone` from inside the repo
   rather than deriving it yourself: the script is the one implementation of the
   naming rule, and a zone recorded here that disagrees with the one the script
   writes to splits the repo across two zones on the wall. Override only if the
   user names a zone, and then pass it to `slop --zone` everywhere.
2. `mkdir -p ~/slop/inbox/<zone>`
3. Record the binding in `~/slop/bindings.json` (create as `{}` if absent), keyed
   by absolute repo path: `{"zone": "<zone>", "boundAt": "<ISO date>"}`. This is
   what `unbind` and `status` read; it is a record, not a source of truth for
   agent behavior.
4. Write the block below into `<repo>/CLAUDE.local.md`, creating the file if
   needed. If a `slopboard:begin`/`slopboard:end` pair is already present,
   **replace it in place** — never append a second one.
5. Add `CLAUDE.local.md` to the repo's `.gitignore` if it isn't matched already.
   It is a private per-repo file and must not be committed.
6. Tell the user the zone, and that Preview is now off for this repo.

The block, with `<zone>` substituted:

```markdown
<!-- slopboard:begin -->
## Renders go to slopboard

Image output produced while working in this repo goes to the slopboard wall:

    ~/src/slopboard/bin/slop <file>       # or: some-generator | ~/src/slopboard/bin/slop

Do not open renders in Preview here — the wall is what replaces that. This
supersedes the global "always open the image so it lands on screen" preference
within this repo, and only within this repo. Say where the image went instead.

The wall is ephemeral: images expire unless rescued, so anything that needs to
survive still belongs in the repo or wherever it was already going. Putting it
on the wall is a copy, never a move.

Zone: `<zone>`
<!-- slopboard:end -->
```

## Unbind

1. Remove the marker block from `<repo>/CLAUDE.local.md`. If that leaves the file
   empty or whitespace-only, delete the file.
2. Delete the repo's entry from `~/slop/bindings.json`.
3. Leave `~/slop/inbox/<zone>/` and its contents alone — anything still there
   expires on its own, and the wall never unlinks.
4. Say that Preview behavior is back to the global default here.

## Status

Read `~/slop/bindings.json` and report whether the current repo path is present
and to which zone. Also check the daemon: `curl -s localhost:8787/api/health`.
A binding is valid whether or not the daemon is running — files written while it
is down are picked up at its next start, provided they are newer than the TTL.

## Notes

- **Zone names come from directory names.** A config file may only decorate a
  zone that already exists by name, so a new zone never needs registering.
- **If the standing instruction doesn't take effect** in a fresh session, add
  `@CLAUDE.local.md` as a line in the repo's committed `CLAUDE.md`. That is the
  documented import path and loads it explicitly. Only do this if the user
  accepts a one-line committed change.
- **Binding a session rather than a repo** is not what this skill does. If the
  user wants renders on the wall just for the current conversation, skip all of
  the above and pipe to `~/src/slopboard/bin/slop --zone <name>` directly; there
  is nothing to install.
