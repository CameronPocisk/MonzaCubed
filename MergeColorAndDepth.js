import heightmap from './src/MonzaHeightmapCropped.png'
import colorImage from './src/MonzaSataliteCropped.png'

function ratioImages(){
    console.log("Given a color and height image use both to create a landscape");

    // Array[row][col]
    // This will be a 4x7 'image'
    const colorImage = [
        [1, 2, 3, 4, 5, 6, 7],
        [8, 9, 10, 11, 12, 13, 14],
        [15, 16, 17, 18, 19, 20, 21],
        [22, 23, 24, 25, 26, 27, 28],
    ]
    // This will be a 3x5 height Map 
    const heightMap = [
        [100, 200, 300, 400, 500],
        [600, 700, 800, 900, 1000],
        [1100, 1200, 1300, 1400, 1500],
    ]

    // I am going to want heightMap to transform ontop of the color Image
    let colorHeightRowRatio = heightMap.length / colorImage.length;
    // Going to assume each row has same # cols so can take 0th of ea
    let colorHeightColRatio = heightMap[0].length / colorImage[0].length;
    console.log(`Row ratio: ${colorHeightRowRatio}, Col Ratio: ${colorHeightColRatio}`);
    
    // Also going to create these so I can step over both equally
    let heightRowItr = 0; // These are here to  
    let heightColItr = 0;

    // This process will involve itterating over the color map 1x1, and finding the corresponding height (Maybe avg)
    for(let row = 0; row < colorImage.length; row++){
        // Set according to the ratio, also do not step out of bounds
        heightRowItr = Math.round(row * colorHeightRowRatio);
        heightRowItr = Math.min(heightRowItr, colorImage.length -1);
        for(let col = 0; col < colorImage[row].length; col++){
            // Set according to the ratio, also do not step out of bounds
            heightColItr = Math.round(col * colorHeightColRatio);
            heightColItr = Math.min(heightColItr, colorImage[0].length -1);
            console.log(`Color: ${colorImage[row][col]} , Height: ${heightMap[heightRowItr][heightColItr]}`);
    
            // console.log(`row: ${row}, col: ${col}, color: ${colorImage[row][col]}, height: ${0}`)
        }
    }
}


function interpolateHeightToColor(heightIn = null, colorIn = null){
    // Instead of finding the corresponding height 
    // based on rounding the ratio of the images, 
    // This fn should chose some in between values 
    // So if the ratio does not fall on a height value,
    // Find some value based on where between values we are

    console.log("Interpolating the height map onto the color image");

    // Array[row][col]
    // This will be a 4x7 'image' (Laeving this in from ex)
    if(!colorIn){
        colorIn = [
            [1, 2, 3, 4, 5, 6, 7],
            [8, 9, 10, 11, 12, 13, 14],
            [15, 16, 17, 18, 19, 20, 21],
            [22, 23, 24, 25, 26, 27, 28],
        ]
    }
    const colorImage = colorIn;

    if(!heightIn){
        // This will be a 3x5 height Map 
        heightIn = [
            [100, 200, 300, 400, 500],
            [600, 700, 800, 900, 1000],
            [1100, 1200, 1300, 1400, 1500],
        ]
    }
    const heightmap = heightIn;


    // I am going to want heightMap to transform ontop of the color Image
    let colorHeightRowRatio = heightMap.length / colorImage.length;
    // Going to assume each row has same # cols so can take 0th of ea
    let colorHeightColRatio = heightMap[0].length / colorImage[0].length;
    console.log(`Row ratio: ${colorHeightRowRatio}, Col Ratio: ${colorHeightColRatio}`);
    
    // This process will involve itterating over the color map 1x1, and finding the corresponding height (Maybe avg)
    for(let row = 0; row < colorImage.length; row++){
        // Set according to the ratio, also do not step out of bounds
        for(let col = 0; col < colorImage[row].length; col++){
            
            // Set according to the ratio, also do not step out of bounds
            heightColItr = col * colorHeightColRatio;
            heightColItr = Math.min(heightColItr, colorImage[0].length -1);
            // Going to be using these a bunch                
            const maxRow = heightMap.length - 1;
            const maxCol = heightMap[0].length - 1;

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
                heightMap[row1Position][col1Position] * row1Percent * col1Percent +
                heightMap[row1Position][col2Position] * row1Percent * col2Percent +
                heightMap[row2Position][col1Position] * row2Percent * col1Percent +
                heightMap[row2Position][col2Position] * row2Percent * col2Percent;

            console.log(`Color: ${colorImage[row][col]}, Height: ${interpolatedValue} \n`);
            colorImage[row][col] = {color: colorImage[row][col], height: interpolatedValue};
        }
    }
    return colorImage;

}

// interpolateHeightToColor();
function PngTo2DArr(inputPng){
    var finalArr = [];

    // 1. Create an off-screen canvas and set its dimensions to match the image
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const width = imgElement.naturalWidth || imgElement.width;
    const height = imgElement.naturalHeight || imgElement.height;
    
    // 2. Draw the image onto the canvas and extract raw pixel data
    ctx.drawImage(imgElement, 0, 0);
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    
    // 3. Loop through rows (y) and columns (x) to reconstruct a 2D matrix
    for (let y = 0; y < height; y++) {
        const row = [];
        for (let x = 0; x < width; x++) {
            // Calculate the starting index of the 4-byte chunk for the current pixel
            const index = (y * width + x) * 4;
            
            const r = data[index];
            const g = data[index + 1];
            const b = data[index + 2];
            const a = data[index + 3];

            // Format the color output based on preference
            if (format === 'rgba-object') {
            row.push({ r, g, b, a });
            } else if (format === 'hex') {
            const hex = ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
            row.push(`#${hex}`);
            } else {
            row.push(`rgba(${r}, ${g}, ${b}, ${a / 255})`);
            }
        }

        finalArr.push(row);
    }

    return finalArr;
}

function main(){
    const colorImage2dArr = PngTo2DArr(heightmap);
    const heightMap2dArr = PngTo2DArr(colorImage);

    const final2dArr = interpolateHeightToColor(colorImage2dArr, heightMap2dArr);

}

main();