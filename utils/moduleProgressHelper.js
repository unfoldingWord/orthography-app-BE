const User = require("../models/User");
const OrthoImage = require("../models/OrthoImage");
const Syllable = require("../models/Syllable");
const ModuleProgress = require("../models/ModuleProgress");
const TrainingVideo = require("../models/TrainingVideo");
const BaseLanguage = require("../models/BaseLanguage");
const SoundGroup = require("../models/SoundGroup");
const mongoose = require("mongoose");

const getProgressData = async (userId, baseLanguageId) => {
  // Fetch total image count for the base language
  const totalImagesCount = await OrthoImage.countDocuments({baseLanguage: baseLanguageId});

  // Fetch completed image count for the user
  const completedImagesCount = await Syllable.countDocuments({user: userId});

  // Fetch counts of skipped syllable images, skipped sound groups, and skipped graphemes
  const skippedSyllableImages = await Syllable.countDocuments({user: userId, skippedSyllable: true});
  const skippedSoundGroup = await Syllable.countDocuments({user: userId, skippedSoundGroup: true});
  const skippedGrapheme = await Syllable.countDocuments({user: userId, skippedGrapheme: true});

  // Return the progress data
  return {
    totalImagesCount,
    completedImagesCount,
    skippedImages: {
      "Identify Syllables": skippedSyllableImages,
      "Sound Grouping": skippedSoundGroup,
      "Sound Groups": skippedSoundGroup,
      "Assign Letters": skippedGrapheme,
      "Letter Groups": skippedGrapheme,
      "Alphabet Chart": skippedGrapheme,
    },
  };
};

const updateModuleProgress = async (userId, baseLanguageId, moduleName, query, progressData) => {
  try {
    // Extract necessary progress data from the progressData object
    const {totalImagesCount} = progressData;

    // Calculate completedImagesCount based on the provided query
    const completedImagesCount = await Syllable.countDocuments({user: userId, ...query});

    // Calculate percentage completion
    const percentageComplete = totalImagesCount === 0 ? 0 : (completedImagesCount / totalImagesCount) * 100;

    // Prepare update data for ModuleProgress document
    const updateData = {
      totalImages: totalImagesCount,
      completedImages: completedImagesCount,
      incompletedImages: totalImagesCount - completedImagesCount,
      percentageCompleted: percentageComplete,
      skippedImages: progressData.skippedImages[moduleName],
      isOpen: moduleName === "Identify Syllables" || completedImagesCount > 0,
    };

    // Update ModuleProgress document
    await ModuleProgress.findOneAndUpdate({user: userId, module: moduleName, baseLanguage: baseLanguageId}, {$set: updateData}, {new: true}).exec();
  } catch (error) {
    // Handle errors
    console.error(`Error updating progress for ${moduleName}: ${error}`);
    throw new Error(`Error updating progress for ${moduleName}`);
  }
};

const checkAndUpdateSoundGroupingModule = async (userId, baseLanguageId) => {
  // Check if Sound Grouping should be opened based on PercentageComplete
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
    if (percentageComplete >= 50) {
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

const checkAndUpdateSoundGroupsModule = async (userId, baseLanguageId) => {
  // Check if at least one Sound Group is assigned

  const soundGroupModule = await ModuleProgress.findOne({
    user: userId,
    baseLanguage: baseLanguageId,
    module: "Sound Groups",
  }).exec();

  const syllableModule = await ModuleProgress.findOne({
    user: userId,
    baseLanguage: baseLanguageId,
    module: "Syllable Groups",
  }).exec();

  console.log(`checkAndUpdateSoundGroupsModule: ${JSON.stringify(checkAndUpdateSoundGroupsModule)}`);

  const soundGroupAssigned = await Syllable.exists({
    user: userId,
    soundGroup: {$exists: true, $ne: null},
  }).exec();

  console.log(`soundGroupAssigned: ${JSON.stringify(soundGroupAssigned)}`);

  if (soundGroupModule) {
    console.log(`soundGroupAssigned:${JSON.stringify(soundGroupAssigned)}`);
    if (soundGroupAssigned && syllableModule.percentageCompleted >= 50) {
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

const checkAndUpdateAssignLettersModule = async (userId, baseLanguageId) => {
  // Check if Sound Grouping should be opened based on PercentageComplete
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
    if (percentageComplete >= 10) {
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

const checkAndUpdateLetterGroupsModule = async (userId, baseLanguageId) => {
  // Check if at least one Sound Group is assigned

  //Uncomment for next sprint
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

  console.log(`checkAndUpdateSoundGroupsModule: ${JSON.stringify(checkAndUpdateSoundGroupsModule)}`);

  const assignLetterGroupAssigned = await Syllable.exists({
    user: userId,
    grapheme: {$exists: true, $ne: null},
  }).exec();

  if (assignLettersModule) {
    console.log(`assignLetterGroupAssigned:${JSON.stringify(assignLetterGroupAssigned)}`);
    if (assignLetterGroupAssigned && soundModule.percentageCompleted >= 10) {
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
  // Check if at least one Sound Group is assigned

  //Uncomment for next sprint
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

  console.log(`checkAndUpdateSoundGroupsModule: ${JSON.stringify(checkAndUpdateSoundGroupsModule)}`);

  const assignLetterGroupAssigned = await Syllable.exists({
    user: userId,
    grapheme: {$exists: true, $ne: null},
  }).exec();

  if (assignLettersModule) {
    console.log(`assignLetterGroupAssigned:${JSON.stringify(assignLetterGroupAssigned)}`);
    if (assignLetterGroupAssigned && soundModule.percentageCompleted >= 10) {
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

module.exports = {getProgressData, updateModuleProgress, checkAndUpdateSoundGroupingModule, checkAndUpdateAssignLettersModule, checkAndUpdateLetterGroupsModule, checkAndUpdateAlphabetChartModule, checkAndUpdateSoundGroupsModule};
