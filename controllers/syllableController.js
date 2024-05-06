const BaseLanguage = require("../models/BaseLanguage");
const OrthoImage = require("../models/OrthoImage");
const User = require("../models/User");
const Syllable = require("../models/Syllable");
const mongoose = require("mongoose");
const TrainingVideo = require("../models/TrainingVideo");
const ModuleProgress = require("../models/ModuleProgress");
const {isExistsChecker} = require("../utils/helper");

//Assign syllable function
const assignSyllable = async (req, res) => {
  try {
    // Extracting data from request
    const userId = req.body.userId;
    const syllableData = req.body.image;
    const errors = [];

    // Validating imageId
    if (!mongoose.Types.ObjectId.isValid(syllableData._id)) {
      errors.push("Invalid imageId");
    }

    // Validating userId
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      errors.push("Invalid userId");
    }

    // Check for valid request parameters
    if (!syllableData || !syllableData.count) {
      errors.push("Invalid count");
    }

    // Returning errors if any
    if (errors.length > 0) {
      return res.status(400).json({message: "Invalid parameters", errors});
    }

    console.log(`syllable count :${syllableData.count}`);
    //validate syllable count
    const count = parseInt(syllableData.count, 10);

    if (isNaN(count) || count <= 0 || count > 9) {
      return res.status(400).json({message: "Syllable value should be an integer between 1 and 9."});
    }

    // Check if the user exists
    const userExists = await User.findOne({_id: userId}).exec();
    if (!userExists) {
      return res.status(404).json({message: `User with user id: ${userId} doesn't exist`});
    }

    console.log(`User exists: ${JSON.stringify(userExists)}`);

    // Checking if base language exists for user
    if (!userExists.baseLanguage) {
      return res.status(400).json({message: `Base language for this user doesn't exists.`});
    }

    // Check if the image exists
    const imageExists = await OrthoImage.findOne({_id: syllableData._id});
    if (!imageExists) {
      return res.status(404).json({message: `Image with image id: ${syllableData._id} doesn't exist`});
    }

    console.log(`Image exists: ${JSON.stringify(imageExists)}`);

    // Check if base language matches
    if (userExists.baseLanguage.toString() !== imageExists.baseLanguage.toString()) {
      return res.status(400).json({message: "Base language id is different for image and user"});
    }

    // Checking if syllable already exists for user and image
    const checkSyllableExistsForUser = await Syllable.findOne({
      orthoImage: imageExists._id,
      user: userExists._id,
    });

    let syllable;

    if (checkSyllableExistsForUser) {
      if (checkSyllableExistsForUser.skippedSyllable) {
        // Update the existing syllable
        const update = {syllableType: count, skippedSyllable: false};
        syllable = await Syllable.findOneAndUpdate({_id: checkSyllableExistsForUser._id}, update, {new: true}).exec();
      } else {
        // Syllable already set for the image and user
        return res.status(400).json({
          message: `Syllable already set for image with id: ${imageExists._id} and user with id: ${userExists._id}`,
        });
      }
    } else {
      // Create syllable
      syllable = await Syllable.create({
        user: userExists._id,
        orthoImage: imageExists._id,
        syllableType: count,
      });
    }

    console.log(`syllable:${JSON.stringify(syllable)}`);
    // Check if a ModuleProgress record exists for the user, module, and base language
    let moduleProgress = await ModuleProgress.findOne({
      user: userExists._id,
      module: "Identify Syllables",
      baseLanguage: userExists.baseLanguage,
    });

    console.log(`moduleProgress:${JSON.stringify(moduleProgress)}`);

    // Finding module progress for sound grouping
    let moduleProgressForSyllableGroup = await ModuleProgress.findOne({
      user: userExists._id,
      module: "Syllable Groups",
      baseLanguage: userExists.baseLanguage,
    });

    console.log(`moduleProgressForSyllableGroup:${JSON.stringify(moduleProgressForSyllableGroup)}`);

    // Finding module progress for sound groups
    let moduleProgressForSoundGrouping = await ModuleProgress.findOne({
      user: userExists._id,
      module: "Sound Grouping",
      baseLanguage: userExists.baseLanguage,
    });
    console.log(`moduleProgressForSoundGrouping:${JSON.stringify(moduleProgressForSoundGrouping)}`);

    let moduleProgressForSoundGroups = await ModuleProgress.findOne({
      user: userExists._id,
      module: "Sound Groups",
      baseLanguage: userExists.baseLanguage,
    });
    console.log(`moduleProgressForSoundGroups:${JSON.stringify(moduleProgressForSoundGroups)}`);

    // Counting total images
    const totalImagesCount = await OrthoImage.countDocuments({baseLanguage: userExists.baseLanguage});
    let completedImagesCount = 0;
    let IncompletedImages = 0;
    let PercentageComplete = 0;
    let SkippedImages = 0;

    // Calculating completion percentage
    if (totalImagesCount > 0) {
      // Calculate completion percentage only if there are images
      completedImagesCount = await Syllable.countDocuments({
        user: userExists._id,
        syllableType: {$ne: 0},
        skippedSyllable: {$ne: true},
      });
      IncompletedImages = totalImagesCount - completedImagesCount;
      PercentageComplete = (completedImagesCount / totalImagesCount) * 100;
      SkippedImages = await Syllable.countDocuments({user: userExists._id, skippedSyllable: {$eq: true}});
    }

    // If totalImagesCount is 0, set PercentageComplete to 0
    PercentageComplete = totalImagesCount > 0 ? PercentageComplete : 0;
    await ModuleProgress.findOneAndUpdate({_id: moduleProgress._id}, {$set: {totalImages: totalImagesCount, completedImages: completedImagesCount, incompletedImages: IncompletedImages, percentageCompleted: PercentageComplete, skippedImages: SkippedImages}}, {new: true}).exec();

    if (PercentageComplete >= 50) {
      await ModuleProgress.findOneAndUpdate({_id: moduleProgressForSoundGrouping._id}, {$set: {isOpen: true}}, {new: true}).exec();
    }

    // Checking if sound groups module should be opened
    const soundGroupAssigned = await Syllable.findOne({
      user: userId,
      soundGroup: {$exists: true, $ne: null},
    }).exec();

    console.log(`soundGroupAssigned: ${JSON.stringify(soundGroupAssigned)}`);

    if (soundGroupAssigned) {
      await ModuleProgress.findOneAndUpdate({_id: moduleProgressForSoundGroups._id}, {$set: {isOpen: true}}, {new: true}).exec();
    } else {
      await ModuleProgress.findOneAndUpdate({_id: moduleProgressForSoundGroups._id}, {$set: {isOpen: false}}, {new: true}).exec();
    }

    // Updating module progress for syllable groups
    const resultSyllableGroup = await ModuleProgress.findOneAndUpdate({_id: moduleProgressForSyllableGroup._id}, {$set: {totalImages: totalImagesCount, completedImages: completedImagesCount, incompletedImages: IncompletedImages, percentageCompleted: PercentageComplete, skippedImages: SkippedImages, isOpen: completedImagesCount > 0}}, {new: true}).exec();

    console.log(`resultSyllableGroup:${JSON.stringify(resultSyllableGroup)}`);
    console.log(`Syllable assigned successfully!:${JSON.stringify(syllable)}`);
    return res.status(200).json({message: "Syllable assigned successfully!"});
  } catch (error) {
    console.error("Error:" + error);
    return res.status(500).json({message: `${error}`});
  }
};

