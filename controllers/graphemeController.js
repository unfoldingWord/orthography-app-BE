const User = require("../models/User");
const OrthoImage = require("../models/OrthoImage");
const Syllable = require("../models/Syllable");
const ModuleProgress = require("../models/ModuleProgress");
const TrainingVideo = require("../models/TrainingVideo");
const BaseLanguage = require("../models/BaseLanguage");
const SoundGroup = require("../models/SoundGroup");
const mongoose = require("mongoose");
const {isExistsChecker} = require("../utils/helper");
const {getProgressData, updateModuleProgress, checkAndUpdateSoundGroupingModule, checkAndUpdateAssignLettersModule, checkAndUpdateLetterGroupsModule, checkAndUpdateAlphabetChartModule, checkAndUpdateSoundGroupsModule} = require("../utils/moduleProgressHelper");

const assignGrapheme = async (req, res) => {
  try {
    const {userId, letter, imageIds} = req.body;
    const error = [];
    const images = [];

    // Check if user exists
    const userExists = await isExistsChecker(User, {_id: userId});
    if (!userExists) return res.status(404).json({message: `User with user id: ${userId} doesn't exist`});

    // Check if base language exists for the user
    if (!userExists.baseLanguage) return res.status(400).json({message: `Base language for this user doesn't exists.`});

    // Validate the provided letter
    if (!validateLetter(letter, res)) return;

    // Loop through each image ID
    for (let imageId of imageIds) {
      console.log(imageId);

      // Validate image ID
      if (!validateId(imageId, error)) continue;

      // Check if the image exists
      const imageExists = await isExistsChecker(OrthoImage, {_id: imageId});
      if (!imageExists) {
        error.push(`Image not found : ${imageId}`);
        continue;
      }

      // Check if syllable details exist for the user and image
      const syllableExists = await isExistsChecker(Syllable, {user: userId, orthoImage: imageExists._id});
      if (!syllableExists) {
        error.push(`Syllable Details not found for user : ${userId} and ${imageId}`);
        continue;
      }

      // Check if sound group details exist for the syllable
      if (!syllableExists.soundGroup || syllableExists.soundGroup === null) {
        error.push(`Sound Group Details not found for user : ${userId} and ${imageId}`);
        continue;
      }

      // Update syllable grapheme
      await updateSyllableGrapheme(syllableExists, letter);

      // Update modules progress
      await updateModulesProgress(userId, userExists.baseLanguage);

      // Push the processed image ID to the images array
      images.push(imageId);
    }

    // Determine status code and message based on errors
    const statusCode = error.length > 0 ? 400 : 200;
    const message = error.length > 0 ? "Errors Occurred During Processing" : "Letters assigned successfully to images";

    // Return response with status code, message, processed image IDs, and errors
    return res.status(statusCode).json({message: message, data: images, errors: error});
  } catch (error) {
    // Handle any caught errors
    console.error(error);
    return res.status(500).json({message: `Something went wrong : ${error}`});
  }
};

const skipGrapheme = async (req, res) => {
  try {
    const userId = req.body.userId;
    const imageId = req.body.imageId;
    const isSkipRequest = req.body.skip;

    console.log(typeof isSkipRequest);

    // Checking if the 'skip' field is a boolean
    if (typeof isSkipRequest !== "boolean") {
      return res.status(400).json({message: `Expected value is either (Boolean) true/false for the isSkipRequest field`});
    }

    // Check if the user exists
    const userExists = await isExistsChecker(User, {_id: userId});
    if (!userExists) return res.status(404).json({message: `User with user id: ${userId} doesn't exist`});

    console.log(`User exists: ${JSON.stringify(userExists)}`);

    // Check if base language exists for the user
    if (!userExists.baseLanguage) return res.status(400).json({message: `Base language for this user doesn't exist.`});

    // Check if the image exists
    const imageExists = await isExistsChecker(OrthoImage, {_id: imageId});
    if (!imageExists) return res.status(404).json({message: `Image with image id: ${imageId} doesn't exist`});

    console.log(`Image exists: ${JSON.stringify(imageExists)}`);

    // Check if base language matches
    if (userExists.baseLanguage.toString() !== imageExists.baseLanguage.toString()) return res.status(400).json({message: "Base language id is different for image and user"});

    // Check if syllable is assigned to the image
    const syllableAssigned = await isExistsChecker(Syllable, {user: userId, orthoImage: imageId});
    if (!syllableAssigned || syllableAssigned.skippedSyllable === true || syllableAssigned.syllableType === 0) {
      return res.status(400).json({message: "Syllable not yet assigned to the image"});
    }

    // Check if sound group is assigned to the image
    if (!syllableAssigned || syllableAssigned.skippedSoundGroup === true || !syllableAssigned.soundGroup) return res.status(400).json({message: "Sound group not yet assigned to the image"});

    // Check if grapheme is already completed
    if (syllableAssigned.grapheme) return res.status(400).json({message: "Cannot skip this image as grapheme is already completed"});

    // Update syllable document to mark grapheme as skipped
    await Syllable.findOneAndUpdate(
      {
        user: userId,
        orthoImage: imageId,
      },
      {
        grapheme: null,
        skippedGrapheme: true,
      },
      {new: true}
    ).exec();

    // Update user's modules progress
    await updateModulesProgress(userId, userExists.baseLanguage);

    // Return success message
    return res.status(200).json({message: "Image successfully skipped!"});
  } catch (error) {
    console.error(error);
    return res.status(500).json({message: `Something went wrong : ${error}`});
  }
};

