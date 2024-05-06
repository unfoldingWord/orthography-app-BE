const User = require("../models/User");
const BaseLanguage = require("../models/BaseLanguage");
const ModuleProgress = require("../models/ModuleProgress");

const getModuleProgressForUser = async (req, res) => {
  try {
    const userId = req.query.userId;
    const code = req.query.code;
    const module = req.query.module;

    console.log(`${userId}, ${code}, ${module}`);
    if (!userId || !code || !module) {
      return res.status(400).json({message: "Invalid input"});
    }

    const userExists = await User.findOne({_id: userId}).exec();
    if (!userExists) {
      return res.status(404).json({message: "User doesn't exists"});
    }

    const baseLanguageExists = await BaseLanguage.findOne({
      code: {$regex: new RegExp("^" + code + "$", "i")},
    }).exec();

    if (!baseLanguageExists) {
      return res.status(404).json({message: "Base language not found"});
    }

    const moduleDetails = await ModuleProgress.findOne({baseLanguage: baseLanguageExists._id, user: userExists._id, module: module});

    if (!moduleDetails) {
      return res.status(404).json({message: "Module progress details not found"});
    }

    console.log(`moduleDetails:${moduleDetails}`);
    return res.status(200).json({message: "Details fetched sucessfully!", data: moduleDetails});
  } catch (error) {
    return res.status(500).json({message: "Something went wrong:${error}"});
  }
};

const getModuleProgressForUserAll = async (req, res) => {
  try {
    const userId = req.query.userId;
    const code = req.query.code;

    if (!userId || !code) {
      return res.status(400).json({message: "Invalid input"});
    }

    const userExists = await User.findOne({_id: userId}).exec();
    if (!userExists) {
      return res.status(404).json({message: "User doesn't exist"});
    }

    const baseLanguageExists = await BaseLanguage.findOne({
      code: {$regex: new RegExp("^" + code + "$", "i")},
    }).exec();

    if (!baseLanguageExists) {
      return res.status(404).json({message: "Base language not found"});
    }

    const moduleDetails = await ModuleProgress.find({
      baseLanguage: baseLanguageExists._id,
      user: userExists._id,
    });

    console.log(moduleDetails);

    if (moduleDetails.length === 0) {
      return res.status(200).json({
        message: `No details found for user with language code ${code}`,
      });
    }

    // Calculate summary statistics for each module
    const summaryData = moduleDetails.map(module => ({
      TotalImages: module.totalImages,
      CompletedImages: module.completedImages,
      IncompletedImages: module.incompletedImages,
      PercentageComplete: module.totalImages > 0 ? Math.floor((module.completedImages / module.totalImages) * 100) : 0,
      SkippedImages: module.skippedImages,
      module: module.module,
      isOpen: module.isOpen,
    }));

    return res.status(200).json({
      message: "Details fetched successfully!",
      data: summaryData,
    });
  } catch (error) {
    return res.status(500).json({message: `Something went wrong: ${error}`});
  }
};

module.exports = {getModuleProgressForUser, getModuleProgressForUserAll};
