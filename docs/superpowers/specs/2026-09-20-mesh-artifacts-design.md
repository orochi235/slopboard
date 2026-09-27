# Mesh artifacts

Design for holding 3D models on the wall. For whoever implements it; assumes
`DESIGN.md` has been read and does not restate it.

The question it answers: the renderer is already three, so a mesh need not be
flattened to a picture at all — and this is the design that says it is anyway,
everywhere but the lightbox.

## What changes about the product

`transom post head.glb` works. The card is a rendered three-quarter view of the model
on a transparent background, wearing `⬡` where a video's `▶ 0:12` sits.
Opening it loads the real mesh and orbits it under the pointer.

## Decisions

**The card is a poster, not geometry.** The wall's quad pipeline — the LOD
tiers, the texture manager, the fade, the depth sort — assumes a picture, and
a card holding real geometry opts out of all of it at once. Poster it at
ingest and nothing downstream learns meshes exist, which is the rule a page
and a video already follow. `DESIGN.md`'s standing "does anything on the wall
have thickness?" question therefore stays open: this answers *not yet*, and
the lightbox is where the thickness went.

**The poster is rendered by the Chrome that already shoots pages,** pointed at
a viewer the daemon serves, rather than by a headless GL binding in node.
three is already a dependency and Chrome renders WebGL through SwiftShader
with no GPU, so this costs a route and an HTML file against a native module
that has to be built per platform.

**Held formats are `.glb` and `.stl`. `.gltf` is refused.** A `.gltf` is a
manifest that points at sibling `.bin` and texture files; `transom` copies one
file into the inbox, so it would arrive complete only by accident. `transom`
refuses it at the send and says to export a `.glb`, which is the same rule and
the same reason as the `.mkv` refusal.

**The shot is square and transparent.** 1024×1024, because the subject is an
object in space rather than a document, and `--default-background-color=
00000000` so the model floats on the card instead of sitting in a gray box.
The webp the picture pipeline writes keeps the alpha.

**Posed three-quarter from above, lit by the wall.** Fit from the mesh's
bounding sphere along a fixed direction that shows three faces — an elevation
reads as a picture of a drawing. Lighting is always ours: a hemisphere fill
and one key light. An `.stl` carries no material and gets a neutral matte one;
a `.glb`'s own materials are used as authored. That settles the first of
`DESIGN.md`'s two mesh questions — two models side by side are in the same
room.

**A blank render is a declined artifact.** A load failure inside the viewer
still leaves Chrome writing a perfectly good transparent PNG, and the card
would be an empty rectangle nobody can explain. So the poster is checked for
ink — alpha max of zero means nothing drew — and a mesh that renders to
nothing is declined like a video ffmpeg could not seek, with a warning naming
the file.

**The meta line reports the format and the file size, not a triangle count.**
That is the second `DESIGN.md` question, answered by dropping it: a count
means parsing the file a second time on the daemon, in a loader that wants a
DOM, and nobody sends a mesh to find out how many triangles it has. `bytes` is
a new `WallItem` field, set for a mesh only. The pixel size is *suppressed* for
a mesh: `w`×`h` is the poster's 1024×1024 and says nothing about the artifact.

**`MeshLightbox` is its own component,** for the reason `VideoLightbox` and
`PageLightbox` are: the image path's pan, zoom, drag and resize state means
nothing here, and a branch above those hooks would change the hook count when
the arrows page from a picture to a mesh on the same element. It drives three
directly rather than through `@react-three/fiber`: it is one scene with one
object, mounted and disposed with the modal.

**Nothing spins on its own.** Not on the wall, and not in the lightbox until
the pointer drags it. Same call as video, same reason: motion nobody asked for
is motion nobody is looking at.

**The viewer holds its own copy of the framing formula.** `shared/mesh.ts` owns
the constants and `distanceFor()`, the route inlines the constants into the
page, and the viewer computes the distance with the same one line. The
alternative is serving typescript to a browser, which costs a build step for
six lines; the price is that the two must be changed together, and
`mesh.test.ts` pins the formula so a change to it fails loudly.

## The pieces

**`server/kind.ts`** — `MESH_EXT = { .glb, .stl }`, `Kind` gains `'mesh'`,
`HELD_EXT` picks them up. `kind.test.ts` already holds `bin/transom` to `HELD_EXT`.

**`server/shoot.ts`** — `shootUrl(url, out, opts)` is the general case;
`shootPage` becomes a wrapper that converts a path to a `file://` URL and
passes the page viewport. `ShotOpts` gains `transparent`.

**`server/meshShot.ts`** — `shootMesh(source, out)`: shoots
`http://127.0.0.1:<port>/view/mesh?src=<path>` at the square viewport, then
`hasInk(out)` before reporting success.

**`server/meshview.ts`** — the `/view/mesh` HTML (constants inlined), the
`/view/mesh/file` route that serves one mesh from the inbox or the cache and
nothing else, and the `/view/three` static mount that backs the page's import
map.

**`server/meshview.client.js`** — the viewer: import map to three, load by
extension, fit, light, render once.

**`shared/mesh.ts`** — `MESH_VIEW` and `distanceFor(radius, fovDeg)`.

**`shared/protocol.ts`** — `kind?: 'page' | 'video' | 'mesh'`, `bytes?: number`.

**`server/ingest.ts`** — `bytes` for a mesh, from the source file's own size.

**`src/Lightbox.tsx`** — `MeshLightbox`, keyed by item id like the video.

**`src/lightbox-meta.ts`** — the file size for a mesh, and no pixel size.

**`src/backends/WebglBackend.tsx`** — the bottom-left badge stops meaning "one
moment of several" and means "there is more here than the wall draws": `▶` for
a video or an animation, `⬡` for a mesh.
