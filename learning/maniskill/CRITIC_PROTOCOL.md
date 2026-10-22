# PickCube critic investigation and short paired ablation

The previous BC-initialized PPO run improved early, then regressed while value
loss grew by orders of magnitude. This experiment investigates the value scale,
timeout correction and optimizer coupling before another long training run.

The offline audit uses every observation from the first eight trajectories of
the existing BC-validation split, without outcome-based selection. It records
408 off-policy demonstration states, dataset/split/checkpoint hashes and installed
source hashes. These are probes, not fresh-policy evaluation episodes and not
historical on-policy gradients. Saved checkpoints do not contain rollout buffers.

Installed PickCube normalized rewards lie in [0,1]. At gamma=0.99, a true
continuing discounted value lies in [0,100]. Timeout bootstrapping remains the
existing continuing-task convention: gamma times the pre-reset terminal value
is added once, and GAE does not cross the reset. This condition does not redefine
the task as a zero-terminal finite-horizon objective.

The paired treatment changes only critic output to:

```text
V(s) = 100 * tanh(raw_value(s) / 100)
```

The slope is one near zero; the output is confined to [-100,100], containing the
true nonnegative value range. No reward, target or advantage is clipped. Actor
architecture/weights, fixed BC normalization, critic input clipping, underlying
critic tensors, optimizer, exploration and learning settings match the raw arm.
Canonical parameter names remove only the extra outer value-head module prefix.
Both actual initial checkpoints, RNG digests and empty optimizers must match.

Each arm starts fresh from the BC-256 teacher with seed42 and four CPU workers.
Both receive exactly262,144 transitions. This short budget was chosen from the
previously observed regression point before new test outcomes. It is not a claim
of stability for the former million-transition budget. Other settings match
PR16: rollout256, batch256, up to8 epochs, learning rate0.00003, gamma0.99,
lambda0.95, PPO ratio clip0.2, entropy coefficient0, initial std exp(-3), target
KL0.01, original PickCube reward/controller/50-step horizon.

Validation seeds180000–180009 run at step0 and every32,768 transitions. Selection
ranks final success, then any-step success, then return; selected checkpoints are
secondary. Only after both runs finish, evaluate teacher, raw final, bounded
final, raw selected and bounded selected on untouched paired seeds190000–190049.
Native videos use the first two seeds for teacher and both final policies.
The primary comparison is fixed-budget final success; selection cannot replace it.
One training seed per arm cannot establish robustness.

Before training, both initialized policies must exactly reproduce all ten teacher
validation episode dictionaries, with matching canonical tensors. A separate
4,096-transition bounded-critic stochastic smoke must remain finite; its weights
and optimizer are discarded. The earlier dry preflight directory contains only
these implementation checks, with no performance training or final test use.

Read-only hooks capture the actual first optimizer step of every rollout: actor
and critic gradient norms before and after global clipping, and actual Adam
parameter deltas. The rollout diagnostics capture values, GAE returns, raw
rewards, timeout values and rewards after bootstrap correction. A regression test
requires bitwise identical learned weights with and without both diagnostic
hooks and timeout probes. Gradients are not replaced, rescaled or used as input.
Global clipping can scale actor gradients down, but Adam is adaptive, so actual
parameter changes are reported separately rather than inferred from gradients.

Do not edit launch sources during training. Both arms use the same frozen
instrumentation; source snapshots and hashes are saved before launch. All
historical results remain intact. Evaluate on the original task without any
stopping postprocessor or privileged corrective controller.
