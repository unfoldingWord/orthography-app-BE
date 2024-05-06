require("dotenv").config();
const AWS = require("aws-sdk");
const s3 = new AWS.S3();
const PDFDocument = require("pdfkit");
const axios = require("axios");
const Syllable = require("../models/Syllable");

// Function to upload a file to an S3 bucket
const uploadFile = async (filename, data) => {
  try {
    const params = {
      Bucket: process.env.BUCKET,
      Key: filename,
      Body: data,
    };

    // Upload the file to S3
    const uploadResponse = await s3.upload(params).promise();
    console.log("S3 upload successful:", uploadResponse);
    return uploadResponse.Location;
  } catch (error) {
    console.error("Error uploading file to S3:", error);
    throw error;
  }
};

// Function to delete a file from an S3 bucket
const deleteFile = async function (filename, data) {
  try {
    const params = {
      Bucket: process.env.BUCKET,
      Key: filename,
      Body: data,
    };

    const deleteResponse = await s3.deleteObject(params).promise();
    console.log("Successfully deleted file from bucket:", deleteResponse);
    return filename;
  } catch (error) {
    console.error("Error deleting file from S3:", error);
    throw error;
  }
};

// Function to generate a PDF document based on user data
const generatePdf = async function (userExists) {
  try {
    // Aggregate syllable data for the user from the database
    const letterGroupImages = await Syllable.aggregate([
      {
        $match: {user: userExists._id, skippedSyllable: false, grapheme: {$exists: true, $ne: null}},
      },
      {
        $lookup: {
          from: "orthoimages",
          localField: "orthoImage",
          foreignField: "_id",
          as: "imageInfo",
        },
      },

      {
        $group: {
          _id: "$grapheme",
          images: {
            $push: {
              imageObjectUrl: {$arrayElemAt: ["$imageInfo.fileUrl", 0]},
              syllableType: {
                $switch: {
                  branches: [
                    {case: {$eq: ["$syllableType", 1]}, then: "MONO SYLLABIC"},
                    {case: {$eq: ["$syllableType", 2]}, then: "BI SYLLABIC"},
                    {case: {$eq: ["$syllableType", 3]}, then: "TRI SYLLABIC"},
                    {case: {$and: [{$gte: ["$syllableType", 4]}, {$lte: ["$syllableType", 9]}]}, then: "POLY SYLLABIC"},
                  ],
                  default: "UNKNOWN",
                },
              },
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          letter: "$_id",
          images: {
            $filter: {
              input: "$images",
              as: "image",
              cond: {$ne: ["$$image", {}]}, // Exclude empty objects
            },
          },
        },
      },
      {
        $sort: {letter: 1}, // Sort alphabetically by the letter field
      },
    ]);

    // Create a new PDF document
    const doc = new PDFDocument();
    let letterCount = 0;
    let yCoordinate = 0;
    doc.fontSize(25).text("Alphabet Chart", {align: "center"});
    let totalImagesAdded = 0;

    for (const data of letterGroupImages) {
      const circleWidth = 64;
      const circleHeight = 64;
      const circleLeft = (doc.page.width - circleWidth) / 2; // Center horizontally
      let circleTop = 100;
      let circleX = circleLeft + circleWidth / 2;
      let circleY = circleTop + circleHeight / 2;

      let textX = circleX - 250 + 16; // Adjusted to consider the circle's radius
      let textY = circleY + 1; // Adjusted to consider the circle's radius

      let imagesInRow = 0;
      let imageCount = 0;
      let y = circleY + 100; // Adjust the gap between images
      // Add images with a black border
      doc.fillColor("#000000");
      if (letterCount >= 1) {
        circleTop = yCoordinate + 50;
        circleY = circleTop + circleHeight / 2;
        textY = circleY + 1;
        y = circleY + 100;
        doc.fontSize(20).font("Helvetica-Bold").text(data.letter, textX, textY, {align: "center", baseline: "middle"});
      } else {
        doc.fontSize(20).font("Helvetica-Bold").text(data.letter, textX, textY, {align: "center", baseline: "middle"});
      }

      for (const imageInfo of data.images) {
        let rectangleColor;
        console.log(`Fetching image: ${imageInfo.imageObjectUrl}`);

        const response = await axios.get(imageInfo.imageObjectUrl, {responseType: "arraybuffer", timeout: 10000, maxContentLength: 100000000});
        const imageS3Buffer = response.data;

        if (imageInfo.syllableType.startsWith("MONO")) {
          rectangleColor = "#EF7300"; // Orange
        } else if (imageInfo.syllableType.startsWith("BI")) {
          rectangleColor = "#1648CE"; // Blue
        } else if (imageInfo.syllableType.startsWith("TRI")) {
          rectangleColor = "#BC2FAE"; // Pink
        } else if (imageInfo.syllableType.startsWith("POLY")) {
          rectangleColor = "#EEAB00"; // Yellow
        } else {
          rectangleColor = "#889DB0"; // Default color
        }

        if (imagesInRow == 2) {
          imagesInRow = 0;
          y += 200;
          imageCount = 0;
        }

        let imageY = y - 50; // Y position of the image
        // Check if the rectangle fits within the available space
        const rectangleHeight = 200; // Height of the rectangle
        const availableSpace = doc.page.height - y; // Available space from the current position to the bottom of the page

        if (availableSpace < rectangleHeight) {
          // Not enough space, create a new page
          doc.addPage();
          y = 100; // Reset y position for the new page
        }

        const imageX = circleX + imageCount * 240 - 208; // X position of the image
        imageY = y - 50;
        const imageWidth = 100; // Width of the image
        const imageHeight = 100; // Height of the image
        const cornerRadius = 5;

        // Load and center the image within the box
        const imageWidthHalf = imageWidth / 2;
        const imageHeightHalf = imageHeight / 2;

        // Calculate the position to center the image within the box
        const centeredImageX = imageX + (imageWidthHalf - 25) + 20; // Adjust for centering
        const centeredImageY = imageY + (imageHeightHalf - 25) - 10; // Adjust for centering

        // Draw a rectangle around the image to create a border
        doc.roundedRect(imageX, imageY, 180, 164, cornerRadius).lineWidth(1.0).stroke("#889DB0"); // Apply a grey

        // Draw the image
        doc.image(imageS3Buffer, centeredImageX, centeredImageY, {width: 90, height: 90});

        // Add syllable text inside the same box
        const syllableY = imageY + 164 - 36 / 2; // Adjust the vertical position to center the text frame
        doc.roundedRect(imageX, syllableY - 36 / 2, 180, 40).fillAndStroke(rectangleColor, rectangleColor); // Fill and stroke the text frame

        // Add the syllable text inside the rectangle, centered both horizontally and vertically
        doc
          .fontSize(12)
          .fillColor("#000")
          .text(imageInfo.syllableType, imageX + 41, imageY + 142);

        imagesInRow++;
        imageCount++;
        totalImagesAdded++;
        yCoordinate = syllableY;
      }
      letterCount++;
    }

    const pdfBuffer = await new Promise((resolve, reject) => {
      const chunks = [];
      doc.on("data", chunk => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.end();
    });

    const now = new Date();
    const timestamp = now.toISOString().replace(/[:-]/g, "").replace("T", "_").split(".")[0];
    const fileName = `AlphabetChart_${userExists._id}_${timestamp}.pdf`;
    const pdfUrl = await uploadFile(`pdf/${fileName}`, pdfBuffer);
    console.log(`PDF saved`);
    return pdfUrl;
  } catch (error) {
    console.log({error});
    throw error;
  }
};

const isExistsChecker = async (model, query) => {
  try {
    const isExists = await model.findOne(query);
    return isExists;
  } catch (error) {
    console.log({error});
    throw error;
  }
};

module.exports = {uploadFile, deleteFile, isExistsChecker, generatePdf};
