# Polyhedra Net Folder

Interactive folding nets for Platonic and Archimedean solids (Three.js). Load preset nets or a custom JSON net file.

## Net JSON format

- **`baseFace`**: Either **`noSides`** (integer ≥ 3) for a regular polygon with the app’s default edge length, or **`vertices`** for an irregular face.
- **`connections`**: Each item describes one attached face. Same rule: **`noSides`** or **`vertices`** (length ≥ 3). Other fields are unchanged (`from`, `to`, `fromEdge`, `toEdge`, `color`, etc.).

### `vertices` (irregular polygon)

- Array of corner positions in the **flat net** plane. Each point is either **`[x, z]`** (y is 0) or **`[x, y, z]`**. Use a consistent winding (e.g. counterclockwise in xz when viewed from +y) so face normals match the rest of the app.
- **`vertexScale`** (optional, number): multiplied into all coordinates of that face after parsing.
- Edge indices in **`fromEdge`** / **`toEdge`** refer to these corners by index, same as for regular faces.

The fold animation still uses the matched polyhedron’s **dihedral lookup** from vertex/face counts. Irregular shapes are geometrically valid in the net; fold angles may not match a real physical solid unless the net is designed for it.

### Example

See `nets/cube-irregular-base-top.json`: cube topology with an irregular quadrilateral base and regular square flaps.

The **Rhombic Dodecahedron** preset (`nets/rhombic-dodecahedron-net.json`) uses twelve congruent rhombi (acute angle `arccos(1/3)`), topology from [Sandia polyhedra #33](https://netlib.sandia.gov/polyhedra/33), with face IDs ordered so fold stages match the app’s animation.
