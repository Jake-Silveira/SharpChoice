const sharp = require('sharp');
const path = require('path');

// Define paths
const inputPath = path.join(__dirname, 'frontend/assets/profile.jpg');
const outputPath = path.join(__dirname, 'frontend/assets/profile_resized.jpg');

// Resize the image maintaining aspect ratio
async function resizeImage() {
  try {
    // Get original image metadata to understand dimensions
    const metadata = await sharp(inputPath).metadata();
    console.log(`Original dimensions: ${metadata.width}x${metadata.height}`);
    
    // Resize to a max width of 280px (as specified in CSS) while maintaining aspect ratio
    await sharp(inputPath)
      .resize(280, null, {
        fit: 'inside',  // Ensures the image fits within the specified dimensions while maintaining aspect ratio
        withoutEnlargement: true  // Prevents upscaling if image is smaller than target
      })
      .jpeg({ quality: 80 })  // Optimize for web
      .toFile(outputPath);
      
    console.log('Image resized successfully!');
    
    // Verify new dimensions
    const newMetadata = await sharp(outputPath).metadata();
    console.log(`New dimensions: ${newMetadata.width}x${newMetadata.height}`);
  } catch (error) {
    console.error('Error resizing image:', error);
  }
}

resizeImage();