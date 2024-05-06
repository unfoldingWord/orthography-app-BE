const BaseLanguage = require("../models/BaseLanguage");
const OrthoImage = require("../models/OrthoImage");
const User = require("../models/User");
const formidable = require("formidable");
const {uploadFile, deleteFile} = require("../utils/helper");
const TrainingVideo = require("../models/TrainingVideo");
const Syllable = require("../models/Syllable");
const fs = require("fs").promises;
const mongoose = require("mongoose");
const ModuleProgress = require("../models/ModuleProgress");
const SoundGroup = require("../models/SoundGroup");
// const sharp = require("sharp");

const addOrthoImage = async (req, res) => {
  try {
    console.log("Inside adding training image API");
    const form = new formidable.IncomingForm();

    // Parse incoming form data
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

    const fileTypes = ["image/jpeg", "image/png", "image/svg+xml"];

    const images = [];
    const error = [];

    // Validate fields and files
    if (!fields["languageId"] || !Array.isArray(fields["languageId"])) {
      error.push(`Invalid or missing languageId`);
    } else {
      for (let i = 0; i < fields["languageId"].length; i++) {
        const languageId = fields["languageId"][i];
        const file = files.file && files.file[i];

        // Validate languageId
        if (!languageId || !mongoose.Types.ObjectId.isValid(languageId)) {
          error.push(`Invalid languageId`);
          continue; // Continue to the next iteration
        }

        // Validate file
        if (!file) {
          error.push(`No file uploaded`);
          continue; // Continue to the next iteration
        }

        console.log(`File type; ${file.mimetype}`);
        if (!fileTypes.includes(file.mimetype)) {
          error.push(`${file.originalFilename} - file type not supported`);
          continue; // Continue to the next iteration
        }

        // Check if language exists
        const isLanguageExist = await BaseLanguage.findOne({
          _id: languageId,
        });

        console.log(isLanguageExist);
        if (!isLanguageExist) {
          error.push(`Language does not exist`);
          continue; // Continue to the next iteration
        }

        const data = await fs.readFile(file.filepath);
        console.log({data});
        const fileUrl = await uploadFile(`images/${file.originalFilename}`, data);
        console.log("File uploaded on S3!!");

        const image = await OrthoImage.create({
          fileUrl,
          fileName: file.originalFilename,
          baseLanguage: languageId,
        });

        console.log({image});
        images.push(image);
      }
    }

    if (error.length > 0) {
      return res.status(400).json({message: "Validation error", error});
    }

    // Fetch all users with the same baseLanguageId
    const usersWithSameLanguage = await User.find({baseLanguage: fields["languageId"][0]});

    // Update progress counts for each user
    for (const user of usersWithSameLanguage) {
      await updateProgressCounts(user._id, fields["languageId"][0]);
      await checkAndUpdateSoundGroupingModule(user._id, fields["languageId"][0]);
      await checkAndUpdateSoundGroupsModule(user._id, fields["languageId"][0]);
      await checkAndUpdateAssignLettersModule(user._id, fields["languageId"][0]);
      await checkAndUpdateLetterGroupsModule(user._id, fields["languageId"][0]);
      await checkAndUpdateAlphabetChartModule(user._id, fields["languageId"][0]);
    }

    return res.status(200).json({message: "Image(s) saved successfully", data: images});
  } catch (error) {
    console.error(`Error adding ortho image: ${error}`);
    return res.status(500).json({message: "Something went wrong"});
  }
};

// Function to update progress counts for various modules
const updateProgressCounts = async (userId, baseLanguageId) => {
  // Update progress counts for "Identify Syllables" module
  await updateIdentifySyllableProgress(userId, baseLanguageId);
  await updateSyllableGroupProgress(userId, baseLanguageId);

  // Update progress counts for "Sound Grouping" module
  await updateSoundGroupingProgress(userId, baseLanguageId);
  await updateSoundGroupsProgress(userId, baseLanguageId);

  //Update progress counts for "Assign Letter" module
  await updateAssignLettersProgress(userId, baseLanguageId);
  await updateLetterGroupsProgress(userId, baseLanguageId);

  //Update progress counts for "Alphabet Chart" module
  await updateAlphabetChartProgress(userId, baseLanguageId);
};