//Skip images function
const skipImage = async (req, res) => {
  try {
    // Extracting necessary data from request body
    const userId = req.body.userId;
    const imageId = req.body.imageId;
    const isSkipRequest = req.body.skip;

    // Validating if isSkipRequest is a boolean
    if (typeof isSkipRequest !== "boolean") {
      return res.status(400).json({message: `Expected value is either (Boolean) true/false for the isSkipRequest field`});
    }

    // Check if the user exists
    const userExists = await User.findOne({_id: userId}).exec();
    if (!userExists) {
      return res.status(404).json({message: `User with user id: ${userId} doesn't exist`});
    }

    console.log(`User exists: ${JSON.stringify(userExists)}`);

    //Check if base language exists for the user
    if (!userExists.baseLanguage) {
      return res.status(400).json({message: `Base language for this user doesn't exists.`});
    }

    // Check if the image exists
    const imageExists = await OrthoImage.findOne({_id: imageId});
    if (!imageExists) {
      return res.status(404).json({message: `Image with image id: ${imageId} doesn't exist`});
    }

    console.log(`Image exists: ${JSON.stringify(imageExists)}`);

    // Check if base language matches
    if (userExists.baseLanguage.toString() !== imageExists.baseLanguage.toString()) {
      return res.status(400).json({message: "Base language id is different for image and user"});
    }

    // Check if syllable exists for the given user and image
    const syllableExists = await Syllable.findOne({user: userId, orthoImage: imageId});
    console.log(`syllableExists:${JSON.stringify(syllableExists)}`);
    if (syllableExists) {
      // If syllable exists, check if it's already assigned or skipped
      if (syllableExists.syllableType != 0) {
        return res.status(400).json({message: "Cannot skip this image as syllable is already assigned"});
      }

      // Update syllable to indicate it's skipped
      await Syllable.findOneAndUpdate({_id: syllableExists._id}, {$set: {syllableType: 0, skippedSyllable: true}}, {new: true}).exec();
    } else {
      // Create a new syllable entry if it doesn't exist
      await Syllable.create({
        user: userId,
        orthoImage: imageId,
        syllableType: 0,
        skippedSyllable: true,
      });
    }

    // Check if a ModuleProgress record exists for the user, module, and base language
    let moduleProgress = await ModuleProgress.findOne({
      user: userExists._id,
      module: "Identify Syllables",
      baseLanguage: userExists.baseLanguage,
    });

    let moduleProgressForSyllableGrouping = await ModuleProgress.findOne({
      user: userExists._id,
      module: "Syllable Groups",
      baseLanguage: userExists.baseLanguage,
    });

    // Update the total count of images
    const totalImagesCount = await OrthoImage.countDocuments({baseLanguage: userExists.baseLanguage});

    let completedImagesCount = 0;
    let IncompletedImages = 0;
    let PercentageComplete = 0;
    let SkippedImages = 0;

    if (totalImagesCount > 0) {
      // Calculate completion percentage only if there are images
      completedImagesCount = await Syllable.countDocuments({
        user: userExists._id,
        syllableType: {$ne: 0},
        skippedSyllable: {$ne: true},
      });
      IncompletedImages = totalImagesCount - completedImagesCount;
      PercentageComplete = (completedImagesCount / totalImagesCount) * 100;
      SkippedImages = await Syllable.countDocuments({user: userExists._id, skippedSyllable: {$eq: true}});
    }

    // If totalImagesCount is 0, set PercentageComplete to 0
    PercentageComplete = totalImagesCount > 0 ? PercentageComplete : 0;

    // Update ModuleProgress records
    await ModuleProgress.findOneAndUpdate({_id: moduleProgress._id}, {$set: {totalImages: totalImagesCount, completedImages: completedImagesCount, incompletedImages: IncompletedImages, percentageCompleted: PercentageComplete, skippedImages: SkippedImages}}, {new: true}).exec();

    await ModuleProgress.findOneAndUpdate({_id: moduleProgressForSyllableGrouping._id}, {$set: {totalImages: totalImagesCount, completedImages: completedImagesCount, incompletedImages: IncompletedImages, percentageCompleted: PercentageComplete, skippedImages: SkippedImages, isOpen: completedImagesCount > 0}}, {new: true}).exec();

    return res.status(200).json({message: "Syllable skipped successfully!"});
  } catch (error) {
    console.error("Error:" + error);
    return res.status(500).json({message: `${error}`});
  }
};

