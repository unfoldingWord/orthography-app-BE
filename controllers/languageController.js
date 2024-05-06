const BaseLanguage = require("../models/BaseLanguage");
const User = require("../models/User");
const ModuleProgress = require("../models/ModuleProgress");
const OrthoImage = require("../models/OrthoImage");

//Add Base language function
const addBaseLanguage = async (req, res) => {
  try {
    console.log("Inside add base language method");

    // Extract name and code from request body
    const name = req.body.name;
    const code = req.body.code;

    // Check if name or code is missing in the request
    if (!name || !code) {
      return res.status(400).json({message: "Code and name are mandatory in the request parameters."});
    }
    console.log(`Language name :  ${name}, Language code: ${code}`);

    // Check if language with the same name or code already exists
    const checkIfAlreadyExists = await BaseLanguage.findOne({
      $or: [{name: {$regex: new RegExp("^" + name + "$", "i")}}, {code: {$regex: new RegExp("^" + code + "$", "i")}}],
    }).exec();

    // If language already exists, return an error message
    if (checkIfAlreadyExists) {
      if (checkIfAlreadyExists.name.toLowerCase() === name.toLowerCase()) {
        return res.status(400).json({message: "Language with this name already exists!"});
      } else {
        return res.status(400).json({message: "Language with this code already exists!"});
      }
    }

    // If language doesn't exist, create a new language entry
    const result = await BaseLanguage.create({
      name: name,
      code: code,
    });

    return res.status(201).json({message: "Base Language Created Successfully!", data: result});
  } catch (error) {
    console.error(error);
    return res.status(500).json({message: `Something went wrong : ${error}`});
  }
};

// Get base language function
const getBaseLanguage = async (req, res) => {
  console.log("Inside get base language api");
  try {
    // Extract query parameters from request
    const code = req.query.code;
    const name = req.query.name;
    let query;

    // Construct query based on provided parameters
    if (code) {
      // If 'code' parameter is provided, search by code
      query = {code: {$regex: new RegExp("^" + code + "$", "i")}};
    } else if (name) {
      // If 'name' parameter is provided, search by name
      query = {name: {$regex: new RegExp("^" + name + "$", "i")}};
    }

    // Perform database query
    const result = await BaseLanguage.find(query).exec();

    // If no result found, return 404 status
    if (!result || result.length === 0) {
      return res.status(404).json({message: "Base Language not found."});
    }

    // If result found, return 200 status with the result
    return res.status(200).json({message: "Base Language Fetched Successfully!", data: Array.isArray(result) ? result : [result]});
  } catch (error) {
    console.log(error);
    return res.status(500).json({message: `Something went wrong : ${error}`});
  }
};

// Delete base language function
const deleteBaseLanguage = async (req, res) => {
  try {
    console.log("Inside delete base language api");

    // Retrieve _id from request query parameters
    const _id = req.query._id;

    // Check if _id is provided, if not, return a 400 response with a message
    if (!_id) {
      return res.status(400).json({message: `Please provide base language id`});
    }

    // Check if the base language with the given _id exists
    const checkIfAlreadyExists = await BaseLanguage.findOne({_id});

    // If base language doesn't exist, return a 400 response with a message
    if (!checkIfAlreadyExists) {
      return res.status(400).json({message: `Base language with id: ${_id} doesn't exist`});
    }

    // Find and delete the base language with the given _id
    const language = await BaseLanguage.findOneAndDelete({_id});

    // Return a 201 response indicating successful deletion
    return res.status(201).json({message: `Base language deleted successfully!`});
  } catch (error) {
    // Return a 500 response if an error occurs during the deletion process
    return res.status(500).json({message: `Something went wrong : ${error}`});
  }
};