// Function to update progress counts for "Identify Syllables" module
const updateIdentifySyllableProgress = async (userId, baseLanguageId) => {
  const query = {syllableType: {$ne: 0}, skippedSyllable: false};

  await updateModuleProgress(userId, baseLanguageId, "Identify Syllables", query);
};

// Function to update progress counts for "Syllable Groups" module
const updateSyllableGroupProgress = async (userId, baseLanguageId) => {
  const query = {syllableType: {$ne: 0}, skippedSyllable: false};

  await updateModuleProgress(userId, baseLanguageId, "Syllable Groups", query);
};

// Function to update progress counts for "Sound Grouping" module
const updateSoundGroupingProgress = async (userId, baseLanguageId) => {
  const query = {syllableType: {$ne: 0}, soundGroup: {$exists: true, $ne: null}, skippedSyllable: false, skippedSoundGroup: false};

  await updateModuleProgress(userId, baseLanguageId, "Sound Grouping", query);
};

// Function to update progress counts for "Sound Groups" module
const updateSoundGroupsProgress = async (userId, baseLanguageId) => {
  const query = {syllableType: {$ne: 0}, soundGroup: {$exists: true, $ne: null}, skippedSyllable: false, skippedSoundGroup: false};

  await updateModuleProgress(userId, baseLanguageId, "Sound Groups", query);
};

// Function to update progress counts for "Assign Letters" module
const updateAssignLettersProgress = async (userId, baseLanguageId) => {
  const query = {grapheme: {$exists: true, $ne: null}};

  await updateModuleProgress(userId, baseLanguageId, "Assign Letters", query);
};

// Function to update progress counts for "Letter Groups" module
const updateLetterGroupsProgress = async (userId, baseLanguageId) => {
  const query = {grapheme: {$exists: true, $ne: null}};

  await updateModuleProgress(userId, baseLanguageId, "Letter Groups", query);
};

// Function to update progress counts for "Alphabet Chart" module
const updateAlphabetChartProgress = async (userId, baseLanguageId) => {
  const query = {grapheme: {$exists: true, $ne: null}};

  await updateModuleProgress(userId, baseLanguageId, "Alphabet Chart", query);
};

const updateModuleProgress = async (userId, baseLanguageId, moduleName, query) => {
  try {
    // Count total number of images for the given base language
    const totalImagesCount = await OrthoImage.countDocuments({baseLanguage: baseLanguageId});
    console.log(`totalImagesCount:${totalImagesCount}`);

    // Count completed images based on user and additional query
    const completedImagesCount = await Syllable.countDocuments({user: userId, ...query});
    console.log(`completedImagesCount:${completedImagesCount}`);

    // Calculate percentage completion
    const percentageComplete = parseInt(totalImagesCount) === 0 ? 0 : (completedImagesCount / totalImagesCount) * 100;
    console.log(`percentageComplete:${percentageComplete}`);

    let skippedImages;

    // Count skipped images based on module type
    const skippedSyllableImages = await Syllable.countDocuments({user: userId, skippedSyllable: {$eq: true}});

    const skippedSoundGroup = await Syllable.countDocuments({user: userId, skippedSoundGroup: {$eq: true}});

    const skippedGrapheme = await Syllable.countDocuments({user: userId, skippedGrapheme: {$eq: true}});

    // Assign skipped images based on module name
    if (moduleName === "Identify Syllables" || moduleName === "Syllable Groups") {
      skippedImages = skippedSyllableImages;
    } else if (moduleName === "Sound Grouping" || moduleName === "Sound Groups") {
      skippedImages = skippedSoundGroup;
    } else if (moduleName === "Assign Letters" || moduleName === "Letter Groups" || moduleName === "Alphabet Chart") {
      skippedImages = skippedGrapheme;
    }

    // Prepare data for updating module progress
    const updateData = {
      totalImages: totalImagesCount,
      completedImages: completedImagesCount,
      incompletedImages: totalImagesCount - completedImagesCount,
      percentageCompleted: percentageComplete,
      skippedImages: skippedImages,
      isOpen: moduleName === "Identify Syllables" || completedImagesCount > 0,
    };

    console.log(`Updating data for user:${userId}, ${JSON.stringify(updateData)}`);

    // Update module progress in the database
    await ModuleProgress.findOneAndUpdate({user: userId, module: moduleName, baseLanguage: baseLanguageId}, {$set: updateData}, {new: true}).exec();
  } catch (error) {
    console.error(`Error updating progress for ${moduleName}: ${error}`);
    throw new Error(`Error updating progress for ${moduleName}`);
  }
};

