// To lower the used memory render a reasonable amount of cubes,
// we want to return a certian number of cubes
const targetNumCubes = 10000; // Reasonable amount of cubes to render
function imageToPixels2D(img) {
    // Need a canvas to get the data
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    // Avoids a crazy load time
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    // Get the data, width, and height from the ctx
    const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // Get a x and y multiple to skip over cubes
    const curToTargetCubesRatio = (canvas.width * canvas.height) / targetNumCubes ;
    const newWidth = width / Math.sqrt(curToTargetCubesRatio);
    const newHeight = height / Math.sqrt(curToTargetCubesRatio);
    const widthSkip = width / newWidth;
    const heightSkip = height / newHeight; 
    // Make sure we all good
    // console.log(`
    //     newWidth: ${newWidth} 
    //     newHeight: ${newHeight}
    //     wSkip:${widthSkip}
    //     hSkip:${heightSkip}`);

    // Standard itteration resulting in values like: pixels[y][x] = { r, g, b, a }
    const pixels = [];
    for (let y = 0; y < height; y += heightSkip){
        const row = [];
        for (let x = 0; x < width; x += widthSkip) {
            const i = (Math.round(y) * width + Math.round(x)) * 4;
            row.push({ r: data[i], g: data[i + 1], b: data[i + 2], a: data[i + 3] });
        }
        pixels.push(row);
    }

    return pixels;
}

function getHeightNormal(heightFromArr){
    var heightValue = (heightFromArr.r/255 + heightFromArr.g/255 + heightFromArr.b/255)/3;
    return heightValue;
}

// This may be slightly faster for the arrs lol 
function ratioImages(colorIn, heightIn){
    console.log("Given a color and height image use both to create a landscape");
    if(!colorIn || !heightIn){
        console.error("2d Arr input was null");
        return;
    }

    // I am going to want heightIn to transform ontop of the color Image
    let colorHeightRowRatio = heightIn.length / colorIn.length;
    // Going to assume each row has same # cols so can take 0th of ea
    let colorHeightColRatio = heightIn[0].length / colorIn[0].length;
    // console.log(`Row ratio: ${colorHeightRowRatio}, Col Ratio: ${colorHeightColRatio}`);
    
    // Also going to create these so I can step over both equally
    let heightRowItr = 0; // These are here to  
    let heightColItr = 0;

    // This process will involve itterating over the color map 1x1, and finding the corresponding height (Maybe avg)
    for(let row = 0; row < colorIn.length; row++){
        // Set according to the ratio, also do not step out of bounds
        heightRowItr = Math.round(row * colorHeightRowRatio);
        heightRowItr = Math.min(heightRowItr, colorIn.length -1);
        for(let col = 0; col < colorIn[row].length; col++){
            // Set according to the ratio, also do not step out of bounds
            heightColItr = Math.round(col * colorHeightColRatio);
            heightColItr = Math.min(heightColItr, colorIn[0].length -1);
            
            // console.log(`Color: ${colorIn[row][col]} , Height: ${heightIn[heightRowItr][heightColItr]}`);
            // console.log(`row: ${row}, col: ${col}, color: ${colorIn[row][col]}, height: ${0}`);
            // colorIn[row][col] = {color: colorIn[row][col], height: heightIn[heightRowItr][heightColItr]} 
            var color = colorIn[row][col];
            var height = heightIn[heightRowItr][heightColItr];
            var heightValue = (height.r/255 + height.g/255 + height.b/255)/3;
            colorIn[row][col] = {
                r: color.r/255,
                g: color.g/255,
                b: color.b/255,
                height: heightValue
            } 
        }
    }
    return colorIn;
}



