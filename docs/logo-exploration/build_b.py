svg = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256" role="img" aria-labelledby="title-b">
  <title id="title-b">Votera Civic Fold</title>
  <!-- Left Wing (Base Ballot) -->
  <path fill="#000000" d="M 43 55 L 98 55 L 123 98 L 97 149 L 43 55 Z"/>
  <!-- Right Wing (Forward Ballot Ribbon) -->
  <path fill="#000000" d="M 158 55 L 213 55 L 128 202 L 103 202 L 103 169 L 139 107 Z"/>
</svg>"""

with open("docs/logo-exploration/concept-b.svg", "w") as f:
    f.write(svg)
