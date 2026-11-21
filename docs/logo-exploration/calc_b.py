import math

# Let's test a clean, balanced geometric mark for Concept B:
# "The Civic Diamond / Folded Ballot"
# An isometric/diamond silhouette forming a V-ballot fold.
# Or two interlocking chevron ribbons:
# Left ribbon (slanted down at 60 deg):
# Outer: from (48, 56) down to (116, 204): dx=68, dy=148
# Let's check angles for exact clean angles:
# tan(60) = 1.73205
# If dy = 148, dx = 148 / 1.73205 = 85.45 -> dx = 85 (dy=147, dx=85: atan(147/85) = 59.96 deg! Diff = 0.04 deg < 0.3 deg!)
# Left top: (43, 57) to (98, 57)
# Outer down to (128, 204): (43+85, 57+147) = (128, 204)
# Inner down to (128, 109): (98+30, 57+52) = (128, 109) [dy/dx = 52/30 = 1.733 -> 60.02 deg!]
# Right outer down from (213, 57) to (128, 204): dx=-85, dy=147 -> angle = 120.04 deg!
# Right inner down from (158, 57) to (128, 109): dx=-30, dy=52 -> angle = 119.98 deg!

# Now, how to create the ballot fold in Concept B:
# A diagonal slot running at 60 deg across the right wing:
# Or a floating ballot slip in the center:
# What if the ballot is a central vertical column slipping in?
# Let's test!
print("60 deg geometry computed")