const addBaseLanguageForUser = async (req, res) => {
  try {
    console.log("Inside add base language for user");

    // Extracting user id, code, and language name from request body
    const _id = req.body.userId;
    const code = req.body.code;
    const languageName = req.body.name;
    console.log(`user id:${_id} , code : ${code}`);

    // Checking if user id is provided
    if (!_id) {
      return res.status(400).json({message: "User id is mandatory"});
    }

    // Checking if either code or language name is provided
    if (!code && !languageName) {
      return res.status(400).json({message: `Code/language name is mandatory`});
    }

    // Checking if user exists in the database
    const userExists = await User.findOne({_id: _id}).exec();

    if (!userExists) {
      // Returning 404 status if user is not found
      return res.status(404).json({message: `User with user id : ${_id} doesn't exists!`});
    }

    console.log(`${JSON.stringify(userExists)}`);

    // Finding base language by code or language name
    let baseLanguage;
    if (code) {
      baseLanguage = await BaseLanguage.findOne({code: {$regex: new RegExp("^" + code + "$", "i")}}).exec();
      if (!baseLanguage || baseLanguage.length === 0) {
        return res.status(404).json({message: `Base Language not found with code:${code}.`});
      }
    } else if (languageName) {
      baseLanguage = await BaseLanguage.findOne({name: {$regex: new RegExp("^" + languageName + "$", "i")}}).exec();
      if (!baseLanguage || baseLanguage.length === 0) {
        return res.status(404).json({message: `Base Language not found with language name : ${languageName}`});
      }
    }

    console.log(`User fetched:${JSON.stringify(baseLanguage)}`);

    // Updating user's base language
    const update = {baseLanguage: baseLanguage._id};
    const updatedUser = await User.findOneAndUpdate({_id}, update, {new: true}).exec();
    console.log(`Updated user:${JSON.stringify(updatedUser)}`);

    // Check if module progress already exists for the user
    const moduleProgressExists = await ModuleProgress.findOne({user: updatedUser._id, baseLanguage: updatedUser.baseLanguage}).exec();

    // If progress doesn't exist, initialize it
    if (!moduleProgressExists) {
      await initializeModule(updatedUser._id, updatedUser.baseLanguage);
    }
    return res.status(200).json({message: "User updated with base language", data: updatedUser});
  } catch (error) {
    return res.status(500).json({message: `Something went wrong : ${error}`});
  }
};

async function initializeModule(userId, baseLanguageId) {
  // Create initial ModuleProgress records
  const totalImagesCount = await OrthoImage.countDocuments({baseLanguage: baseLanguageId});
  const syllablesModuleProgress = await ModuleProgress.create({
    user: userId,
    module: "Identify Syllables",
    baseLanguage: baseLanguageId,
    totalImages: totalImagesCount,
    completedImages: 0,
    percentageComplete: 0,
    incompletedImages: totalImagesCount,
    skippedImages: 0,
    isOpen: true, // Set the default value to true
  });

  const syllableGroupingModuleProgress = await ModuleProgress.create({
    user: userId,
    module: "Syllable Groups",
    baseLanguage: baseLanguageId,
    totalImages: totalImagesCount,
    completedImages: 0,
    percentageComplete: 0,
    incompletedImages: totalImagesCount,
    skippedImages: 0,
    isOpen: false,
  });

  const soundGrouping = await ModuleProgress.create({
    user: userId,
    module: "Sound Grouping",
    baseLanguage: baseLanguageId,
    totalImages: totalImagesCount,
    completedImages: 0,
    percentageComplete: 0,
    incompletedImages: totalImagesCount,
    skippedImages: 0,
    isOpen: false, // You might set this to false initially, depending on your logic
  });

  const soundGroups = await ModuleProgress.create({
    user: userId,
    module: "Sound Groups",
    baseLanguage: baseLanguageId,
    totalImages: totalImagesCount,
    completedImages: 0,
    percentageComplete: 0,
    incompletedImages: totalImagesCount,
    skippedImages: 0,
    isOpen: false,
  });

  const assignLetters = await ModuleProgress.create({
    user: userId,
    module: "Assign Letters",
    baseLanguage: baseLanguageId,
    totalImages: totalImagesCount,
    completedImages: 0,
    percentageComplete: 0,
    incompletedImages: totalImagesCount,
    skippedImages: 0,
    isOpen: false,
  });

  const letterGroups = await ModuleProgress.create({
    user: userId,
    module: "Letter Groups",
    baseLanguage: baseLanguageId,
    totalImages: totalImagesCount,
    completedImages: 0,
    percentageComplete: 0,
    incompletedImages: totalImagesCount,
    skippedImages: 0,
    isOpen: false,
  });

  const alphabetChart = await ModuleProgress.create({
    user: userId,
    module: "Alphabet Chart",
    baseLanguage: baseLanguageId,
    totalImages: totalImagesCount,
    completedImages: 0,
    percentageComplete: 0,
    incompletedImages: totalImagesCount,
    skippedImages: 0,
    isOpen: false,
  });
}

module.exports = {addBaseLanguage, getBaseLanguage, deleteBaseLanguage, addBaseLanguageForUser};