//Syllable gallery function
const syllableGallery = async (req, res) => {
  try {
    // Extracting userId from the request query
    const userId = req.query.userId;

    // Check if the user exists
    const userExists = await User.findOne({_id: userId}).exec();
    if (!userExists) {
      // If user doesn't exist, return a 404 response with a message
      return res.status(404).json({message: `User with user id: ${userId} doesn't exist`});
    }

    if (!userExists.baseLanguage) {
      // If base language doesn't exist for the user, return a 400 response with a message
      return res.status(400).json({message: `Base language for this user doesn't exists.`});
    }

    // Fetch the first 3 images for each syllable type for the user
    const syllableImages = await Syllable.aggregate([
      {
        $match: {user: userExists._id, skippedSyllable: false, syllableType: {$ne: 0}},
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
          _id: 0,
          id: "$_id",
          imageId: "$orthoImage",
          imageObjectUrl: {$arrayElemAt: ["$imageInfo.fileUrl", 0]},
          fileName: {$arrayElemAt: ["$imageInfo.fileName", 0]},
          languageId: userExists.baseLanguage,
          userId: userExists._id,
          syllableType: {
            // Map syllableType to their respective names (MONO, BI, TRI, POLY)
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
          soundGroupingCompleted: {
            // Check if sound grouping is completed for each syllable
            $cond: {
              if: {
                $and: [
                  {$eq: ["$skippedSyllable", false]},
                  {$eq: ["$skippedSoundGroup", false]},
                  {
                    $ne: [{$ifNull: ["$soundGroup", ""]}, ""],
                  },
                ],
              },
              then: true,
              else: false,
            },
          },
        },
      },
      {
        $group: {
          _id: "$syllableType",
          images: {
            $push: "$$ROOT",
          },
        },
      },
      {
        $project: {
          _id: 1,
          images: {
            // Include only the first 3 images for each syllable type
            $slice: ["$images", 3],
          },
        },
      },
      {
        $addFields: {
          images: {
            // Exclude empty arrays (if no images exist for the syllable type)
            $cond: {
              if: {$in: ["$_id", ["MONO", "BI", "TRI", "POLY"]]},
              then: "$images",
              else: [],
            },
          },
        },
      },
    ]);

    // Organize images by syllable type
    const organizedImages = syllableImages.reduce((acc, syllable) => {
      acc[syllable._id] = syllable.images;
      return acc;
    }, {});

    const finalSyllableImages = {
      MONO: organizedImages.MONO || [],
      BI: organizedImages.BI || [],
      TRI: organizedImages.TRI || [],
      POLY: organizedImages.POLY || [],
    };

    if (Object.keys(finalSyllableImages).every(key => finalSyllableImages[key].length === 0)) {
      // If no images found for any syllable type, return a 404 response with a message
      return res.status(404).json({message: `No images found`});
    }

    // Return a 200 response with the organized images
    return res.status(200).json({
      message: "Images Fetched Successfully!",
      data: finalSyllableImages,
    });
  } catch (error) {
    // If any error occurs during the process, log the error and return a 500 response with the error message
    console.error("Error:" + error);
    return res.status(500).json({message: `${error}`});
  }
};

