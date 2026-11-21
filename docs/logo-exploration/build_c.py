import math

# Find integer coordinates where angle deviation from 60 deg is < 0.2 deg:
# Left stroke:
# (54, 104) to (106, 194): dx=52, dy=90 -> angle = math.degrees(math.atan2(90, 52)) = 59.98 deg (diff 0.02 deg!)
# (94, 104) to (119, 147): dx=25, dy=43 -> angle = math.degrees(math.atan2(43, 25)) = 59.82 deg (diff 0.18 deg!)
# Right stroke:
# Inner: from (119, 147) to (177, 61): dx=58, dy=-86 -> angle = math.degrees(math.atan2(-86, 58)) = -56.00 deg (diff from 60 is 4.0 deg > 3.0 deg, not near-miss!)
# Cut: from (177, 61) to (203, 87): dx=26, dy=26 -> angle = 45.00 deg (diff 0.00 deg!)
# Outer: from (131, 194) to (203, 87): dx=72, dy=-107 -> angle = math.degrees(math.atan2(-107, 72)) = -56.06 deg (diff from 60 is 3.94 deg > 3.0 deg!)
# Bottom: from (106, 194) to (131, 194): dy=0 -> angle = 0.00 deg!
# Top left: from (54, 104) to (94, 104): dy=0 -> angle = 0.00 deg!

squircle = "M 76 24 H 180 A 52 52 0 0 1 232 76 V 180 A 52 52 0 0 1 180 232 H 76 A 52 52 0 0 1 24 180 V 76 A 52 52 0 0 1 76 24 Z"
cutout = "M 54 104 L 94 104 L 119 147 L 177 61 L 203 87 L 131 194 L 106 194 Z"

svg_c = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256" role="img" aria-labelledby="title-c">
  <title id="title-c">Votera Vault Badge</title>
  <path fill-rule="evenodd" fill="#000000" d="{squircle} {cutout}"/>
</svg>'''

with open("docs/logo-exploration/concept-c.svg", "w") as f:
    f.write(svg_c)
