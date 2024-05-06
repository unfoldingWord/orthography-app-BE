const User = require("../models/User");
const OrthoImage = require("../models/OrthoImage");
const Syllable = require("../models/Syllable");
const ModuleProgress = require("../models/ModuleProgress");
const TrainingVideo = require("../models/TrainingVideo");
const BaseLanguage = require("../models/BaseLanguage");
const SoundGroup = require("../models/SoundGroup");
const mongoose = require("mongoose");
const {getProgressData, updateModuleProgress, checkAndUpdateSoundGroupingModule, checkAndUpdateAssignLettersModule, checkAndUpdateLetterGroupsModule, checkAndUpdateAlphabetChartModule, checkAndUpdateSoundGroupsModule} = require("../utils/moduleProgressHelper");
const {isExistsChecker} = require("../utils/helper");

// Function to assign a sound group to an image
const assignSoundGroup = async (req, res) => {
  try {
    // Extract data from request body
    const userId = req.body.userId;
    const imageId = req.body.imageId;
    const soundGroupId = req.body.soundGroupId;
    const timestamp = new Date().toISOString();

    // Check if user exists
    const userExists = await isExistsChecker(User, {_id: userId});
    if (!userExists) return res.status(404).json({message: "User not found"});

    // Check if image exists
    const imageExists = await isExistsChecker(OrthoImage, {_id: imageId});
    if (!imageExists) return res.status(404).json({message: "Image not found"});

    // Check if sound group exists
    const soundGroupExists = await isExistsChecker(SoundGroup, {_id: soundGroupId});
    if (!soundGroupExists) return res.status(404).json({message: "Sound group not found"});

    // Check if syllable is assigned to the image and sound grouping is not skipped
    const syllableAssigned = await isExistsChecker(Syllable, {user: userId, orthoImage: imageId});
    if (!syllableAssigned || syllableAssigned.skippedSyllable === true || syllableAssigned.syllableType === 0) {
      return res.status(400).json({message: "Syllable not yet assigned to the image"});
    }

    console.log(`${timestamp}:imageExists._id:${JSON.stringify(imageExists._id)}`);
    console.log(`${timestamp}:soundGroupExists.orthoImage:${JSON.stringify(soundGroupExists.orthoImage)}`);

    // Check if hero image is already created
    const checkIfHeroImageCreated = await isExistsChecker(SoundGroup, {user: userId, orthoImage: imageId});

    console.log(`${timestamp}:checkIfHeroImageCreated:${JSON.stringify(checkIfHeroImageCreated)}`);

    // Logic to handle different scenarios based on whether hero image is already created or not
    if (checkIfHeroImageCreated && !checkIfHeroImageCreated.orthoImage.equals(soundGroupExists.orthoImage)) {
      const otherImages = await Syllable.find({user: userExists._id, soundGroup: checkIfHeroImageCreated._id, orthoImage: {$ne: new mongoose.Types.ObjectId(imageId)}}).exec();
      console.log(`${timestamp}:otherImages:${otherImages}`);
      const otherImagesCount = await Syllable.countDocuments({user: userId, soundGroup: checkIfHeroImageCreated._id, orthoImage: {$ne: imageId}});
      console.log(`${timestamp}:otherImagesCount:${otherImagesCount}`);
      if (otherImagesCount === 0) {
        //Assign to new sound group
        await Syllable.findOneAndUpdate(
          {orthoImage: imageId, user: userId},
          {
            soundGroup: soundGroupId,
            skippedSoundGroup: false,
          },
          {new: true, upsert: true}
        ).exec();

        // Delete the current sound group if it has no other images
        //await SoundGroup.findByIdAndDelete(checkIfHeroImageCreated._id).exec();
      } else if (otherImagesCount > 0) {
        // allot next hero image
        const nextHeroImage = await isExistsChecker(Syllable, {user: userExists._id, soundGroup: checkIfHeroImageCreated._id, orthoImage: {$ne: imageId}});

        console.log(`${timestamp}:nextHeroImage:${JSON.stringify(nextHeroImage)}`);

        //create sound group
        const checkIfAlreadyExists = await isExistsChecker(SoundGroup, {
          user: userId,
          baseLanguage: userExists.baseLanguage,
          orthoImage: nextHeroImage.orthoImage,
        });

        if (checkIfAlreadyExists) {
          return res.status(400).json({message: `Sound group already exists for the user with this image:${nextHeroImage.orthoImage}`});
        } else {
          const newHeroImage = await SoundGroup.create({
            user: userExists._id,
            baseLanguage: userExists.baseLanguage,
            orthoImage: nextHeroImage.orthoImage,
          });

          const updatedManySyllable = await Syllable.updateMany(
            {user: userExists._id, soundGroup: checkIfHeroImageCreated._id},
            {
              soundGroup: newHeroImage._id,
              skippedSoundGroup: false,
            },
            {new: true, upsert: true}
          ).exec();

          await Syllable.findOneAndUpdate(
            {orthoImage: imageId, user: userId},
            {
              soundGroup: soundGroupId,
              skippedSoundGroup: false,
            },
            {new: true, upsert: true}
          ).exec();

          console.log(`${timestamp}:updatedManySyllable:${JSON.stringify(updatedManySyllable)}`);
        }
      }
    }

    const updatedSyllable = await Syllable.findOneAndUpdate(
      {orthoImage: imageId, user: userId},
      {
        soundGroup: soundGroupId,
        skippedSoundGroup: false,
      },
      {new: true, upsert: true}
    ).exec();

    console.log(`${timestamp}:updatedSyllable:${JSON.stringify(updatedSyllable)}`);

    if (checkIfHeroImageCreated && updatedSyllable.soundGroup && checkIfHeroImageCreated._id.toString() != updatedSyllable.soundGroup.toString()) {
      console.log(`syllable assigned`);
      await SoundGroup.findByIdAndDelete(checkIfHeroImageCreated._id).exec();
    }
    // Update modules progress for the user
    await updateModulesProgress(userId, userExists.baseLanguage);

    // Delete empty sound groups
    // Fetch all sound groups
    const soundGroups = await SoundGroup.find({user: userExists._id}).exec();
    console.log(`${timestamp}:All sound groups for user:${JSON.stringify(soundGroups)}`);

    // Create an array to store sound group ids to delete
    const soundGroupIdsToDelete = [];

    // Iterate through each sound group
    for (const soundGroup of soundGroups) {
      // Check if there are no associated syllables for the current user
      const syllableCount = await Syllable.countDocuments({
        soundGroup: soundGroup._id,
        user: soundGroup.user,
      });

      if (syllableCount === 0) {
        soundGroupIdsToDelete.push(soundGroup._id);
      }
    }

    // Delete sound groups with no associated syllables
    if (soundGroupIdsToDelete.length > 0) {
      console.log(`${timestamp}:soundGroupIdsToDelete:${soundGroupIdsToDelete}`);
      await SoundGroup.deleteMany({_id: {$in: soundGroupIdsToDelete}}).exec();
    }

    return res.status(200).json({message: "Sound Group Asssigned Successfully"});
  } catch (error) {
    console.error(error);
    return res.status(500).json({message: `Something went wrong : ${error}`});
  }
};

