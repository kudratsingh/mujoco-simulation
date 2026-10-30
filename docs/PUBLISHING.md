# Maintaining the public project view

The landing README, current-state page and experiment ledger describe both the
code on main and implemented work still in open PRs. Keep those two statuses
separate. Updating this documentation is not authorization to merge the research
stack, change a scientific protocol, or rerun training.

## Public report hub

[The hub](https://kudratsingh.github.io/physical-ai-foundations/) is deployed by
`.github/workflows/pages.yml`. Main owns the landing page and publication code.
A separate checkout supplies report assets from the **full immutable commit SHA**
in `docs/project.json`, currently `4d2dbdaa09e48a74a05857e38212fdc0685360d9`.
No simulator or learning dependencies run during publication.

The build copies 12 existing report directories unchanged and records every
copied file's SHA-256 in `provenance.json`. Summary counts are read from the
committed geometry/criterion files. It verifies the source commit and all local
HTML links. Publishing reports does not integrate the corresponding code into
main, and the workflow never alters historical evidence.

To preview locally, use an exact checkout of the declared research commit:

```bash
# From the main/documentation checkout; the repository must contain this commit.
git worktree add --detach ../physical-ai-report-source 4d2dbdaa09e48a74a05857e38212fdc0685360d9
python3 scripts/build_public_site.py --source ../physical-ai-report-source --output _site
python3 -m http.server 8780 --bind 127.0.0.1 --directory _site
```

Open http://localhost:8780. The builder requires a new output directory to avoid
silently mixing old/new reports. Use a different output path for another build.
`_site/`, `.public-source/` and local environments are ignored by Git.

Pull requests build and validate a Pages artifact without deployment. After a
documentation change merges into main, the build publishes with GitHub Pages.
The deploy job has Pages/OIDC permissions; report-building jobs only read code.
The repository homepage points to the deployed hub.

## Updating the snapshot

1. Verify the live default branch, PR states and the new evidence commit.
2. Update `docs/project.json` with a full commit SHA and explicit report paths.
3. Reconcile the README, CURRENT_STATE and EXPERIMENTS pages with actual outcomes.
   Keep primary finals, validation-selected results, test reset lists, and
   historical reproducibility caveats separate.
4. Build the hub. Review study switching, selected-checkpoint columns, report
   search, native videos, narrow-screen layout and all local links.
5. Open a documentation PR, require passing checks, and publish through main.
   Verify the live page, reports, data and deployment before claiming completion.

The repository description/topics should describe implemented project scope.
Never present green CI as policy-quality evidence, a historical “next” task as
current work, or an unmerged implementation as part of main. Do not update
frozen report text merely to make the project sound more successful.

## Current provenance boundaries

The latest research snapshot is PR #19. Its preceding experiments are historical
comparisons with their own reset lists and checkpoints. The theory worksheet
in PR #13 is a separate branch at `52701c2b1f5108060810e9c6f6b41311b88343b7`
and is not included in the PR #19 implementation tree. Full training checkpoints
and demonstration data remain local, not part of the static site or public Git.