//Update syllable function
const updateSyllable = async (req, res) => {
  try {
    const imageId = req.body.imageId;
    const userId = req.body.userId;
    const syllableType = req.body.syllable;

    console.log(`syllableType:${syllableType}`);

    // Validate syllable type
    if (isNaN(syllableType) || syllableType <= 0 || syllableType > 9) {
      return res.status(400).json({message: "Invalid Syllable type. It should be an integer between 1 and 9."});
    }

    // Check if user exists
    const userExists = await User.findOne({_id: userId}).exec();
    if (!userExists) {
      return res.status(404).json({message: `User with user id: ${userId} doesn't exist`});
    }

    console.log(`User exists: ${JSON.stringify(userExists)}`);

    // Check if user's base language exists
    if (!userExists.baseLanguage) {
      return res.status(400).json({message: `Base language for this user doesn't exist.`});
    }

    // Check if the image exists
    const imageExists = await OrthoImage.findOne({_id: imageId});
    if (!imageExists) {
      return res.status(404).json({message: `Image with image id: ${imageId} doesn't exist`});
    }

    console.log(`Image exists: ${JSON.stringify(imageExists)}`);

    // Check if base language matches between user and image
    if (userExists.baseLanguage.toString() !== imageExists.baseLanguage.toString()) {
      return res.status(400).json({message: "Base language id is different for image and user"});
    }

    // Check if syllable details exist for the user and image
    const checkSyllableExists = await Syllable.findOne({user: userId, orthoImage: imageId});
    if (!checkSyllableExists) {
      return res.status(404).json({message: "Syllable details not found"});
    }

    // Update syllable details
    const update = {syllableType: syllableType, skippedSyllable: false};
    await Syllable.findOneAndUpdate({_id: checkSyllableExists._id}, update, {new: true}).exec();

    // Update module progress for the user
    let moduleProgress = await ModuleProgress.findOne({
      user: userExists._id,
      module: "Identify Syllables",
      baseLanguage: userExists.baseLanguage,
    });

    // Update module progress for syllable groups
    let moduleProgressForSyllableGroup = await ModuleProgress.findOne({
      user: userExists._id,
      module: "Syllable Groups",
      baseLanguage: userExists.baseLanguage,
    });

    // Update module progress for sound grouping
    let moduleProgressForSoundGrouping = await ModuleProgress.findOne({
      user: userExists._id,
      module: "Sound Grouping",
      baseLanguage: userExists.baseLanguage,
    });

    // Count total images and completed images
    const totalImagesCount = await OrthoImage.countDocuments({baseLanguage: userExists.baseLanguage});
    let completedImagesCount = 0;
    let IncompletedImages = 0;
    let PercentageComplete = 0;
    let SkippedImages = 0;

    if (totalImagesCount > 0) {
      completedImagesCount = await Syllable.countDocuments({
        user: userExists._id,
        syllableType: {$ne: 0},
        skippedSyllable: {$ne: true},
      });
      IncompletedImages = totalImagesCount - completedImagesCount;
      PercentageComplete = (completedImagesCount / totalImagesCount) * 100;
      SkippedImages = await Syllable.countDocuments({user: userExists._id, skippedSyllable: {$eq: true}});
    }

    // Calculate completion percentage
    PercentageComplete = totalImagesCount > 0 ? PercentageComplete : 0;

    // Update module progress with image completion details
    await ModuleProgress.findOneAndUpdate({_id: moduleProgress._id}, {$set: {totalImages: totalImagesCount, completedImages: completedImagesCount, incompletedImages: IncompletedImages, percentageCompleted: PercentageComplete, skippedImages: SkippedImages}}, {new: true}).exec();

    // Open next module if completion percentage is over 50%
    if (PercentageComplete >= 50) {
      await ModuleProgress.findOneAndUpdate({_id: moduleProgressForSoundGrouping._id}, {$set: {isOpen: true}}, {new: true}).exec();
    }

    // Update module progress for syllable group
    await ModuleProgress.findOneAndUpdate({_id: moduleProgressForSyllableGroup._id}, {$set: {totalImages: totalImagesCount, completedImages: completedImagesCount, incompletedImages: IncompletedImages, percentageCompleted: PercentageComplete, skippedImages: SkippedImages, isOpen: completedImagesCount > 0}}, {new: true}).exec();

    // Return success message
    return res.status(200).json({message: `Syllable updated successfully`});
  } catch (error) {
    // Handle errors
    console.error("Error:" + error);
    return res.status(500).json({message: `${error}`});
  }
};