// Function to create a new sound group
const createSoundGroup = async (req, res) => {
  try {
    // Extract userId and imageId from request body
    const userId = req.body.userId;
    const imageId = req.body.imageId;

    console.log(`userId:${userId}`);

    // Check if user exists
    const userExists = await isExistsChecker(User, {_id: userId});
    if (!userExists) return res.status(404).json({message: "User not found"});

    // Check if image exists
    const imageExists = await isExistsChecker(OrthoImage, {_id: imageId});
    if (!imageExists) return res.status(404).json({message: "Ortho Image not found"});

    // Check if base language exists
    const baseLanguage = await isExistsChecker(BaseLanguage, {_id: userExists.baseLanguage});
    if (!baseLanguage) return res.status(404).json({message: "Base language not found"});

    // Ensure that base language of user matches the base language of the image
    if (userExists.baseLanguage.toString() !== imageExists.baseLanguage.toString()) {
      return res.status(400).json({message: "Base language id is different for image and user"});
    }

    // Check if sound group already exists for the user with this image
    const checkIfAlreadyExists = await isExistsChecker(SoundGroup, {
      user: userId,
      baseLanguage: userExists.baseLanguage,
      orthoImage: imageId,
    });

    if (checkIfAlreadyExists) {
      return res.status(400).json({message: "Sound group already exists for the user with this image"});
    } else {
      const soundGroupCreated = await SoundGroup.create({
        user: userId,
        baseLanguage: userExists.baseLanguage,
        orthoImage: imageId,
      });

      console.log(`Sound group created successfully: ${JSON.stringify(soundGroupCreated)}`);
    }

    // Fetch details of the created sound group
    const soundGroupDetails = await SoundGroup.aggregate([
      {
        $match: {user: userExists._id, baseLanguage: userExists.baseLanguage},
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
          _id: 0, // exclude id
          soundGroupId: "$_id",
          imageId: "$orthoImage",
          imageObjectUrl: {$arrayElemAt: ["$imageInfo.fileUrl", 0]},
          fileName: {$arrayElemAt: ["$imageInfo.fileName", 0]},
        },
      },
    ]);

    return res.status(200).json({
      message: "Sound Group Created Successfully!",
      data: soundGroupDetails,
    });
  } catch (error) {
    // Handle any errors that occur during the process
    console.error(error);
    return res.status(500).json({message: `Something went wrong: ${error}`});
  }
};