// Check and update Sound Grouping module based on completion percentage
const checkAndUpdateSyllableGroupsModule = async (userId, baseLanguageId) => {
  const identifySyllablesModule = await ModuleProgress.findOne({
    user: userId,
    baseLanguage: baseLanguageId,
    module: "Identify Syllables",
  }).exec();

  const syllableModule = await ModuleProgress.findOne({
    user: userId,
    baseLanguage: baseLanguageId,
    module: "Syllable Groups",
  }).exec();

  if (identifySyllablesModule) {
    if (identifySyllablesModule.completedImages > 0) {
      await ModuleProgress.findOneAndUpdate(
        {
          _id: syllableModule._id,
        },
        {$set: {isOpen: true}},
        {new: true}
      ).exec();
    } else {
      await ModuleProgress.findOneAndUpdate(
        {
          _id: syllableModule._id,
        },
        {$set: {isOpen: false}},
        {new: true}
      ).exec();
    }
  }
};

// Check and update Sound Grouping module based on completion percentage
const checkAndUpdateSoundGroupingModule = async (userId, baseLanguageId) => {
  const soundGroupingModule = await ModuleProgress.findOne({
    user: userId,
    baseLanguage: baseLanguageId,
    module: "Sound Grouping",
  }).exec();

  const syllableModule = await ModuleProgress.findOne({
    user: userId,
    baseLanguage: baseLanguageId,
    module: "Syllable Groups",
  }).exec();

  if (soundGroupingModule) {
    const percentageComplete = (syllableModule.completedImages / soundGroupingModule.totalImages) * 100;
    if (percentageComplete >= 50 && syllableModule.isOpen === true) {
      await ModuleProgress.findOneAndUpdate(
        {
          _id: soundGroupingModule._id,
        },
        {$set: {isOpen: true}},
        {new: true}
      ).exec();
    } else {
      await ModuleProgress.findOneAndUpdate(
        {
          _id: soundGroupingModule._id,
        },
        {$set: {isOpen: false}},
        {new: true}
      ).exec();
    }
  }
};

// Check and update Sound Groups module based on whether at least one Sound Group is assigned
const checkAndUpdateSoundGroupsModule = async (userId, baseLanguageId) => {
  const soundGroupModule = await ModuleProgress.findOne({
    user: userId,
    baseLanguage: baseLanguageId,
    module: "Sound Groups",
  }).exec();

  const soundGroupingModule = await ModuleProgress.findOne({
    user: userId,
    baseLanguage: baseLanguageId,
    module: "Sound Grouping",
  }).exec();

  const soundGroupAssigned = await Syllable.exists({
    user: userId,
    soundGroup: {$exists: true, $ne: null},
  }).exec();

  if (soundGroupModule) {
    if (soundGroupAssigned && soundGroupingModule.isOpen === true) {
      await ModuleProgress.findOneAndUpdate(
        {
          _id: soundGroupModule._id,
        },
        {$set: {isOpen: true}},
        {new: true}
      ).exec();
    } else {
      await ModuleProgress.findOneAndUpdate(
        {
          _id: soundGroupModule._id,
        },
        {$set: {isOpen: false}},
        {new: true}
      ).exec();
    }
  }
};

// Check and update Assign Letters module based on completion percentage
const checkAndUpdateAssignLettersModule = async (userId, baseLanguageId) => {
  const assignLettersModule = await ModuleProgress.findOne({
    user: userId,
    baseLanguage: baseLanguageId,
    module: "Assign Letters",
  }).exec();

  const soundModule = await ModuleProgress.findOne({
    user: userId,
    baseLanguage: baseLanguageId,
    module: "Sound Groups",
  }).exec();

  if (assignLettersModule) {
    const percentageComplete = (soundModule.completedImages / soundModule.totalImages) * 100;
    if (percentageComplete >= 10 && soundModule.isOpen === true) {
      await ModuleProgress.findOneAndUpdate(
        {
          _id: assignLettersModule._id,
        },
        {$set: {isOpen: true}},
        {new: true}
      ).exec();
    } else {
      await ModuleProgress.findOneAndUpdate(
        {
          _id: assignLettersModule._id,
        },
        {$set: {isOpen: false}},
        {new: true}
      ).exec();
    }
  }
};

