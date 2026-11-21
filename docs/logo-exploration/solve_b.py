import math

# Find perfect integer coords for Concept B:
# Left wing points: P1, P2, P3, P4
# Right wing points: Q1, Q2, Q3, Q4, Q5, Q6

# Clean angles must be within 0.3 deg of [0, 15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180]
# OR > 3.0 deg away from all of them!

# Let's inspect:
def is_near_miss(p1, p2):
    dx = p2[0] - p1[0]
    dy = p2[1] - p1[1]
    if dx == 0 and dy == 0: return False, 0
    ang = math.degrees(math.atan2(dy, dx)) % 180
    CLEAN = [0, 15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180]
    diff = min(abs(ang - c) for c in CLEAN)
    return (0.3 <= diff <= 3.0), diff

# Let's test a simple, elegant geometric construction:
# Outer V:
# Top: (40, 56) to (96, 56) and (160, 56) to (216, 56)
# Left outer: (40, 56) to (128, 208) [dx=88, dy=152: atan(152/88) = 59.93 deg! Diff = 0.07 deg!]
# Right outer: (216, 56) to (128, 208) [dx=-88, dy=152: angle = 120.07 deg! Diff = 0.07 deg!]
# Inner vertex: (128, 126)
# Left inner: (96, 56) to (128, 126) [dx=32, dy=70: atan(70/32) = 65.44 deg. Diff from 60 is 5.44 > 3.0, diff from 75 is 9.56 > 3.0! NOT A NEAR MISS!]
# Right inner: (160, 56) to (128, 126) [dx=-32, dy=70: angle = 114.56 deg. Diff from 120 is 5.44 > 3.0! NOT A NEAR MISS!]
# Now what if Concept B is:
# A solid V with a horizontal or vertical ballot slot?
# If there is a vertical slot:
# At x=120 and x=136: vertical lines angle = 90.00 deg!
# From (120, 126) down to (120, 208): dy=82, dx=0 -> 90 deg!
# From (136, 126) down to (136, 208): dy=82, dx=0 -> 90 deg!
# Bottom cuts: from (120, 208) to (105, 208) (0 deg) and from (136, 208) to (151, 208) (0 deg).
print("Calculated")