//Fetch all the sound groups created by the user
const getSoundGroupList = async (req, res) => {
  try {
    // Extract userId from the request query
    const userId = req.query.userId;

    // Check if the user exists
    const userExists = await isExistsChecker(User, {_id: userId});
    if (!userExists) return res.status(404).json({message: "User not found"});

    // Find sound groups belonging to the user with the same base language
    const soundGroupList = await SoundGroup.find({user: userId, baseLanguage: userExists.baseLanguage});

    //console.log(`soundGroupList:${soundGroupList}`);
    // If no sound groups found, return appropriate response
    if (soundGroupList.length === 0) {
      return res.status(200).json({message: "No sound groups found"});
    }

    // Aggregate sound group details including associated image information
    const soundGroupDetails = await SoundGroup.aggregate([
      {
        $match: {user: userExists._id, baseLanguage: userExists.baseLanguage},
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
          _id: 0, // exclude id
          soundGroupId: "$_id",
          imageId: "$orthoImage",
          imageObjectUrl: {$arrayElemAt: ["$imageInfo.fileUrl", 0]},
          fileName: {$arrayElemAt: ["$imageInfo.fileName", 0]},
        },
      },
    ]);

    const soundGroups = await SoundGroup.find({user: userExists._id}).exec();

    /*
    // Create an array to store sound group ids to delete
    const soundGroupIdsToDelete = [];

    // Iterate through each sound group
    for (const soundGroup of soundGroups) {
      // Check if there are no associated syllables for the current user
      const syllableCount = await Syllable.countDocuments({
        soundGroup: soundGroup._id,
        user: soundGroup.user,
      });

      if (syllableCount === 0) {
        soundGroupIdsToDelete.push(soundGroup._id);
      }
    }

    // Delete sound groups with no associated syllables
    if (soundGroupIdsToDelete.length > 0) {
      console.log(`soundGroupIdsToDelete:${soundGroupIdsToDelete}`);
      await SoundGroup.deleteMany({_id: {$in: soundGroupIdsToDelete}}).exec();
    }*/

    // Return sound group details
    return res.status(200).json({
      message: "Sound Group Fetched Successfully!",
      data: soundGroupDetails,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({message: `Something went wrong: ${error}`});
  }
};

//Function to skip a sound group fpr a user
const skipImage = async (req, res) => {
  try {
    // Extract data from request body
    const userId = req.body.userId;
    const imageId = req.body.imageId;
    const isSkipRequest = req.body.skip;

    // Check if skip request is a boolean
    if (typeof isSkipRequest !== "boolean") {
      return res.status(400).json({message: `Expected value is either (Boolean) true/false for the isSkipRequest field`});
    }

    // Check if the user exists
    const userExists = await isExistsChecker(User, {_id: userId});
    if (!userExists) return res.status(404).json({message: `User with user id: ${userId} doesn't exist`});

    //Check if base language exists for the user
    if (!userExists.baseLanguage) return res.status(400).json({message: `Base language for this user doesn't exists.`});

    // Check if the image exists
    const imageExists = await isExistsChecker(OrthoImage, {_id: imageId});
    if (!imageExists) return res.status(404).json({message: `Image with image id: ${imageId} doesn't exist`});

    // Check if base language matches
    if (userExists.baseLanguage.toString() !== imageExists.baseLanguage.toString()) {
      return res.status(400).json({message: "Base language id is different for image and user"});
    }

    // Check if syllable exists and sound grouping is not completed
    const syllableAssigned = await isExistsChecker(Syllable, {user: userId, orthoImage: imageId});
    if (!syllableAssigned || syllableAssigned.skippedSyllable === true || syllableAssigned.syllableType === 0) {
      return res.status(400).json({message: "Syllable not yet assigned to the image"});
    }

    const syllableExists = await isExistsChecker(Syllable, {user: userId, orthoImage: imageId});
    console.log(`syllableExists:${JSON.stringify(syllableExists)}`);
    if (syllableExists) {
      if (syllableExists.soundGroup) {
        return res.status(400).json({message: "Cannot skip this image as sound grouping is already completed"});
      }
    }

    // Update syllable document to mark as skipped sound group

    await Syllable.findOneAndUpdate(
      {
        user: userId,
        orthoImage: imageId,
      },
      {
        soundGroup: null,
        skippedSoundGroup: true,
      },
      {new: true}
    ).exec();

    // Get progress data for the user
    const progressData = await getProgressData(userId, userExists.baseLanguage);

    // Define queries for different modules
    const queryMap = {
      "Sound Grouping": {syllableType: {$ne: 0}, soundGroup: {$exists: true, $ne: null}, skippedSyllable: false, skippedSoundGroup: false},
      "Sound Groups": {syllableType: {$ne: 0}, soundGroup: {$exists: true, $ne: null}, skippedSyllable: false, skippedSoundGroup: false},
    };

    // Update progress for each module
    for (const [moduleName, query] of Object.entries(queryMap)) {
      await updateModuleProgress(userId, userExists.baseLanguage, moduleName, query, progressData);
    }

    // Check and update Sound Grouping module
    await checkAndUpdateSoundGroupingModule(userId, userExists.baseLanguage);
    // Check and update Sound Groups module
    await checkAndUpdateSoundGroupsModule(userId, userExists.baseLanguage);

    return res.status(200).json({message: "Sound Grouping for this image skipped successfully!"});
  } catch (error) {
    console.error(error);
    return res.status(500).json({message: `${error}`});
  }
};

const soundGroupGallery = async (req, res) => {
  try {
    // Extract userId from request query
    const userId = req.query.userId;

    // Check if the user exists
    const userExists = await isExistsChecker(User, {_id: userId});
    console.log(userExists);
    if (!userExists) return res.status(404).json({message: `User with user id: ${userId} doesn't exist`});

    // Check if user's base language exists
    if (!userExists.baseLanguage) return res.status(400).json({message: `Base language for this user doesn't exist.`});

    // Fetch all distinct sound groups belonging to the user
    const distinctSoundGroups = await findDistinctSoundGroups(userId);

    console.log(`distinctSoundGroups:${JSON.stringify(distinctSoundGroups)}`);

    const soundGroupGallery = [];

    // Iterate over each distinct sound group
    for (const soundGroupId of distinctSoundGroups) {
      // Fetch sound group details
      const soundGroup = await SoundGroup.findById(soundGroupId).exec();
      console.log(`soundGroup:${JSON.stringify(soundGroup)}`);

      // Fetch images associated with the sound group
      const syllables = await Syllable.find({soundGroup: soundGroupId}).exec();
      const imageList = [];
      for (const syllable of syllables) {
        const orthoImage = await OrthoImage.findById(syllable.orthoImage).exec();
        if (orthoImage) {
          let syllableType;
          switch (syllable.syllableType) {
            case 1:
              syllableType = "MONO";
              break;
            case 2:
              syllableType = "BI";
              break;
            case 3:
              syllableType = "TRI";
              break;
            default:
              syllableType = syllable.syllableType >= 4 && syllable.syllableType <= 9 ? "POLY" : "UNKNOWN";
          }
          imageList.push({
            id: syllable._id,
            imageId: orthoImage._id,
            imageObjectUrl: orthoImage.fileUrl,
            assignLetterCompleted: !syllable.skippedSyllable && !syllable.skippedSoundGroup && !syllable.skippedGrapheme && syllable.grapheme ? true : false,
            syllableType: syllableType,
          });
        }
      }

      // Assemble the sound group gallery object
      const soundGroupData = {
        _id: soundGroup._id,
        soundGroupName: soundGroup._id,
        SGImageUrl: soundGroup.orthoImage ? soundGroup.orthoImage.fileUrl : "",
        SGImageList: imageList,
      };

      soundGroupGallery.push(soundGroupData);
    }

    const processedSoundGroupImages = [];
    for (const soundGroup of soundGroupGallery) {
      console.log("soundGroup:", JSON.stringify(soundGroup));
      if (!soundGroup.SGImageUrl) {
        // Fill SGImageUrl by explicitly checking sound group-> orthoImage-> fileUrl
        console.log("SoundGroup with null SGImageUrl:", JSON.stringify(soundGroup));

        const soundGroupData = await SoundGroup.findOne({_id: new mongoose.Types.ObjectId(soundGroup._id)}).exec();
        const imageData = await OrthoImage.findOne({_id: soundGroupData.orthoImage});
        console.log("SoundGroup Data:", JSON.stringify(soundGroupData));
        console.log("Image Data:", JSON.stringify(imageData));

        if (soundGroupData && soundGroupData.orthoImage && imageData.fileUrl) {
          soundGroup.SGImageUrl = imageData.fileUrl;
        }
      }
      processedSoundGroupImages.push(soundGroup);
    }

    console.log(`processedSoundGroupImages:${processedSoundGroupImages}`);
    if (processedSoundGroupImages.length === 0) {
      return res.status(200).json({message: `No images found`});
    }

    return res.status(200).json({
      message: "Images Fetched Successfully!",
      data: processedSoundGroupImages,
    });
  } catch (error) {
    console.error("Error fetching sound group gallery:", error);
    throw error;
  }
};

// Query to find distinct sound groups for a user
const findDistinctSoundGroups = async userId => {
  return await SoundGroup.find({user: userId}, "id user baseLanguage orthoImage").exec();
};

const checkStatusOfImagesCompletedForSoundGroup = async (req, res) => {
  try {
    const userId = req.query.userId;

    // Initialize completion status object with default values
    let completionStatus = {
      mono: false,
      bi: false,
      tri: false,
      poly: false,
      soundGroupingCompleted: false,
      count20CheckCompleted: false,
    };
    // Check if the user exists
    const userExists = await isExistsChecker(User, {_id: userId});
    if (!userExists) return res.status(404).json({message: `User with user id: ${userId} doesn't exist`});

    // If base language is not available for the user, return a 400 response
    if (!userExists.baseLanguage) {
      return res.status(400).json({message: `Base language for this user doesn't exist.`});
    }

    // Check sound group completion status
    await checkSoundGroupCompletedBySyllable(userId, completionStatus);

    // Check if count of completed items is multiple of 20
    completionStatus.count20CheckCompleted = await count20CheckCompleted(userId);

    // Check overall sound grouping completion status
    completionStatus.soundGroupingCompleted = await checkSoundGroupCompleted(userExists);

    return res.status(200).json({message: "Data fetched successfully!", data: completionStatus});
  } catch (error) {
    return res.status(500).json({message: `${error}`});
  }
};

// Function to check if count of completed items is multiple of 20
//Periodic check
const count20CheckCompleted = async userId => {
  const completedCount = await Syllable.countDocuments({
    user: userId,
    skippedSoundGroup: false,
    skippedSyllable: false,
    soundGroup: {$exists: true, $ne: null},
  });
  let isMultipleOf20;

  // Check if completed count is multiple of 20
  if (completedCount === 0) {
    isMultipleOf20 = false;
  } else {
    isMultipleOf20 = completedCount % 20 === 0;
  }
  console.log(`isMultipleOf20:${isMultipleOf20}`);

  return isMultipleOf20;
};

// Function to check overall sound grouping completion status
const checkSoundGroupCompleted = async userExists => {
  // Count total images for the user's base language
  const totalImagesCount = await OrthoImage.countDocuments({baseLanguage: userExists.baseLanguage});

  // Count completed syllables
  const completedCount = await Syllable.countDocuments({
    user: userExists._id,
    skippedSoundGroup: false, // Indicates sound grouping was not skipped
    skippedSyllable: false, // Indicates sound grouping is completed
    soundGroup: {$exists: true, $ne: null},
  });

  // Check if total completed count matches total image count
  if (totalImagesCount === completedCount) return true;
  return totalImagesCount === completedCount;
};

// Function to check sound group completion status by syllable type
const checkSoundGroupCompletedBySyllable = async (userId, completionStatus) => {
  // Count total syllables for each type
  const totalMonoSyllables = await Syllable.countDocuments({user: userId, syllableType: 1});
  const totalBiSyllables = await Syllable.countDocuments({user: userId, syllableType: 2});
  const totalTriSyllables = await Syllable.countDocuments({user: userId, syllableType: 3});
  const totalPolySyllables = await Syllable.countDocuments({user: userId, syllableType: {$in: [4, 5, 6, 7, 8, 9]}});

  console.log(`totalMonoSyllables;${totalMonoSyllables}`);
  console.log(`totalBiSyllables;${totalBiSyllables}`);
  console.log(`totalTriSyllables;${totalTriSyllables}`);
  console.log(`totalPolySyllables;${totalPolySyllables}`);

  // Count completed syllables for each type
  const completedMonoCount = await Syllable.countDocuments({
    user: userId,
    syllableType: 1,
    skippedSoundGroup: false,
    skippedSyllable: false,
    soundGroup: {$exists: true, $ne: null},
  });

  const completedBiCount = await Syllable.countDocuments({
    user: userId,
    syllableType: 2,
    skippedSoundGroup: false,
    skippedSyllable: false,
    soundGroup: {$exists: true, $ne: null},
  });

  const completedTriCount = await Syllable.countDocuments({
    user: userId,
    syllableType: 3,
    skippedSoundGroup: false,
    skippedSyllable: false,
    soundGroup: {$exists: true, $ne: null},
  });

  const completedPolyCount = await Syllable.countDocuments({
    user: userId,
    syllableType: {$in: [4, 5, 6, 7, 8, 9]},
    skippedSoundGroup: false,
    skippedSyllable: false,
    soundGroup: {$exists: true, $ne: null},
  });

  // Update completion status based on completed counts
  console.log(`completedPolyCount:${completedPolyCount}`);
  completionStatus.mono = completedMonoCount > 0 && completedMonoCount === totalMonoSyllables;
  completionStatus.bi = completedBiCount > 0 && completedBiCount === totalBiSyllables;
  completionStatus.tri = completedTriCount > 0 && completedTriCount === totalTriSyllables;
  completionStatus.poly = completedPolyCount > 0 && completedPolyCount === totalPolySyllables;
};

const soundGroupGalleryByType = async (req, res) => {
  try {
    // Extract userId and soundGroup from request
    const userId = req.query.userId;
    const soundGroup = req.query.soundGroupId;

    // Check if the user exists
    const userExists = await isExistsChecker(User, {_id: userId});
    if (!userExists) return res.status(404).json({message: `User with user id: ${userId} doesn't exist`});

    // Check if base language exists for the user
    if (!userExists.baseLanguage) return res.status(400).json({message: `Base language for this user doesn't exists.`});

    // Check if sound group exists
    const soundGroupExists = await isExistsChecker(SoundGroup, {_id: soundGroup});
    if (!soundGroupExists) return res.status(404).json({message: `Sound Group doesn't exists.`});

    // Fetch the images for the specified syllable type for the user
    const soundGroupDoc = await Syllable.aggregate([
      {
        $match: {user: userExists._id, soundGroup: soundGroupExists._id},
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
          languageId: userExists.baseLanguage,
          userId: userExists._id,
          soundGroup: soundGroup,
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
        },
      },
    ]);

    console.log(`soundGroupDoc:${soundGroupDoc}`);

    // If no images found, return appropriate response
    if (!soundGroupDoc || soundGroupDoc.length === 0) {
      return res.status(200).json({message: `No images found`, data: soundGroupDoc});
    }
    return res.status(200).json({
      message: `Images Fetched Successfully for sound group: ${soundGroup}`,
      data: soundGroupDoc,
    });
  } catch (error) {
    console.error("Error:" + error);
    return res.status(500).json({message: `${error}`});
  }
};