// Check and update Letter Groups module based on whether at least one grapheme is assigned
const checkAndUpdateLetterGroupsModule = async (userId, baseLanguageId) => {
  const assignLettersModule = await ModuleProgress.findOne({
    user: userId,
    baseLanguage: baseLanguageId,
    module: "Letter Groups",
  }).exec();

  const soundModule = await ModuleProgress.findOne({
    user: userId,
    baseLanguage: baseLanguageId,
    module: "Sound Groups",
  }).exec();

  const assignLetterGroupAssigned = await Syllable.exists({
    user: userId,
    grapheme: {$exists: true, $ne: null},
  }).exec();

  if (assignLettersModule) {
    if (assignLetterGroupAssigned && soundModule.isOpen === true) {
      await ModuleProgress.findOneAndUpdate(
        {
          _id: assignLettersModule._id,
        },
        {$set: {isOpen: true}},
        {new: true}
      ).exec();
    } else {
      await ModuleProgress.findOneAndUpdate(
        {
          _id: assignLettersModule._id,
        },
        {$set: {isOpen: false}},
        {new: true}
      ).exec();
    }
  }
};

const checkAndUpdateAlphabetChartModule = async (userId, baseLanguageId) => {
  const assignLettersModule = await ModuleProgress.findOne({
    user: userId,
    baseLanguage: baseLanguageId,
    module: "Alphabet Chart",
  }).exec();

  const soundModule = await ModuleProgress.findOne({
    user: userId,
    baseLanguage: baseLanguageId,
    module: "Sound Groups",
  }).exec();

  const assignLetterGroupAssigned = await Syllable.exists({
    user: userId,
    grapheme: {$exists: true, $ne: null},
  }).exec();

  if (assignLettersModule) {
    if (assignLetterGroupAssigned && soundModule.isOpen === true) {
      await ModuleProgress.findOneAndUpdate(
        {
          _id: assignLettersModule._id,
        },
        {$set: {isOpen: true}},
        {new: true}
      ).exec();
    } else {
      await ModuleProgress.findOneAndUpdate(
        {
          _id: assignLettersModule._id,
        },
        {$set: {isOpen: false}},
        {new: true}
      ).exec();
    }
  }
};

const deleteOrthoImage = async (req, res) => {
  try {
    // Extracting _id from query parameters
    const _id = req.query._id;

    // Find the orthoImage record by _id
    const orthoImage = await OrthoImage.findOne({_id}).exec();

    // If orthoImage doesn't exist, return error response
    if (!orthoImage) {
      return res.status(400).json({message: "Image doesn't exist"});
    }

    console.log(`OrthoImage: ${JSON.stringify(orthoImage)}`);

    // Delete the OrthoImage record
    await OrthoImage.deleteOne({_id});

    // Delete related entries in the Syllable table
    await Syllable.deleteMany({orthoImage: orthoImage._id});

    // Delete related entries in the Sound Group table
    await SoundGroup.deleteMany({orthoImage: orthoImage._id});

    // Update progress counts for users with the same base language
    const usersWithSameLanguage = await User.find({baseLanguage: orthoImage.baseLanguage});

    // Update progress counts for each user
    for (const user of usersWithSameLanguage) {
      await updateProgressCounts(user._id, orthoImage.baseLanguage);
      await checkAndUpdateSyllableGroupsModule(user._id, orthoImage.baseLanguage);
      await checkAndUpdateSoundGroupingModule(user._id, orthoImage.baseLanguage);
      await checkAndUpdateSoundGroupsModule(user._id, orthoImage.baseLanguage);
      await checkAndUpdateAssignLettersModule(user._id, orthoImage.baseLanguage);
      await checkAndUpdateLetterGroupsModule(user._id, orthoImage.baseLanguage);
      await checkAndUpdateAlphabetChartModule(user._id, orthoImage.baseLanguage);
    }

    // Delete the image file from storage
    const fileUrl = await deleteFile(`images/${orthoImage.fileName}`);

    return res.status(200).json({message: "Image successfully deleted!"});
  } catch (error) {
    console.error(`Error deleting ortho image: ${error}`);
    return res.status(500).json({message: "Something went wrong"});
  }
};

