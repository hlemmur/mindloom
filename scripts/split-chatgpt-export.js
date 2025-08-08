#!/usr/bin/env node

/**
 * Split large ChatGPT export files into smaller chunks for import
 * Usage: node scripts/split-chatgpt-export.js <input-file> [chunk-size-mb]
 */

const fs = require('fs');
const path = require('path');

function splitChatGPTExport(inputFile, chunkSizeMB = 8) {
  console.log(`Splitting ${inputFile} into ${chunkSizeMB}MB chunks...`);
  
  // Read and parse the large JSON file
  const content = fs.readFileSync(inputFile, 'utf8');
  console.log(`File size: ${Math.round(content.length / 1024 / 1024 * 100) / 100}MB`);
  
  let data;
  try {
    data = JSON.parse(content);
  } catch (error) {
    console.error('Error parsing JSON:', error.message);
    process.exit(1);
  }
  
  if (!Array.isArray(data)) {
    console.error('Expected an array of conversations at the root level');
    process.exit(1);
  }
  
  console.log(`Found ${data.length} conversations`);
  
  // Calculate target size per chunk in bytes
  const chunkSizeBytes = chunkSizeMB * 1024 * 1024;
  const outputDir = path.dirname(inputFile);
  const baseName = path.basename(inputFile, '.json');
  
  let chunkIndex = 1;
  let currentChunk = [];
  let currentSize = 2; // Start with array brackets: []
  
  for (let i = 0; i < data.length; i++) {
    const conversation = data[i];
    const conversationJson = JSON.stringify(conversation);
    const conversationSize = conversationJson.length + (currentChunk.length > 0 ? 1 : 0); // +1 for comma
    
    // If adding this conversation would exceed chunk size, write current chunk
    if (currentSize + conversationSize > chunkSizeBytes && currentChunk.length > 0) {
      writeChunk(outputDir, baseName, chunkIndex, currentChunk);
      chunkIndex++;
      currentChunk = [];
      currentSize = 2; // Reset to array brackets
    }
    
    currentChunk.push(conversation);
    currentSize += conversationSize;
  }
  
  // Write the final chunk if it has content
  if (currentChunk.length > 0) {
    writeChunk(outputDir, baseName, chunkIndex, currentChunk);
  }
  
  console.log(`Split into ${chunkIndex} chunks`);
}

function writeChunk(outputDir, baseName, chunkIndex, conversations) {
  const filename = `${baseName}_part_${chunkIndex}.json`;
  const filepath = path.join(outputDir, filename);
  
  fs.writeFileSync(filepath, JSON.stringify(conversations, null, 2));
  
  const sizeKB = Math.round(fs.statSync(filepath).size / 1024);
  console.log(`Created ${filename} (${sizeKB}KB, ${conversations.length} conversations)`);
}

// Main execution
const inputFile = process.argv[2];
const chunkSize = parseInt(process.argv[3]) || 8;

if (!inputFile) {
  console.log('Usage: node split-chatgpt-export.js <input-file> [chunk-size-mb]');
  console.log('Example: node split-chatgpt-export.js conversations.json 5');
  process.exit(1);
}

if (!fs.existsSync(inputFile)) {
  console.error(`File not found: ${inputFile}`);
  process.exit(1);
}

splitChatGPTExport(inputFile, chunkSize);