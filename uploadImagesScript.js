const fs = require("fs");
const path = require("path");
const axios = require("axios");
const FormData = require("form-data");

async function uploadFiles(apiUrl, folderPath, languageId) {
  // Read the contents of the folder
  const files = fs.readdirSync(folderPath);

  // Iterate through each file in the folder
  for (const filename of files) {
    // Constructing full path of the file
    const filePath = path.join(folderPath, filename);
    console.log(`filePath:${filePath}`);

    // Creating a formData object to hold file and other fields
    const formData = new FormData();

    // Append the file to the form data with the key "file"
    formData.append("file", fs.createReadStream(filePath));

    // Append the languageId to the form data
    formData.append("languageId", languageId);

    try {
      // Send POST request
      const response = await axios.post(apiUrl, formData);
      console.log(`Response: ${response.status} - ${response.statusText}`);
      console.log(response.data);
    } catch (error) {
      console.error(`Error uploading file ${filename}: ${error.message}`);
    }
  }
}

// Configure the server url here
const apiUrl = "http://localhost:3500/api/image/add";

// Upload the images to be uploaded in this folder
const folderPath = "./images/";

// Base language Id from the database needs to be put here
const languageId = "658d5ce55cc77305044b618a";

// Function to upload multiple files
uploadFiles(apiUrl, folderPath, languageId);