const getOrthoImage = async (req, res) => {
  try {
    const code = req.query.code;
    const userId = req.query.userId;

    //Check if user exists
    const userExists = await User.findOne({_id: userId});
    if (!userExists) {
      return res.status(404).json({message: "User doesn't exists!"});
    }

    //Check if base language exists
    const baseLanguage = await BaseLanguage.findOne({
      code: {$regex: new RegExp("^" + code + "$", "i")},
    }).exec();

    if (!baseLanguage) {
      return res.status(404).json({message: "Base Language not found."});
    }

    // Check if base language for user exists
    if (!userExists.baseLanguage) {
      return res.status(400).json({message: `Base language for this user doesn't exists.`});
    }

    //Fetch all images for the base language
    const orthoImages = await OrthoImage.find({baseLanguage: baseLanguage._id})
      // .skip((page - 1) * pageSize)
      // .limit(pageSize)
      .exec();

    console.log(`orthoImages:${orthoImages}`);

    if (!orthoImages || orthoImages.length === 0) {
      return res.status(404).json({message: "Images not found."});
    }

    // Find syllable assignments for the specified userId
    const syllables = await Syllable.find({user: userId}).exec();

    // Create maps to easily access syllable information based on imageId
    const skippedMap = new Map(syllables.filter(s => s.skippedSyllable === true).map(s => [s.orthoImage.toString(), true]));

    const completedMap = new Map(syllables.filter(s => s.syllableType !== 0).map(s => [s.orthoImage.toString(), true]));

    const totalYetToBeCompleted = orthoImages.filter(image => {
      const imageIdString = image._id.toString();
      const isImageCompleted = completedMap.has(imageIdString);

      // Check if the image is not completed
      return !isImageCompleted;
    }).length;

    console.log("skippedMap:", JSON.stringify(Array.from(skippedMap.entries()), null, 2));
    console.log("completedMap:", JSON.stringify(Array.from(completedMap.entries()), null, 2));
    console.log("totalYetToBeCompleted:", totalYetToBeCompleted);

    // Combine OrthoImages with syllable information
    const imagesWithSyllableInfo = orthoImages.map(image => {
      const imageIdString = image._id.toString();

      // Determine whether the image is skipped or completed
      const isSkipped = skippedMap.has(imageIdString);
      const isCompleted = completedMap.has(imageIdString);

      // Handle the case where both skipped and completed are true
      const isSkippedAndCompleted = isSkipped && isCompleted;

      // Return the image along with the skipped and completed flags
      return {
        ...image.toObject(),
        skippedSyllable: isSkipped,
        completed: isCompleted,
      };
    });

    // Respond with the combined data
    res.status(200).json({
      message: "Images Fetched Successfully!",
      totalImages: imagesWithSyllableInfo.length,
      incompleteImagesCount: totalYetToBeCompleted,
      data: Array.isArray(imagesWithSyllableInfo) ? imagesWithSyllableInfo : [imagesWithSyllableInfo],
    });
  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({message: `Something went wrong: ${error}`});
  }
};

// Function to retrieve a training video
const getTrainingVideo = async (req, res) => {
  try {
    // Define the filename of the training video
    const fileName = "Orthography_Training_Video1.mp4";

    // Find the training video by its filename
    const trainingVideo = await TrainingVideo.findOne({fileName}).exec();

    // If the training video is not found, return a 404 error
    if (!trainingVideo) {
      return res.status(404).json({message: "Training Video not found."});
    }
    res.status(200).json({message: "Training Video Fetched Successfully!", data: trainingVideo});
  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({message: `Something went wrong : ${error}`});
  }
};
module.exports = {addOrthoImage, deleteOrthoImage, getOrthoImage, getTrainingVideo};
