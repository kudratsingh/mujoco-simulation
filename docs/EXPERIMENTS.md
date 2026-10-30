# Experiment ledger

**Publication status: October 29, 2026. Latest recorded experiments: October 23.**

These are measured studies from the integrated research stack, published from the
immutable [4d2dbda snapshot][snapshot]. They are not current upstream benchmark
scores or claims of solved manipulation.
The [current-state overview][state] separates implementation, integration and
competency gates. The [report hub][hub] contains twelve native visual reports.

## Read the comparisons correctly

Final-step success is distinct from reaching success temporarily. Each row below
names its own reset partition: a different teacher or PPO score on a new list
does not demonstrate a training change. BC receives external expert data; BC/PPO
comparisons are not expert-acquisition-cost or compute matched. One trained model
is not a training-seed robustness study, and correlated trajectory steps are not
independent performance trials.

The tables summarize selected findings. Each linked report retains full settings,
selection rules, native videos, failure evidence and provenance.

## Historical studies

| Study and evaluation resets | Observed result | Interpretation and native report |
|---|---|---|
| First PushCube PPO · 10000–10019 | After 262,144 transitions: **17/20 any-step**, **7/20 final** successes; random and zero commands 0/20 | A working learned behavior with substantial end-of-episode loss; one training seed. [Report][push-ppo] |
| PushCube BC · fresh 20000–20049 | BC-32 **33/50 final**, BC-256 **41/50 final**; both reached success in 50/50. Unchanged prior PPO: **26/50 final**, 39/50 any-step | Same PPO weights, different reset sample. More demonstrations helped in this run; external expert cost is excluded. [Report][push-bc] |
| Initial PickCube state baselines · 50000–50049 | BC-32 **10/50 final**, BC-256 **27/50**, PPO **0/50** after 1,048,576 transitions | Grasping/lifting did not establish simultaneous placement and stillness. [Report][pick-base] |
| PPO continuation and observation fault · 70000–70049 | Two learning-rate continuations remained **0/50 final**. BC: **34/50 clean → 0/50 corrupted goal → 34/50 restored** | A smaller update did not fix the policy; restoring the input contract recovered every clean episode record, without retraining. [Report][debug] |
| Observation normalization · 90000–90049 | Raw and normalized PPO finals both **0/50**, at equal 1,048,576-transition budgets | Input scaling alone did not fix placement/holding. Evaluation statistics were frozen. [Report][norm] |
| Privileged stopping diagnostic · validation 80000–80009 | Raw ordinary **0/10 → 2/10 override**; normalized ordinary **0/10 → 1/10 override** | Three naturally placed cases recovered under a hand-coded intervention. These are not autonomous PPO successes or final-test results. [Report][stop] |
| Tanh-Gaussian action ablation · 110000–110049 | Raw and bounded-action PPO finals both **0/50**, at equal 1,048,576-transition budgets | Bounding the distribution alone did not solve the task. [Report][bounded] |
| Observation-only stopping and placement · validation 80000–80009 and 130000–130009 | Observation-only hybrids reproduced privileged interventions exactly; on the separate placement resets BC ended **8/10**, both ordinary PPO policies **0/10** | No training or final tests; hybrid recovery and conditional trajectory diagnostics remain separate from autonomous performance. [Report][placement] |
| BC-initialized PPO · 150000–150049 | Teacher **23/50 final**, selected warm PPO **31/50**, fixed-budget warm final **0/50**; matched random-actor final **0/50** | Early improvement did not survive 1,048,576 transitions. Selected results are secondary. [Report][bc-ppo] |
| Critic-bound investigation · 190000–190049 | Teacher **28/50 final**, raw final **7/50**, bounded final **10/50**; selected raw/bounded **41/50 / 37/50** | Numerical growth was controlled without retaining the skill. Historical worker-reset streams were incompletely controlled; subsequent runs repair that gap. [Report][critic] |

PickCube success throughout requires actual 3D cube–goal distance at most 2.5 cm
and all seven arm-joint speeds at most 0.2 rad/s. Evaluations retain all 50 steps.
PushCube uses its separate upstream pushing/height predicate; its percentages
must not be treated as the same task as PickCube.

## Three-seed teacher retention: promising, with a remaining failure

On fresh resets **240000–240049**, each model received 262,144 transitions.

| Training seed | Matched PPO baseline final | Teacher-anchored final | Baseline selected | Anchored selected |
|---|---:|---:|---:|---:|
| 42 | 10/50 | 40/50 | 42/50 | 38/50 |
| 1042 | 4/50 | 37/50 | 33/50 | 41/50 |
| 2042 | 5/50 | 25/50 | 36/50 | 40/50 |

