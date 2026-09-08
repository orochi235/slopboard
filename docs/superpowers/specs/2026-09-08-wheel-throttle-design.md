# Throttling the wheel

For whoever wonders later why the rail is shaped this way. It says why one
scroll used to carry you from the top-level view to full magnification inside
an image, and what replaced the cooldown that was supposed to stop it.

## The hole

Two wheel mechanisms sat end to end and neither one ended the gesture.

`createGestureRail` charged 60px per rung and then held a 320ms dead time that
zeroed charge. The dead time did not outlive a momentum tail. Once it lapsed,
a still-decaying flick re-accumulated 60px within a couple of frames and fired
again, so a hard throw was good for several more rungs at 320ms apart. Any
fixed duration loses this race — the tail is longer than a number anyone would
pick for the pause between two deliberate pushes.

The lightbox had no rail at all. `ImageLightbox` called `zoomByWheel` on every
event it received, and started receiving them as soon as the port took focus on
image load. Around 1800px of travel crosses fit to `MAX_SCALE`, which is inside
one flick.

## The rule

**A gesture buys one transition.** Crossing a level spends it, and nothing more
happens until the wheel stream goes quiet and the hand pushes again.

Quiet is a gap, not a duration served. Momentum delivers at frame intervals and
never opens one; a hand that has stopped opens one immediately. Reading the gap
off the next event's timestamp needs no timer and no idea how long the tail
will run.

## The rail

`createGestureRail` tracks the last event's time and a spent flag:

- An event more than `quietMs` after the previous one starts a new gesture:
  clear the flag, zero the charge.
- While spent, return null.
- Firing a rung sets the flag.

## The floor

The gate alone caps gestures, not rate, and a mouse wheel's every notch is its
own gesture. So there is a second bound: `floorMs` between one rung and the
next, whatever arrives. The gate stops a tail; the floor stops a brisk roll
reaching the bottom of the wall before the eye follows.

Both bounds are needed, and the floor has to be the larger. Set equal, a roll
whose notches fall a hair either side of `quietMs` gets one rung for the whole
roll on one side and one per notch on the other — measured at 150/150, twelve
notches gave 1 rung at 100ms apart and 12 at 150ms apart. At 90/320 the same
rolls give 3 and 4.

A refused rung keeps its charge, so within one stream the rung lands as the
floor lapses rather than the hand paying for it twice.

**A pinch skips the gate.** Two fingers on the glass carry no momentum, so
there is no tail to separate and holding a spread to a single rung is wrong;
the floor paces it alone.

`nav.cooldownMs` becomes `nav.quietMs` at 90, beside a new `nav.floorMs` at
320. Both have sliders. `quietMs` has to stay above a frame — under about
16ms every event reads as a fresh gesture and zeroes the charge, so a trackpad
stream can never reach the threshold and the wall stops moving at all.

## The lightbox

The same rule, held locally rather than plumbed through: the component mounts
disarmed and arms on the first wheel event that follows a `quietMs` gap. Until
then it swallows — still calling `preventDefault` and `stopPropagation`, so the
tail cannot fall through to the wall's window listener and step a rung back out
from under the image that just opened.

Once armed the zoom is what it is today: continuous, unrailed, fit to
`MAX_SCALE` in one push if that is what you want. Committing to an image is the
part that should cost a gesture; looking around inside it should feel like a
hand on a knob.

Both surfaces read the one `quietMs`, because it describes the hand and not the
thing under it.

## Untouched

Keys, double-click, and the wheel-button third-axis drag. None of them is a
momentum stream, and the drag is continuous on purpose.
