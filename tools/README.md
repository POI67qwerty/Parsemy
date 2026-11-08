# Developer helpers

`devkit.py` is a dependency-free, non-mutating helper CLI for faster investigation. Run it from any directory; it resolves the repository root from its own location.

```sh
python3 tools/devkit.py inventory
python3 tools/devkit.py duplicates
python3 tools/devkit.py duplicates --block-lines 12
python3 tools/devkit.py find-tests bevel stacked pixel
python3 tools/devkit.py run tests/fisheye-geometry-cache.js tests/render-optimization-pixels.js
python3 tools/devkit.py quick
python3 tools/devkit.py quick --build
python3 tools/devkit.py quick --pixels
```

- `inventory`: counts JS/Python/shell scripts and reports production JS line counts.
- `duplicates`: reports repeated named function declarations and exact normalized code blocks across root-level production JS. This is a review aid, not a semantic clone detector.
- `find-tests`: searches test filenames and source text for one or more keywords (any match).
- `run`: runs explicit test paths sequentially, continues after failures, and provides a summary.
- `quick`: executes the focused rendering, selection, fish-eye cache/pixel, recessed-floor, and outliner regression set. `--pixels` adds architecture/corner pixel baselines; known baseline mismatches are surfaced rather than automatically updated. `--build` runs `build.sh` first.

For the outstanding beveled-building pixel mismatch, the diagnostic can save the current raster or compare against a reference PNG (same 1600×900 canvas size):

```sh
bash tests/run.sh tests/diagnose-beveled-stacked-side.js --save-current=/tmp/beveled-current.png
bash tests/run.sh tests/diagnose-beveled-stacked-side.js --reference=/path/to/known-good.png
```

The second command reports differing pixel count, channel count, maximum channel delta, and bounding box, alongside candidate seam/occlusion policy hashes. It never changes the saved fixture.

All test execution uses the project's existing `tests/run.sh` environment setup. No fixture or source file is modified by these commands.
