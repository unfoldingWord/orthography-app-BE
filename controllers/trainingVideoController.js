const BaseLanguage = require("../models/BaseLanguage");
const TrainingVideo = require("../models/TrainingVideo");
const User = require("../models/User");
const formidable = require("formidable");
const {uploadFile, deleteFile} = require("../utils/helper");
const fs = require("fs").promises;
const mongoose = require("mongoose");

const addTrainingVideo = async (req, res) => {
  try {
    console.log("Inside adding training video api");
    const form = new formidable.IncomingForm();

    const {fields, files} = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) {
          reject(err);
        } else {
          resolve({fields, files});
        }
      });
    });

    console.log({files});
    console.log({fields});

    const fileTypes = ["video/mp4"];
    const thumbnailFileTypes = ["image/jpeg", "image/png"];

    const videos = [];
    const errors = [];

    // Validate languageId
    if (!fields["languageId"] || !Array.isArray(fields["languageId"])) {
      errors.push(`Invalid or missing languageId`);
    }

    // Validate title
    if (!fields["title"] || !Array.isArray(fields["title"])) {
      errors.push(`Invalid or missing title`);
    }

    if (!fields["description"] || !Array.isArray(fields["description"])) {
      // Validate description
      errors.push(`Invalid or missing description`);
    }

    // Validate file
    if (!files.file || !Array.isArray(files.file)) {
      errors.push(`No file uploaded`);
    } else {
      for (let i = 0; i < files.file.length; i++) {
        const file = files.file[i];
        const languageId = fields["languageId"][i];
        const title = fields["title"][i];
        const description = fields["description"][i];
        const thumbnailFile = files.thumbnailFile && files.thumbnailFile[i];

        // Validate languageId
        if (!languageId || !mongoose.Types.ObjectId.isValid(languageId)) {
          errors.push(`Invalid languageId `);
          continue; // Continue to the next iteration
        }

        // Validate title (add more checks if needed)
        if (!title) {
          errors.push(`Invalid title`);
          continue; // Continue to the next iteration
        }

        if (title.length < 1 || title.length > 50) {
          errors.push(`Length of the title should be in range 1-50`);
        }

        // Validate description (add more checks if needed)
        if (!description) {
          errors.push(`Invalid description`);
          continue; // Continue to the next iteration
        }

        // Validate file
        if (!fileTypes.includes(file.mimetype)) {
          errors.push(`${file.originalFilename} - file type not supported`);
          continue; // Continue to the next iteration
        }

        // Validate thumbnail file
        if (!thumbnailFileTypes.includes(thumbnailFile.mimetype)) {
          errors.push(`${thumbnailFile.originalFilename} - file type not supported`);
          continue; // Continue to the next iteration
        }

        // Check if language exists
        const isLanguageExist = await BaseLanguage.findOne({
          _id: languageId,
        });

        console.log(isLanguageExist);
        if (!isLanguageExist) {
          errors.push(`Language does not exist with language id :${languageId}`);
          continue; // Continue to the next iteration
        }

        const data = await fs.readFile(file.filepath);
        console.log({data});

        // uploading to s3 and getting url
        const fileUrl = await uploadFile(`videos/${file.originalFilename}`, data);
        console.log("Uploading thumbnail file in s3");
        const thumbnailData = await fs.readFile(thumbnailFile.path || thumbnailFile._writeStream.path);
        const thumbnailFileUrl = await uploadFile(`videos/${thumbnailFile.originalFilename}`, thumbnailData);
        console.log(`thumbnailFileUrl:${thumbnailFileUrl}`);

        // save the document in the database
        const video = await TrainingVideo.create({
          fileUrl,
          fileName: file.originalFilename,
          title,
          description,
          thumbnailFileUrl,
          thumbnailFileName: thumbnailFile.originalFilename,
          baseLanguage: languageId,
        });

        console.log({video});
        videos.push(video);
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({message: "Validation errors", errors});
    }

    return res.status(200).json({message: "Video(s) saved successfully", data: videos});
  } catch (error) {
    return res.status(500).json({message: `Something went wrong : ${error}`});
  }
};

const getTrainingVideo = async (req, res) => {
  try {
    const languageCode = req.query.code;
    let query;

    // Check if language code exists
    if (languageCode) {
      // Find base language by code
      const baseLanguage = await BaseLanguage.findOne({
        code: {$regex: new RegExp("^" + languageCode + "$", "i")}, // Case-insensitive regex search
      }).exec();

      // If base language not found, return 404
      if (!baseLanguage || baseLanguage.length === 0) {
        return res.status(404).json({message: "Base Language not found."});
      }
      // Set query to filter by baseLanguage
      query = {baseLanguage: baseLanguage._id};
    } else {
      // If no language code provided, retrieve all training videos
      query = {};
    }

    // Find training videos based on query
    const result = await TrainingVideo.find(query).exec();

    // If no result found, return 404
    if (!result || result.length === 0) {
      return res.status(404).json({message: "Training Video not found."});
    }

    // Return success response with fetched data
    res.status(200).json({message: "Training Videos Fetched Successfully!", data: Array.isArray(result) ? result : [result]});
  } catch (error) {
    // Return error response if something went wrong
    return res.status(500).json({message: `Something went wrong : ${error}`});
  }
};

const deleteTrainingVideo = async (req, res) => {
  try {
    let _id = req.query._id;
    // Check if video id exists
    if (!_id) {
      return res.status(400).json({message: "Video id is required"});
    }

    // Find the training video by id
    const result = await TrainingVideo.findOne({_id: _id}).exec();
    // If video doesn't exist, return error
    if (!result) {
      return res.status(400).json({message: "Training Video doesn't exist"});
    }

    // Log the found video
    console.log(`Result:${JSON.stringify(result)}`);

    // Delete the video file
    const fileUrl = await deleteFile(`videos/${result.fileName}`);
    // Delete the thumbnail file
    const thumbnailFileUrl = await deleteFile(`videos/${result.thumbnailFileName}`);

    // Delete the video record from the database
    await TrainingVideo.deleteOne({_id});
    return res.status(200).json({message: "Training Video successfully deleted!"});
  } catch (error) {
    console.log(error);
    return res.status(500).json({message: `Something went wrong : ${error}`});
  }
};

const updateUserWatchStatus = async (req, res) => {
  try {
    const _id = req.body.userId;
    const status = req.body.status;

    console.log(`${_id} and ${status}`);

    // Check if userId is provided
    if (!_id) {
      return res.status(400).json({message: "userId is required in the request body"});
    }

    // Find user by id
    const result = await User.findOne({_id}).exec();

    // Check if user with given userId exists
    if (!result) {
      return res.status(400).json({message: `User with id:${_id} does not exist`});
    }

    // Check if status is a boolean
    if (typeof status !== "boolean") {
      return res.status(400).json({message: `Expected value is either (Boolean) true/false for the status field`});
    }

    // Define update object with the new status
    const update = {videosWatched: status};

    // Update user's videosWatched field
    // Use { new: true } to return the modified document rather than the original
    const updatedUser = await User.findOneAndUpdate({_id}, update, {new: true}).exec();

    return res.status(200).json({message: "User watch status updated", user: updatedUser});
  } catch (error) {
    console.log(error);
    return res.status(500).json({message: `Something went wrong : ${error}`});
  }
};

module.exports = {addTrainingVideo, getTrainingVideo, deleteTrainingVideo, updateUserWatchStatus};
