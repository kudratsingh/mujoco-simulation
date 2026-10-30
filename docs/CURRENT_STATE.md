# Current project state

**Status reviewed: October 29, 2026. Latest recorded experiments: October 23, 2026.**

The project has progressed from physical-AI foundations to controlled robot-learning
experiments. Implementation progress and integration status are separate: the
advanced research remains in **open PRs**, while the implementation baseline on
`main` is still the Week-1 work at [commit 346f390][main-source]. Publishing these
documents and reports does not merge those research implementations.

The [public report hub][hub] presents twelve native experiment reports from the
immutable [PR19 source snapshot 4d2dbda][research-source]. This is a published
research snapshot, not a claim that every feature is available in a default clone
of `main`. See the [experiment ledger][ledger] for results and reset partitions.

## Project map

| Track | Implemented artifacts | Integration status as of the review date |
|---|---|---|
| Week 1 foundations | Configuration-space/frame notes, NumPy transforms, one-joint MuJoCo simulation, PD comparison, tests and system map | Landed implementation baseline on `main`; owner oral assessment is not certified |
| ROS basics | Ubuntu/Jazzy container, real publisher/subscriber, reset service/client, graph inspection and bag record/replay | Implemented in open PR5; `main` still has the ROS stub |
| Two-link arm | FK, both IK branches, Jacobian, singularity analysis, damped resolved-rate control, torque-limited MuJoCo physics and interactive browser lab | Implemented in open PR6 and included in the research snapshot |
| ROS arm integration | Separate simulator, controller and dashboard processes; freshness checks, delay/watchdog experiments and isolated bag replay | Implemented in open PR8 and included in the research snapshot |
| PushCube learning | State-based PPO, 32/256-demonstration BC comparison, native videos and reproducible evaluation | Implemented in open PR9–10 and included in the research snapshot |
| PickCube research | State baselines, fault recovery, normalization/action experiments, placement diagnostics, critic investigation and teacher-retention studies | Implemented in the open PR11–19 stack, with positive and negative measured results |
| Learning concepts | MDP/POMDP, BC/PPO and GAE worksheet, executable advantage arithmetic and tests | Separate open PR13 at [52701c2][learning-notes]; these files are absent from the PR19 snapshot |

The open research set is PR5, PR6 and PR8–19. This status describes implemented
artifacts awaiting integration, rather than fourteen merged milestones. The
[arm walkthrough][arm] and [ROS arm guide][ros-arm] explain the non-learning labs.

## Current research conclusion

The latest study compares fixed teacher-loss strengths λ10 and λ25 across three
paired training seeds. λ25 helps the previously identified problematic seed but
sacrifices gains in the other two and **fails its predeclared promising criterion**.
The reference remains the λ10 procedure, with its limitations preserved.
See the [latest result][strength-result] and [native report][strength-report].

The preceding teacher-retention study demonstrated substantial fixed-budget
improvement over matched PPO baselines, but one training seed still regressed
below its teacher. Earlier selected-checkpoint gains also disappeared during
continued optimization. These results support useful learned behavior and a
specific retention investigation; they do not establish consistently solved
manipulation, an optimal coefficient or long-horizon stability.

The next proposed direction is a **placement-aware objective or reference
constraint that protects successful manipulation states**. It is a proposal,
not an implemented or evaluated next assignment. It requires its own declared
protocol, supervision account and fresh evaluation cases.

## What the evidence does and does not cover

- The learning tasks use privileged state observations. Native simulator video
  supports inspection; it is not vision input to the policies.
- Evaluation retains the original full task horizon and distinguishes temporary
  success from success at the final step. Hand-coded stopping interventions are
  explicitly separate from autonomous policy performance.
- Research evidence includes episode outcomes, measured geometry/velocity,
  compressed traces, source/checkpoint hashes, learning curves and native videos.
  Full policy checkpoints, demonstration datasets and generated runtime assets
  remain ignored local artifacts; the repository is not a pretrained-model bundle.
- Tests and CI check implementation contracts, short simulator exercises and saved
  evidence. A passing pipeline does not certify policy quality or repeat all six
  full training runs. A `main` workflow badge does not summarize every open PR.
- Owner oral gates are **not certified by generated notes, completed code or CI**.
  The Week-1 review and later concept worksheets provide study material, not an
  independently recorded pass of every roadmap competency.
- Vision, hardware deployment, sim-to-real transfer, different BC teachers and
  longer-budget reliability remain outside the demonstrated scope.

## Inspect or reproduce the research snapshot

Use the immutable checkout when following advanced source instructions:

```bash
git clone https://github.com/kudratsingh/physical-ai-foundations.git
cd physical-ai-foundations
git switch --detach 4d2dbdaa09e48a74a05857e38212fdc0685360d9
```

Keep the environments separate. Root math/MuJoCo work uses its own Mac or Linux
Python environment and root requirements. ManiSkill learning uses a **separate
Python 3.11 environment** with its recorded platform-specific requirements and,
on Apple Silicon, the local Vulkan runtime described in the [learning setup][setup].
ROS 2 uses Ubuntu 24.04/Jazzy in Docker, with the ROS and colcon overlays sourced
inside the container; it is not installed into either Mac environment.

Read each pinned experiment's reproduction guide before launching work. Historical
results retain their original settings and caveats. Statements such as “next
experiment,” “no RL this week,” or an earlier unresolved debugging gate describe
their original stage, not the current project-wide state. The separate PR13
worksheet remains available through its pinned link without implying it landed
in this research snapshot.

[main-source]: https://github.com/kudratsingh/physical-ai-foundations/tree/346f39059edd2019b3d13f41bc861eeae634b36b
[research-source]: https://github.com/kudratsingh/physical-ai-foundations/tree/4d2dbdaa09e48a74a05857e38212fdc0685360d9
[learning-notes]: https://github.com/kudratsingh/physical-ai-foundations/blob/52701c2b1f5108060810e9c6f6b41311b88343b7/notes/robot_learning_mdp.md
[arm]: https://github.com/kudratsingh/physical-ai-foundations/blob/4d2dbdaa09e48a74a05857e38212fdc0685360d9/notes/planar_arm.md
[ros-arm]: https://github.com/kudratsingh/physical-ai-foundations/blob/4d2dbdaa09e48a74a05857e38212fdc0685360d9/ros2_ws/ARM_README.md
[setup]: https://github.com/kudratsingh/physical-ai-foundations/blob/4d2dbdaa09e48a74a05857e38212fdc0685360d9/learning/maniskill/README.md
[strength-result]: https://github.com/kudratsingh/physical-ai-foundations/blob/4d2dbdaa09e48a74a05857e38212fdc0685360d9/learning/maniskill/STRENGTH_RESULTS.md
[strength-report]: https://kudratsingh.github.io/physical-ai-foundations/reports/retention-strength/
[hub]: https://kudratsingh.github.io/physical-ai-foundations/
[ledger]: EXPERIMENTS.md