// Function to fetch a training video
const getTrainingVideo = async (req, res) => {
  try {
    // Define the file name of the training vide
    const fileName = "Orthography_Training_Video1.mp4";

    // Find the training video document in the database based on the file name
    const trainingVideo = await TrainingVideo.findOne({fileName}).exec();

    // If no training video is found, return a 404 status with a corresponding message
    if (!trainingVideo) {
      return res.status(404).json({message: "Training Video not found."});
    }
    res.status(200).json({message: "Training Video Fetched Successfully!", data: trainingVideo});
  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({message: `Something went wrong : ${error}`});
  }
};

const deleteSoundGroup = async (req, res) => {
  try {
    // Extract userId and soundGroupId from request
    const userId = req.query.userId;
    const soundGroup = req.query.soundGroupId;

    // Check if the user exists
    const userExists = await User.findOne({_id: userId}).exec();
    if (!userExists) {
      return res.status(404).json({message: `User with user id: ${userId} doesn't exist`});
    }

    // Check if the user has a base language
    if (!userExists.baseLanguage) {
      return res.status(400).json({message: `Base language for this user doesn't exists.`});
    }

    // Check if the sound group exists
    const soundGroupExists = await SoundGroup.findOne({_id: soundGroup});
    if (!soundGroupExists) {
      return res.status(404).json({message: `Sound Group doesn't exists.`});
    }

    // Update skippedSoundGroup field and remove soundGroup and grapheme fields
    const updatedSoundGroup = await Syllable.updateMany({user: userId, soundGroup: soundGroup}, [
      {
        $set: {
          skippedSoundGroup: true,
          skippedGrapheme: {
            $cond: [
              {$ifNull: ["$grapheme", false]},
              true, // Set to true when grapheme exists
              "$skippedGrapheme", // Keep existing value when grapheme is null or undefined
            ],
          },
        },
      },

      {
        $unset: ["soundGroup", "grapheme"],
      },
    ]);

    console.log(updatedSoundGroup);

    //update incomplete count, skippedcount, percentageComplete
    const progressData = await getProgressData(userExists._id, userExists.baseLanguage);

    const queryMap = {
      // "Identify Syllables": {syllableType: {$ne: 0}, skippedSyllable: false},
      // "Syllable Groups": {syllableType: {$ne: 0}, skippedSyllable: false},
      "Sound Grouping": {syllableType: {$ne: 0}, soundGroup: {$exists: true, $ne: null}, skippedSyllable: false, skippedSoundGroup: false},
      "Sound Groups": {syllableType: {$ne: 0}, soundGroup: {$exists: true, $ne: null}, skippedSyllable: false, skippedSoundGroup: false},
      "Assign Letters": {grapheme: {$exists: true, $ne: null}, skippedGrapheme: true},
      "Letter Groups": {grapheme: {$exists: true, $ne: null}, skippedGrapheme: true},
      "Alphabet Chart": {grapheme: {$exists: true, $ne: null}, skippedGrapheme: true},
    };

    // Update progress for each module
    for (const [moduleName, query] of Object.entries(queryMap)) {
      await updateModuleProgress(userExists._id, userExists.baseLanguage, moduleName, query, progressData);
    }

    // Check and update progress for each module
    await checkAndUpdateSoundGroupingModule(userExists._id, userExists.baseLanguage);

    await checkAndUpdateSoundGroupsModule(userExists._id, userExists.baseLanguage);

    await checkAndUpdateAssignLettersModule(userExists._id, userExists.baseLanguage);

    await checkAndUpdateLetterGroupsModule(userExists._id, userExists.baseLanguage);

    await checkAndUpdateAlphabetChartModule(userExists._id, userExists.baseLanguage);

    //delete sound group records from sound group collection
    await SoundGroup.deleteMany({user: userId, _id: soundGroup});

    return res.status(200).json({message: "Sound Group deleted successfully!"});
  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({message: `Something went wrong : ${error}`});
  }
};