// Get Images for Syllable gallery by syllable type function
const syllableGalleryByType = async (req, res) => {
  try {
    const userId = req.query.userId;
    const syllableType = parseInt(req.query.syllableType, 10);
    console.log(`syllableType:${syllableType}`);

    // Validate syllableType
    if (isNaN(syllableType) || syllableType <= 0 || syllableType > 9) {
      return res.status(400).json({message: "Invalid Syllable type. It should be an integer between 1 and 9."});
    }

    // Check if the user exists
    const userExists = await User.findOne({_id: userId}).exec();
    if (!userExists) {
      return res.status(404).json({message: `User with user id: ${userId} doesn't exist`});
    }

    // Check if baseLanguage for user exists
    if (!userExists.baseLanguage) {
      return res.status(400).json({message: `Base language for this user doesn't exists.`});
    }

    // Fetch the images for the specified syllable type for the user
    let syllableImages;
    if (parseInt(syllableType) >= 4 && parseInt(syllableType) <= 9) {
      console.log("Here!!!");
      // Aggregation pipeline for POLY syllable type
      syllableImages = await Syllable.aggregate([
        {
          $match: {user: userExists._id, skippedSyllable: false, syllableType: {$in: [4, 5, 6, 7, 8, 9]}},
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
            _id: 0,
            id: "$_id",
            imageId: "$orthoImage",
            imageObjectUrl: {$arrayElemAt: ["$imageInfo.fileUrl", 0]},
            fileName: {$arrayElemAt: ["$imageInfo.fileName", 0]},
            languageId: userExists.baseLanguage,
            userId: userExists._id,
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
            soundGroupingCompleted: {
              $cond: {
                if: {
                  $and: [
                    {$eq: ["$skippedSyllable", false]},
                    {$eq: ["$skippedSoundGroup", false]},
                    {
                      $ne: [{$ifNull: ["$soundGroup", ""]}, ""],
                    },
                  ],
                },
                then: true,
                else: false,
              },
            },
          },
        },
      ]);
    } else {
      // Aggregation pipeline for MONO, BI, and TRI syllable types
      syllableImages = await Syllable.aggregate([
        {
          $match: {user: userExists._id, skippedSyllable: false, syllableType: parseInt(syllableType)},
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
            _id: 0,
            id: "$_id",
            imageId: "$orthoImage",
            imageObjectUrl: {$arrayElemAt: ["$imageInfo.fileUrl", 0]},
            fileName: {$arrayElemAt: ["$imageInfo.fileName", 0]},
            languageId: userExists.baseLanguage,
            userId: userExists._id,
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
            soundGroupingCompleted: {
              $cond: {
                if: {
                  $and: [
                    {$eq: ["$skippedSyllable", false]},
                    {$eq: ["$skippedSoundGroup", false]},
                    {
                      $ne: [{$ifNull: ["$soundGroup", ""]}, ""],
                    },
                  ],
                },
                then: true,
                else: false,
              },
            },
          },
        },
      ]);
    }

    // If no images found
    if (!syllableImages || syllableImages.length === 0) {
      return res.status(200).json({message: `No images found`});
    }

    return res.status(200).json({
      message: `Images Fetched Successfully for Syllable Type: ${syllableType}`,
      data: syllableImages,
    });
  } catch (error) {
    console.error("Error:" + error);
    return res.status(500).json({message: `${error}`});
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

module.exports = {assignSyllable, skipImage, syllableGallery, updateSyllable, syllableGalleryByType, getTrainingVideo};