const getMetadata = async (req, res) => {
  try {
    const userId = req.query.userId;
    const imageId = req.query.imageId;

    // Initializing data object with default values
    let data = {
      SyllableGroup: null,
      ImageUrl: null,
      ImageId: null,
      SGObjectUrl: null,
      SGName: null,
    };

    // Checking if user exists
    const userExists = await isExistsChecker(User, {_id: userId});
    if (!userExists) return res.status(404).json({message: "User not found"});

    // Checking if image exists
    const imageExists = await isExistsChecker(OrthoImage, {_id: imageId});
    if (!imageExists) return res.status(404).json({message: "Image not found"});

    // Checking if syllable details exist for the user and image
    const syllableExists = await isExistsChecker(Syllable, {user: userId, orthoImage: imageExists._id});
    if (!syllableExists) return res.status(400).json({message: "Syllable Details not found"});

    // Checking if sound group details exist for the syllable
    if (!syllableExists.soundGroup || syllableExists.soundGroup === null) return res.status(400).json({message: "Sound group details not found"});

    // Mapping syllableType to its corresponding name
    const allSyllableTypes = ["DEFAULT", "Mono Syllabic", "Bi Syllabic", "Tri Syllabic", "Poly Syllabic"];
    let syllableType = "";
    switch (syllableExists.syllableType) {
      case 0:
        syllableType = allSyllableTypes[0];
        break;
      case 1:
        syllableType = allSyllableTypes[1];
        break;
      case 2:
        syllableType = allSyllableTypes[2];
        break;
      case 3:
        syllableType = allSyllableTypes[3];
        break;
      case 4:
        syllableType = allSyllableTypes[4];
        break;
      default:
        syllableType = allSyllableTypes[4];
        break;
    }

    // Fetching sound group details including image information
    const soundGroupDoc = await SoundGroup.aggregate([
      {
        $match: {_id: syllableExists.soundGroup},
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
        $project: {
          SGImageUrl: {
            $ifNull: [{$arrayElemAt: ["$imageInfo.fileUrl", 0]}, null],
          },
        },
      },
    ]);

    // Assigning fetched data to the data object
    data.SGName = syllableExists.soundGroup;
    data.SyllableGroup = syllableType;
    data.SGObjectUrl = soundGroupDoc[0].SGImageUrl;
    data.ImageId = imageExists._id;
    data.ImageUrl = imageExists.fileUrl;

    // Sending metadata response
    return res.status(200).json({
      message: `Metadata fetched successfully!`,
      data: data,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({message: `Something went wrong : ${error}`});
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

const letterGroupGallery = async (req, res) => {
  try {
    const userId = req.query.userId;

    // Check if the user exists
    const userExists = await isExistsChecker(User, {_id: userId});
    if (!userExists) return res.status(404).json({message: `User with user id: ${userId} doesn't exist`});

    // Check if the base language for the user exists
    if (!userExists.baseLanguage) return res.status(400).json({message: `Base language for this user doesn't exist.`});

    // Fetch data for each syllable type for the user
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
              imageId: "$syllables.orthoImage",
              imageObjectUrl: {$arrayElemAt: ["$imageInfo.fileUrl", 0]},
              fileName: {$arrayElemAt: ["$imageInfo.fileName", 0]},
              syllableType: {
                $switch: {
                  branches: [
                    {case: {$eq: ["$syllableType", 1]}, then: "MONO"},
                    {case: {$eq: ["$syllableType", 2]}, then: "BI"},
                    {case: {$eq: ["$syllableType", 3]}, then: "TRI"},
                    {case: {$and: [{$gte: ["$syllableType", 4]}, {$lte: ["$syllableType", 9]}]}, then: "POLY"},
                  ],
                  default: "UNKNOWN",
                },
              },
              assignLetterCompleted: {
                $cond: {
                  if: {
                    $and: [
                      {$eq: ["$skippedSyllable", false]},
                      {$eq: ["$skippedSoundGroup", false]},
                      {$eq: ["$skippedGrapheme", false]},
                      {
                        $ne: [{$ifNull: ["$grapheme", ""]}, ""],
                      },
                    ],
                  },
                  then: true,
                  else: false,
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

    console.log(`letterGroupImages:${letterGroupImages}`);

    return res.status(200).json({
      message: "Images Fetched Successfully!",
      data: letterGroupImages,
    });
  } catch (error) {
    console.error("Error:" + error);
    return res.status(500).json({message: `${error}`});
  }
};

const letterGroupGalleryByType = async (req, res) => {
  try {
    const userId = req.query.userId;
    const letter = req.query.letter;

    // Check if the user exists
    const userExists = await isExistsChecker(User, {_id: userId});
    if (!userExists) return res.status(404).json({message: `User with user id: ${userId} doesn't exist`});

    // Check if the user has a base language defined
    if (!userExists.baseLanguage) return res.status(400).json({message: `Base language for this user doesn't exists.`});

    // Validate the provided letter
    if (!validateLetter(letter, res)) return;

    // Fetch the images for the specified syllable type for the user
    const graphemeDoc = await Syllable.aggregate([
      {
        $match: {user: userExists._id, grapheme: letter.toUpperCase()},
      },
      {
        // Perform a lookup to get image information from 'orthoimages' collection
        $lookup: {
          from: "orthoimages",
          localField: "orthoImage",
          foreignField: "_id",
          as: "imageInfo",
        },
      },
      {
        // Project the desired fields from the documents
        $project: {
          _id: 0,
          imageId: "$orthoImage",
          imageObjectUrl: {$arrayElemAt: ["$imageInfo.fileUrl", 0]},
          grapheme: letter.toUpperCase(),
        },
      },
    ]);

    // If no images found, return appropriate message
    if (!graphemeDoc || graphemeDoc.length === 0) {
      return res.status(200).json({message: `No images found`, data: graphemeDoc});
    }

    // Return fetched images along with success message
    return res.status(200).json({
      message: `Images Fetched Successfully for grapheme: ${letter}`,
      data: graphemeDoc,
    });
  } catch (error) {
    // Handle any errors that may occur
    console.error("Error:" + error);
    return res.status(500).json({message: `${error}`});
  }
};

const getLettersForUser = async (req, res) => {
  try {
    // Extract userId from request query
    const userId = req.query.userId;

    // Check if user with given userId exists
    const userExists = await isExistsChecker(User, {_id: userId});
    if (!userExists) return res.status(404).json({message: `User with user id: ${userId} doesn't exist`});

    // Check if base language is defined for the user
    if (!userExists.baseLanguage) return res.status(400).json({message: `Base language for this user doesn't exist.`});

    // Fetch distinct graphemes for the user
    const distinctGraphemes = await Syllable.aggregate([
      {
        $match: {
          user: userExists._id,
          grapheme: {$exists: true, $ne: null},
        },
      },
      {
        $group: {
          _id: "$grapheme",
        },
      },
      {
        $project: {
          _id: 0,
          grapheme: "$_id",
        },
      },
    ]);

    console.log(distinctGraphemes);

    // Extract graphemes from the result
    const graphemeArray = distinctGraphemes.map(item => item.grapheme);
    console.log(graphemeArray);

    // If no graphemes found, return appropriate message
    if (!graphemeArray || graphemeArray.length === 0) {
      return res.status(200).json({message: "No letters assigned!"});
    }

    return res.status(200).json({message: "Letter fetched!", data: graphemeArray});
  } catch (error) {
    console.error("Error:" + error);
    return res.status(500).json({message: `${error}`});
  }
};

// Update progress for all modules based on user ID and base language
const updateModulesProgress = async (userId, baseLanguage) => {
  // Fetch progress data for the user
  const progressData = await getProgressData(userId, baseLanguage);

  // Define queries for each module
  const queryMap = {
    "Sound Grouping": {syllableType: {$ne: 0}, soundGroup: {$exists: true, $ne: null}, skippedSyllable: false, skippedSoundGroup: false},
    "Sound Groups": {syllableType: {$ne: 0}, soundGroup: {$exists: true, $ne: null}, skippedSyllable: false, skippedSoundGroup: false},
    "Assign Letters": {grapheme: {$exists: true, $ne: null}, skippedGrapheme: false},
    "Letter Groups": {grapheme: {$exists: true, $ne: null}, skippedGrapheme: false},
    "Alphabet Chart": {grapheme: {$exists: true, $ne: null}, skippedGrapheme: false},
  };

  // Update progress for each module
  for (const [moduleName, query] of Object.entries(queryMap)) {
    await updateModuleProgress(userId, baseLanguage, moduleName, query, progressData);
  }

  // Check and update Assign Letters module progress
  await checkAndUpdateAssignLettersModule(userId, baseLanguage);
  // Check and update Letter Groups module progress
  await checkAndUpdateLetterGroupsModule(userId, baseLanguage);
  // Check and update Alphabet Chart module progress
  await checkAndUpdateAlphabetChartModule(userId, baseLanguage);
};

// Check if grapheme is completed for a user
const checkGraphemeCompleted = async (req, res) => {
  try {
    const userId = req.query.userId;
    let completionStatus = {
      graphemeCompleted: false,
    };
    // Check if the user exists
    const userExists = await isExistsChecker(User, {_id: userId});
    if (!userExists) return res.status(404).json({message: `User with user id: ${userId} doesn't exist`});

    if (!userExists.baseLanguage) {
      return res.status(400).json({message: `Base language for this user doesn't exist.`});
    }
    // Check if grapheme is completed for the user
    completionStatus.graphemeCompleted = await fetchGraphemeDetails(userExists);

    return res.status(200).json({message: "Data fetched successfully!", data: completionStatus});
  } catch (error) {
    console.error(error);
    return res.status(500).json({message: `Something went wrong : ${error}`});
  }
};

// Fetch details about grapheme completion for a user
const fetchGraphemeDetails = async userExists => {
  // Count total images for the base language
  const totalImagesCount = await OrthoImage.countDocuments({baseLanguage: userExists.baseLanguage});

  // Count completed syllables with associated graphemes
  const completedCount = await Syllable.countDocuments({
    user: userExists._id,
    skippedSoundGroup: false,
    skippedSyllable: false,
    skippedGrapheme: false,
    soundGroup: {$exists: true, $ne: null},
    grapheme: {$exists: true, $ne: null},
  });

  // Check if all graphemes are completed
  if (totalImagesCount === completedCount) return true;
  return totalImagesCount === completedCount;
};

// Validate if the given ID is a valid MongoDB ObjectId
const validateId = (id, error) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    error.push(`Invalid imageId`);
    return false;
  }
  return true;
};

// Validate if the given letter is a valid alphabet letter
const validateLetter = (letter, res) => {
  if (!letter || !/^[a-zA-Z]$/.test(letter)) {
    res.status(400).json({message: `Only letters allowed.`});
    return false;
  }
  return true;
};

// Update syllable grapheme
const updateSyllableGrapheme = async (syllableExists, letter) => {
  // Update syllable with provided grapheme
  await Syllable.findOneAndUpdate({_id: syllableExists._id}, {$set: {grapheme: letter.toUpperCase(), skippedGrapheme: false}}, {new: true, upsert: true}).exec();
};

module.exports = {assignGrapheme, getMetadata, skipGrapheme, getTrainingVideo, letterGroupGallery, letterGroupGalleryByType, getLettersForUser, checkGraphemeCompleted};
