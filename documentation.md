# Monza Cubed!
[Source code](https://github.com/CameronPocisk/MonzaCubed)
# Design Plans

# Project Description

### Features and Controls
### Screenshots 
### Demo video
[Demo Video](Link to demo Adi :))

# Level 0 
by Cameron
Level 0 was done by Cameron before the tutorials for webGL in class. Here we learned what a shader, buffer, and program are. 
I followed [this tutorial](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/Tutorial/Adding_2D_content_to_a_WebGL_context) from start to finish which origionally produced a red cube. 
After completing the tutorial, I adjusted the cube to be a [CMYK Cube](https://www.cmycubes.com/cdn/shop/products/cmycubes_225714273_321209596349055_3568825238767861154_n.jpg?v=1762482606&width=1000) with transparency, and rotated about each axis for a fun effect.

# Level 1
by Cameron
Level one comes from the demo in class. Here we read through all the code and actually learned what was going on in each part of the program. 
After creating level 1 we had a good fundamental concept of Vertex/Fragment shaders, GL Programs, Buffers, Shader attributes, transformation matricies, cameras, and draw functions. I ported over the original example from class for the lecture. 

by Adi

# Level 2 
by Cameron
This is were we started to get some basic results and make a semi-semi-realized version of Monza.
### Monza Satalite Imagery and Heightmap Data.
This process was not very straightforward, but we had a goal that we wanted to follow.
Step 1 (Monza Satalite Imagery): After trying Google maps, earth pro, and a couple other websites, I was only able to find one site that could download satalite imagery with no account or setup [(here)](https://livingatlas.arcgis.com/wayback/#mapCenter=9.28770%2C45.61710%2C15&mode=explore&active=63116). I navigated to Monza on World Imagery Wayback, turned off the labels, and downloaded an image
Step 2 (Monza Height Imagery): This is the best heightmapping website online and I am very thankful for it [Tangrams](https://tangrams.github.io/heightmapper/). Although this is a great website, I had to learn were exactly Monza is on the globe and find it there. The map has small labels which I used to find matching looking roads to the Monza track. After navigating to Monza, I downloaded a heightmap image with and without labels.
Step 3 (Matching Height and Satalite Data Images): 
Although at this point I had the images I needed, they still were not ready. They needed to be properly scaled and Alligned. To do so I followed this process in ...  Powerpoint. 1: Add all 3 images to a new powerpoint. 2: Crop out the non track parts of each images. 3: With the satalite image in the background, put the labeled heightmap over it with 50% opacity. 4: Try your best to scale the images so all of the roads line up and are similaryl sized. 5: Apply the same transformations to the non-labeled heightmap. 6: Crop them all to the same size and then export the cropped Satalite and non-label Heightmap images.  

PUT THE IMAGES HERE CAM

### Processing Images
Once you have your images, they need to be turned into data that our program can use. 
To do so we put the images onto a non-dispalyed canvas, then row by row extracted the RGB values into a 2d array. While doing so, we had to skip some pixels so the total number of cubes matches the desired number of cubes to be rendered. 
This process results in a 2d array for both the height and satalite imagery. I also created a process to merge the 2 arrays for good accuracy. The merging process involves finding the best height to apply to a pixel. To do this, we approximate the heightmap pixel to the satalite pixel using ratios. Then, we look at the 4 closest height pixels for each satalite pixel. We then figure out what % of each height pixel matches to the satalite color pixel. Finally, we average over them to produce one final array with all of the data combined.

Small note: The image processing skips some pixels, so the interpolation is not used to full effect here. To improve the accuracy of the cubes, in the future I would Interpolate the full height and satalite images, and then shrink the array by averaging / meadianing the large resulting array. This was not done because holding the full images leads to arrs of around 3.3 million elements. 

### Rendering the scene
Once we had the arrays, I moved over to the code that was responsible for filling the buffer. Instead of making random colors, we assigned each of the cubes to be one of the members of the final array from the satalite and height data. 

# Level 3

# Level 4 
by Cameron
### Skybox
To create the skybox, I followed this [webGL Skybox Tutorial](https://webglfundamentals.org/webgl/lessons/webgl-skybox.html). After following the tutorial I was able to replicate the skybox program they made with a very sunny skybox I found online. 
Then, I had to port the skybox over to the level 4 program. I was really struggling with this for a while but I everntually learned a little bit more about how webGL programs work to resolve everything. 
I added the skybox shaders to a new program in level 4. I also filled a new buffer and set unique flags so that the program wouldn't have weird bugs or draw the skybox too close to the camera. Each frame that we drew, we were now drawing the skybox with it's own program, then updating the webGL program / buffer / flag information to be for the cube rendering function. This allowed me to combine two draw programs into one scene. 

### Movement Controls
At this point, I had made level 4 with a convincing representation of Monza, even a plesant skybox, but no good way to admire it. So, I made some controls for our game. 
To control the cameras position, use WASD for forward, backward, left and right. Then the up and down arrows for up and down movement. 
At first I would increment the X, Y, Z axis for movement, but it really only worked for flying upwards. 
To make the movement more related to the camera, instead of the X amd Z axis, I took the lesson we learned about how the camera worked, and found the rejection and the cross of the vectors that we used for the camera and the look at target. Changing the camera and look at position by these vectors made movement actually make sense visually and intuitively.

PICTURE OF WORK FROM CLASS

### Mouse Camera Controls
This was the only part of the project that I had AI Generate. This was something I did not know much about, but thought that it elevated our cube world and made it interactive so it stayed. 

# Future Work
Cameron: I am really interested in the performance side of things, so maximizing the FPS or number of cubes is something I would like to do. There are a ton of improvements I would like to make so I will list them off here: Camera with realistic acceleration and speed, complete image processing, more locations, reflective lighting that we learned in class.

# AI Disclosure
Cameron only used AI to make the mouse looking code. I did everything else myself & I am super proud of it!