// Adding the interpolation code to make a final arr
function interpolateHeightToColor(colorIn, heightIn){
    // Instead of finding the corresponding height 
    // based on rounding the ratio of the images, 
    // This fn should chose some in between values 
    // So if the ratio does not fall on a height value,
    // Find some value based on where between values we are

    console.log("Interpolating the height map onto the color image");

    // Array[row][col]
    // This will be a 4x7 'image' (Leaving this in from ex)
    if(!colorIn ||!heightIn ){
        console.error("Color Image or HeightmapIn was null");
        return;
    }


    // I am going to want heightIn to transform ontop of the color Image
    var colorHeightRowRatio = heightIn.length / colorIn.length;
    // Going to assume each row has same # cols so can take 0th of ea
    var colorHeightColRatio = heightIn[0].length / colorIn[0].length;
    // console.log(`Row ratio: ${colorHeightRowRatio}, Col Ratio: ${colorHeightColRatio}`);
    
    // This process will involve itterating over the color map 1x1, and finding the corresponding height (Maybe avg)
    for(let row = 0; row < colorIn.length; row++){
        // Set according to the ratio, also do not step out of bounds
        for(let col = 0; col < colorIn[row].length; col++){
            
            // Going to be using these a bunch                
            const maxRow = heightIn.length - 1;
            const maxCol = heightIn[0].length - 1;

            // Decmial spot in the map
            const rowPos = Math.min(row * colorHeightRowRatio, maxRow);
            const colPos = Math.min(col * colorHeightColRatio, maxCol);

            // The four surrounding positions
            const row1Position = Math.floor(rowPos);
            const row2Position = Math.min(row1Position + 1, maxRow);
            const col1Position = Math.floor(colPos);
            const col2Position = Math.min(col1Position + 1, maxCol);

            // How far we are between them (0 to 1)
            const rowFrac = rowPos - row1Position;
            const colFrac = colPos - col1Position;

            const row1Percent = 1 - rowFrac;
            const row2Percent = rowFrac;
            const col1Percent = 1 - colFrac;
            const col2Percent = colFrac;

            // I think combining them like this is right, my tests seem to work too
            const interpolatedValue =
                getHeightNormal(heightIn[row1Position][col1Position]) * row1Percent * col1Percent +
                getHeightNormal(heightIn[row1Position][col2Position]) * row1Percent * col2Percent +
                getHeightNormal(heightIn[row2Position][col1Position]) * row2Percent * col1Percent +
                getHeightNormal(heightIn[row2Position][col2Position]) * row2Percent * col2Percent;

            var color = colorIn[row][col];
            colorIn[row][col] = {
                r: color.r/255,
                g: color.g/255,
                b: color.b/255,
                height: interpolatedValue
            } 
        }
    }
    // Idk if we haveee to do this, but I want to make sure these huge things arent getting in the way
    return colorIn; // Since we are keeping these Dims, I just set the values to override / add the height
}

// Alternate method to load the values into arrs
// var satalite2dArr = null;
// var heightmap2dArr = null;
// SataliteImg.onload = () => {
//     satalite2dArr = imageToPixels2D(SataliteImg);
//     console.log(satalite2dArr[0][0]);
// };

async function main(){

    // Get the images as 2d Arrs (Needs to be on liveserver ig)
    // Should I export a text file of the arrs or something? 
    console.log("getting the arrs");
    const sataliteImg = new Image();
    sataliteImg.src = "assets/MonzaSataliteMoreCropped.png";
    await sataliteImg.decode();
    const satalite2dArr = imageToPixels2D(sataliteImg);
    console.log(satalite2dArr);

    const heightmapImg = new Image();
    heightmapImg.src = "assets/MonzaHeightmapMoreCropped.png";
    await heightmapImg.decode();
    const heightmap2dArr = imageToPixels2D(heightmapImg);
    console.log(heightmap2dArr);
    // At this point, we have the 2d Arrs like this [row][col] = {{r,g,b,a}, height}
    
    // Then we are going to interpolate (?) the height onto the satalite imagery
    const sataliteHeight2dArr = ratioImages(satalite2dArr, heightmap2dArr)
    // const sataliteHeight2dArr = interpolateHeightToColor(satalite2dArr, heightmap2dArr)
    console.log(sataliteHeight2dArr);
}
// main();

export async function getFinalArrFromAssets(colorImageStr, heightmapStr, useInterpolation = true){
    // Get the images as 2d Arrs (Needs to be on liveserver ig)
    // Should I export a text file of the arrs or something? 
    console.log("getting the arrs");
    const colorImage = new Image();
    colorImage.src = colorImageStr;
    await colorImage.decode();
    const satalite2dArr = imageToPixels2D(colorImage);
    // console.log(satalite2dArr);

    const heightmapImg = new Image();
    heightmapImg.src = heightmapStr;
    await heightmapImg.decode();
    const heightmap2dArr = imageToPixels2D(heightmapImg);
    // console.log(heightmap2dArr);
    
    // At this point, we have the 2d Arrs like this [row][col] = {{r,g,b,a}, height}
    // Then we are going to interpolate (?) the height onto the satalite imagery
    if(useInterpolation){
        const sataliteHeight2dArr = interpolateHeightToColor(satalite2dArr, heightmap2dArr)
        // console.log(sataliteHeight2dArr);
        return sataliteHeight2dArr;
    }
    else{
        const sataliteHeight2dArr = ratioImages(satalite2dArr, heightmap2dArr)
        // console.log(sataliteHeight2dArr);
        return sataliteHeight2dArr;
    }
}