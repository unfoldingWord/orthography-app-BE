const {json} = require("express");
const User = require("../models/User");

const loginUser = async (req, res) => {
  try {
    const phoneNumber = req.body.phoneNumber;
    const phoneCode = req.body.phoneCode;

    if (!phoneNumber || !phoneCode) {
      return res.status(400).json({message: "Phone number and phone code are mandatory fields"});
    }
    const userExists = await User.findOne({
      phoneNumber: phoneNumber.trim(),
      phoneCode: phoneCode.trim(),
    }).exec();
    if (userExists) {
      return res.status(200).json({message: "User already exists", data: userExists});
    } else {
      const validationResult = await validatePhoneNumber(phoneNumber, phoneCode);
      if (!validationResult.isValid) {
        return res.status(400).json({message: validationResult.errorMessage});
      }

      const result = await User.create({
        phoneNumber: phoneNumber,
        phoneCode: phoneCode,
      });

      return res.status(201).json({message: `New user with ${phoneNumber} created!`, data: result});
    }
  } catch (error) {
    return res.status(500).json({message: `Something went wrong : ${error}`});
  }
};

async function validatePhoneNumber(phoneNumber, phoneCode) {
  try {
    if (phoneNumber.includes(" ")) {
      return {isValid: false, errorMessage: "Spaces are not allowed in phone Number"};
    }
    if (phoneCode.includes(" ")) {
      return {isValid: false, errorMessage: "Spaces are not allowed in phone code"};
    }

    const phoneNumberRegex = /^[\d]{1,24}$/;
    if (!phoneNumberRegex.test(phoneNumber)) {
      return {isValid: false, errorMessage: "Invalid phone number format"};
    }

    return {isValid: true, errorMessage: null};
  } catch (error) {
    console.error("Error validating phone number:", error);
    return {isValid: false, errorMessage: "Internal server error during phone number validation"};
  }
}

module.exports = {loginUser};
