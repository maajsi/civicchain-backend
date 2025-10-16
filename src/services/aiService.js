const axios = require('axios');
const fs = require('fs');
require('dotenv').config();

/**
 * Call Roboflow AI service for image classification
 * @param {string} imagePath - Path to the image file
 * @returns {Promise<string>} Detected category
 */
async function classifyImageWithAI(imagePath) {
  try {
    const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:9001';
    const roboflowEndpoint = process.env.ROBOFLOW_ENDPOINT || '/civic-issue-yljwt/2';
    
    // Read image and convert to base64
    const imageBase64 = fs.readFileSync(imagePath, { encoding: 'base64' });
    
    // Call Roboflow API with API key
    const roboflowApiKey = process.env.ROBOFLOW_API_KEY;
    const response = await axios({
      method: 'POST',
      url: `${aiServiceUrl}${roboflowEndpoint}?api_key=${roboflowApiKey}`,
      data: imageBase64,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      timeout: 30000 // 30 second timeout
    });
    
    const predictions = response.data.predictions;
    
    // If no predictions, return "other"
    if (!predictions || predictions.length === 0) {
      console.log('No predictions found, returning "other"');
      return 'other';
    }
    
    // Get unique classes
    const uniqueClasses = [...new Set(predictions.map(p => p.class))];
    
    // If more than one class type, return the one with highest confidence
    if (uniqueClasses.length > 1) {
      const highestConfidencePrediction = predictions.reduce((max, p) => 
        p.confidence > max.confidence ? p : max
      , predictions[0]);
      
      console.log(`Multiple classes detected. Highest confidence: ${highestConfidencePrediction.class} (${highestConfidencePrediction.confidence})`);
      return normalizeCategory(highestConfidencePrediction.class);
    }
    
    // Single class type - return it
    const detectedClass = predictions[0].class;
    console.log(`Single class detected: ${detectedClass} (confidence: ${predictions[0].confidence})`);
    return normalizeCategory(detectedClass);
    
  } catch (error) {
    console.error('AI classification error:', error.message);
    
    // If AI service is unavailable, return "other" as fallback
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      console.warn('AI service unavailable, falling back to "other"');
      return 'other';
    }
    
    throw error;
  }
}

/**
 * Normalize AI detected class to our category enum
 * @param {string} aiClass - Class detected by AI
 * @returns {string} Normalized category
 */
function normalizeCategory(aiClass) {
  const categoryMap = {
    'pothole': 'pothole',
    'potholes': 'pothole',
    'garbage': 'garbage',
    'trash': 'garbage',
    'waste': 'garbage',
    'streetlight': 'streetlight',
    'street_light': 'streetlight',
    'light': 'streetlight',
    'water': 'water',
    'water_leak': 'water',
    'water_main': 'water'
  };
  
  const normalized = aiClass.toLowerCase().trim();
  return categoryMap[normalized] || 'other';
}

module.exports = {
  classifyImageWithAI,
  normalizeCategory
};
