"""Week 2: forward kinematics for a planar arm with two revolute joints.

Angles are radians, lengths are metres, and positive rotation is about +z.
q1 is measured from world +x; q2 is relative to link 1, so the hand's
orientation in the world is q1 + q2. Joints have unrestricted rotation.
"""
from dataclasses import dataclass
import math

import numpy as np

from transforms import make_transform, rot_z


@dataclass(frozen=True)
class PlanarArm:
    """Geometry shared by the analytic functions and browser explorer."""

    l1: float = 1.0
    l2: float = 0.75

    def __post_init__(self):
        for name, length in (("l1", self.l1), ("l2", self.l2)):
            if not math.isfinite(length) or length <= 0:
                raise ValueError(f"{name} must be a positive finite length in metres")

    def joint_positions(self, q1: float, q2: float) -> np.ndarray:
        """Return world (x,y) coordinates of base, elbow and hand, shape (3,2)."""
        if not math.isfinite(q1) or not math.isfinite(q2):
            raise ValueError("Joint angles must be finite radians")
        elbow = self.l1 * np.array([math.cos(q1), math.sin(q1)])
        hand = elbow + self.l2 * np.array([math.cos(q1 + q2), math.sin(q1 + q2)])
        return np.array([[0.0, 0.0], elbow, hand])

    def forward_kinematics(self, q1: float, q2: float) -> np.ndarray:
        """Return the 4x4 hand pose T_world_hand, using the Week-1 convention."""
        hand = self.joint_positions(q1, q2)[-1]
        return make_transform(rot_z(q1 + q2), np.array([*hand, 0.0]))

    def transform_chain(self, q1: float, q2: float) -> tuple[np.ndarray, ...]:
        """Return T_world_shoulder, T_shoulder_elbow, T_elbow_hand.

        The shoulder frame rotates with link 1; the elbow frame rotates with
        link 2. Translate l1 along shoulder x before the second rotation;
        translate l2 along elbow x to reach the hand.
        """
        self.joint_positions(q1, q2)  # validate angles consistently
        return (
            make_transform(rot_z(q1), np.zeros(3)),
            make_transform(rot_z(q2), np.array([self.l1, 0.0, 0.0])),
            make_transform(np.eye(3), np.array([self.l2, 0.0, 0.0])),
        )

    @property
    def workspace_radii(self) -> tuple[float, float]:
        """Minimum/maximum hand distance from the base, ignoring collisions."""
        return abs(self.l1 - self.l2), self.l1 + self.l2


def pose_payload(q1_deg: float, q2_deg: float) -> dict:
    """Browser-facing representation; convert degrees to radians at the boundary."""
    arm = PlanarArm()
    q1, q2 = math.radians(q1_deg), math.radians(q2_deg)
    positions = arm.joint_positions(q1, q2)
    transforms = arm.transform_chain(q1, q2)
    return {
        "angles_deg": [q1_deg, q2_deg],
        "angles_rad": [q1, q2],
        "lengths": [arm.l1, arm.l2],
        "positions": positions.tolist(),
        "hand_heading_deg": q1_deg + q2_deg,
        "workspace_radii": list(arm.workspace_radii),
        "transform": arm.forward_kinematics(q1, q2).tolist(),
        "chain": [matrix.tolist() for matrix in transforms],
    }


if __name__ == "__main__":
    arm = PlanarArm()
    q1, q2 = math.radians(30), math.radians(60)
    print("q1 = 30 deg; q2 = 60 deg; lengths = 1.0 m, 0.75 m")
    print("Base, elbow, hand [m]:\n", arm.joint_positions(q1, q2))
    print("T_world_hand:\n", arm.forward_kinematics(q1, q2))
