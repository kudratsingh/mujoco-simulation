# Week 2 two-link forward kinematics

Forward kinematics answers: given the joint angles, where is the hand and how
is it oriented? This first Week-2 exercise adds a planar arm with two revolute
joints, an analytic implementation, a browser explorer, and independent checks
against MuJoCo's kinematics.

## Open the explorer

From this checkout's repository root, on the Mac:

```bash
.venv/bin/python math/arm_viewer.py
```

It opens `http://127.0.0.1:8765` in your browser. The terminal keeps the viewer
running; press Ctrl+C there when finished. Use `--port 0` to choose a free port
if another program already uses 8765, or `--no-open` to print the URL without
opening a browser. This exercise uses the Mac venv, outside the ROS container.

The Week-2 branch is `feat/planar-arm-fk`. While the ROS branch is still being
reviewed, its worktree is `.worktrees/week2-planar-arm/` in the original repo.
From the original repo root, the equivalent launch command is:

```bash
.venv/bin/python .worktrees/week2-planar-arm/math/arm_viewer.py
```

## The geometry

The shoulder is fixed at world (0,0). Link 1 has length L1 = 1.00 m; link 2 has
length L2 = 0.75 m. Both joints rotate about +z, out of the page. Positive
angles are counterclockwise. The UI shows degrees, and Python converts them to
radians before doing the calculation.

- q1 is link 1's angle relative to world +x.
- q2 is link 2's angle **relative to link 1**.
- Link 2 and the hand therefore have world orientation q1 + q2.

The elbow position is:

```text
elbow_x = L1 cos(q1)
elbow_y = L1 sin(q1)
```

Add the second link's displacement to get the hand position:

```text
hand_x = L1 cos(q1) + L2 cos(q1 + q2)
hand_y = L1 sin(q1) + L2 sin(q1 + q2)
```

At q1 = 30 degrees and q2 = 60 degrees, the elbow is approximately
(0.866, 0.500) m. Link 2 points at 90 degrees in world coordinates, so it adds
(0, 0.750) m. The hand is at (0.866, 1.250) m with world orientation 90 degrees.

## Connect it to Week 1 transforms

The code also builds the same result as a chain of homogeneous transforms:

```text
T_world_hand = T_world_shoulder @ T_shoulder_elbow @ T_elbow_hand

T_world_shoulder  = [ Rz(q1)   (0, 0, 0)  ]
                   [ 0        1          ]

T_shoulder_elbow  = [ Rz(q2)   (L1, 0, 0) ]
                   [ 0        1          ]

T_elbow_hand     = [ I        (L2, 0, 0) ]
                   [ 0        1          ]
```

The shoulder frame rotates with link 1. The elbow frame sits at the end of
link 1 and rotates with link 2. The translation (L1,0,0) is expressed in the
shoulder frame, so multiplying the matrices rotates that displacement into
world coordinates. The final translation (L2,0,0) is expressed along link 2.
The viewer's expandable transform section displays all four matrices live.

## Try these configurations

1. **Straight, q1 = 0, q2 = 0:** hand at (1.75,0) m, the maximum reach.
2. **Bent, q1 = 0, q2 = 90:** hand at (1.00,0.75) m.
3. Keep q2 = 90 and move q1. Both links rotate in the world, while the elbow
   keeps its relative bend. Changing the shoulder does not affect q2.
4. **Folded, q1 = 0, q2 = 180:** hand at (0.25,0) m, the minimum reach.
5. **Upright, q1 = 90, q2 = 0:** hand at (0,1.75) m.

Predict the position before clicking each preset, then check the readout.

## Configuration space and workspace

There are two independent joint angles: 2 DoF. Without joint limits the
configuration space is S1 × S1, a torus. The sliders display one representative
angle in [-180,180] degrees; the endpoints represent the same rotation.

The reachable **position** workspace is an annulus centred at the base:

```text
|L1 - L2| <= distance from base <= L1 + L2
0.25 m   <= distance from base <= 1.75 m
```

These bounds assume unrestricted joints and ignore collisions. For equal link
lengths, the inner radius becomes zero. Hand orientation is tied to the joint
angles: two joints cannot independently set arbitrary x, y and heading.

## What is implemented

- `math/planar_arm.py`: link geometry, joint positions, 4x4 hand pose, transform
  chain, workspace bounds, and conversion from UI degrees to radians.
- `math/arm_viewer.py` and `math/arm_viewer.html`: a localhost-only viewer. The
  sliders request results from the actual Python FK implementation; the browser
  uses those coordinates to draw the arm.
- `mujoco/two_link.xml`: separate reference model with the same link lengths.
  Tests set qpos and call mj_forward, then compare the elbow and hand sites to
  the analytic result. Its base is raised 0.2 m in z; the xy geometry matches.
- `tests/test_planar_arm.py`: known poses, relative-angle convention, transform
  composition, link lengths, workspace bounds, periodicity, validation, and
  independent MuJoCo comparisons.
- `tests/test_arm_viewer.py`: actual HTTP page/pose requests, bad-input responses,
  and rejection of unrecognized paths.

The viewer sets angles directly and calculates geometry. Torque control,
inverse kinematics and Jacobians are later Week-2 steps. Opening the browser
does not start a dynamics rollout or ROS node.

## Validation

On October 20, 2026, `.venv/bin/python -m pytest` passed all **57 tests**,
including the existing 31 tests. The browser was checked interactively: the
Bent preset produced (1.000,0.750) m, and moving only the shoulder to 180 degrees
produced (-1.000,-0.750) m while q2 stayed at 90 degrees. The FK calculations
match MuJoCo positions and orientations over 30 fixed-seed configurations.

## Reference

[Modern Robotics Chapter 4 introduction to forward kinematics](https://modernrobotics.northwestern.edu/nu-gm-book-resource/4-1-1-product-of-exponentials-formula-in-the-space-frame/)
defines FK as finding the end-effector frame from joint coordinates. This
exercise starts with an explicit two-link geometric derivation and uses the
Week-1 homogeneous transforms; product-of-exponentials machinery is future work.
