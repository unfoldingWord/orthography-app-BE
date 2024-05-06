const {isExistsChecker, generatePdf} = require("../utils/helper");
const User = require("../models/User");

// Function to download PDF for a user
const downloadPdf = async (req, res) => {
  try {
    // Extract userId from request query
    const userId = req.query.userId;

    // Check if user exists
    const userExists = await isExistsChecker(User, {_id: userId});

    // If user doesn't exist, return 404 error
    if (!userExists) {
      return res.status(404).json({message: `User with user id: ${userId} doesn't exist`});
    }

    // Generate PDF for the existing user
    const pdfObjectUrl = await generatePdf(userExists);

    // Return success response with PDF URL
    return res.status(200).json({message: "Pdf generated", data: pdfObjectUrl});
  } catch (error) {
    console.error(error);
    return res.status(500).json({message: `Something went wrong : ${error}`});
  }
};

module.exports = {downloadPdf};