// Function to update progress for various modules
const updateModulesProgress = async (userId, baseLanguage) => {
  const progressData = await getProgressData(userId, baseLanguage);

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

  // Check and update progress for each module
  await checkAndUpdateSoundGroupingModule(userId, baseLanguage);
  await checkAndUpdateSoundGroupsModule(userId, baseLanguage);
  await checkAndUpdateAssignLettersModule(userId, baseLanguage);
  await checkAndUpdateLetterGroupsModule(userId, baseLanguage);
  await checkAndUpdateAlphabetChartModule(userId, baseLanguage);
};

const deleteAllEmptySoundGroup = async (req, res) => {
  try {
    const userId = req.query.userId;
    const timestamp = new Date().toISOString();
    // Check if the user exists
    const userExists = await User.findOne({_id: userId}).exec();
    if (!userExists) {
      return res.status(404).json({message: `User with user id: ${userId} doesn't exist`});
    }

    // Check if the user has a base language
    if (!userExists.baseLanguage) {
      return res.status(400).json({message: `Base language for this user doesn't exists.`});
    }

    const soundGroups = await SoundGroup.find({user: userExists._id}).exec();
    console.log(`${timestamp}-soundGroups:${JSON.stringify(soundGroups)}`);

    // Create an array to store sound group ids to delete
    const soundGroupIdsToDelete = [];

    // Iterate through each sound group
    for (const soundGroup of soundGroups) {
      // Check if there are no associated syllables for the current user
      const syllableCount = await Syllable.countDocuments({
        soundGroup: soundGroup._id,
        user: soundGroup.user,
      });

      if (syllableCount === 0) {
        soundGroupIdsToDelete.push(soundGroup._id);
      }
    }

    // Delete sound groups with no associated syllables
    if (soundGroupIdsToDelete.length > 0) {
      console.log(`${timestamp}-soundGroupIdsToDelete:${soundGroupIdsToDelete}`);
      await SoundGroup.deleteMany({_id: {$in: soundGroupIdsToDelete}}).exec();
    }

    return res.status(200).json({
      message: "Empty Sound Groups Deleted Successfully!",
    });
  } catch (error) {
    console.error("Error:" + error);
    return res.status(500).json({message: `${error}`});
  }
};
module.exports = {createSoundGroup, assignSoundGroup, skipImage, soundGroupGallery, soundGroupGalleryByType, getTrainingVideo, getSoundGroupList, checkStatusOfImagesCompletedForSoundGroup, deleteSoundGroup, deleteAllEmptySoundGroup};
