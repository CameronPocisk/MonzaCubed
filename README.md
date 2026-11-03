# MonzaCubed


# Steps for Height map / Image
To recreate Monza, we got satalite imagery from google maps, and a height map from https://tangrams.github.io/
Direct location link to monza on the heightmap site" https://tangrams.github.io/heightmapper/#15.33256/45.6171/9.2877

Then using The world wayback (https://livingatlas.arcgis.com/wayback/#mapCenter=9.28770%2C45.61710%2C15&mode=explore&active=63116)
Navigate to the same area

Then, using a heightmap with labels on half opacity, overlap the heightmap and satalite imagery
Finally, resize them to be as large as you can and screenshot the cropped images

# Level 4 Fun (race simulator)
`level4fun.html` / `level4fun.js` is a fun extra on top of Level 4, built with AI assistance (Claude) and labeled as such on the page. It is not one of the graded levels. It adds a 3-lap race with the 2026 grid (team colors and pace are approximate), procedural scenery, grandstands, pit wall, kerbs, and TV cameras (chase, onboard, helicopter, blimp).

# Credits

## 3D model
"2026 Audi R26" (https://skfb.ly/pOvCu) by Dave Love SketchFab is licensed under Creative Commons Attribution (http://creativecommons.org/licenses/by/4.0/).

Changes made: the model was reduced in polygon count (Blender Decimate modifier) and exported to OBJ so it could be drawn many times in WebGL, and its paint areas are recolored in the shader to show each 2026 team's livery. Using an imported model (instead of cubes only) was approved by Prof. Aurisano.