The fixed teacher scored **26/50** on this list. The study met its predeclared
promising rule: two of three seeds cleared the final-success margins, and mean
signed selected-minus-final collapse fell from 30.67 to 5.67 successes. Seed 2042 still
finished below its teacher and lost 15 successes from its selected checkpoint.
Its 13 lost-success episodes ended task-static but displaced. Smaller commands
and lower arm speeds alone did not guarantee precise holding.

This treatment changes the training objective: it adds a frozen original-BC
mean-action loss on current training minibatches. It does not add a stopping
override or change the evaluation task. The same 50 reset seeds are reused across
the three training seeds; this is not 150 independent reset trials.
[Native report][retention] · [Detailed pinned result][retention-source]

## Latest result: stronger global anchoring fails its criterion

This fixed λ10-versus-λ25 comparison uses **new resets 250000–250049**, the same
three training seeds and 262,144 transitions per model. There is no new pilot,
coefficient search or retrospective test-based selection.

| Training seed | λ10 final · primary | λ25 final · primary | Change | λ10 selected · secondary | λ25 selected · secondary |
|---|---:|---:|---:|---:|---:|
| 42 | 40/50 | 36/50 | −4 | 40/50 | 41/50 |
| 1042 | 40/50 | 37/50 | −3 | 45/50 | 35/50 |
| 2042, declared target | 32/50 | 37/50 | +5 | 43/50 | 37/50 |

The teacher scored **31/50 on this new list**. λ25 improved the targeted seed by
the required five successes, but lost more than the allowed two in each other
seed. The overall descriptive criterion therefore **failed**. Mean primary
success fell from 74.7% to 73.3%, despite lower mean signed selection-to-final
collapse. Reduced teacher-action deviation did not imply uniformly better
placement. All successful-then-displaced final trajectories remain visible.

Retain λ10 as the reference. A placement-aware objective or a constraint protecting
successful states is a proposed next experiment, not an implemented result.
These studies do not establish an optimal coefficient, longer-budget stability,
vision competence, sim-to-real transfer or reliable behavior across all seeds.
[Native report][strength] · [Detailed pinned result][strength-source]

## Reproducibility and reading limits

The later studies verify actual checkpoint budgets, teacher tensors, paired
initialization and worker streams before held-out evaluation. Evidence includes
full-horizon outcomes, measured geometry, compressed state/action traces, source
snapshots and hashes. CI audits contracts and stored evidence rather than repeating
the full research training budgets. Full weights and datasets remain local,
ignored artifacts. Oral explanations and owner competency checks remain separate.

[snapshot]: https://github.com/kudratsingh/physical-ai-foundations/tree/4d2dbdaa09e48a74a05857e38212fdc0685360d9
[state]: CURRENT_STATE.md
[hub]: https://kudratsingh.github.io/physical-ai-foundations/
[push-ppo]: https://kudratsingh.github.io/physical-ai-foundations/reports/pushcube-ppo/
[push-bc]: https://kudratsingh.github.io/physical-ai-foundations/reports/pushcube-bc/
[pick-base]: https://kudratsingh.github.io/physical-ai-foundations/reports/pickcube-baselines/
[debug]: https://kudratsingh.github.io/physical-ai-foundations/reports/ppo-debug/
[norm]: https://kudratsingh.github.io/physical-ai-foundations/reports/normalization/
[stop]: https://kudratsingh.github.io/physical-ai-foundations/reports/stopping/
[bounded]: https://kudratsingh.github.io/physical-ai-foundations/reports/bounded-actions/
[placement]: https://kudratsingh.github.io/physical-ai-foundations/reports/placement/
[bc-ppo]: https://kudratsingh.github.io/physical-ai-foundations/reports/bc-initialized-ppo/
[critic]: https://kudratsingh.github.io/physical-ai-foundations/reports/critic-stability/
[retention]: https://kudratsingh.github.io/physical-ai-foundations/reports/teacher-retention/
[strength]: https://kudratsingh.github.io/physical-ai-foundations/reports/retention-strength/
[retention-source]: https://github.com/kudratsingh/physical-ai-foundations/blob/4d2dbdaa09e48a74a05857e38212fdc0685360d9/learning/maniskill/RETENTION_RESULTS.md
[strength-source]: https://github.com/kudratsingh/physical-ai-foundations/blob/4d2dbdaa09e48a74a05857e38212fdc0685360d9/learning/maniskill/STRENGTH_RESULTS.md
