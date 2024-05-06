const mongoose = require("mongoose");

const validateObjectIds = paramNames => (req, res, next) => {
  const errors = [];
  let typeCheckFlag = true;

  const validateParam = (param, paramName, typeCheck) => {
    console.log(`param:${param}`);
    if (param === null || param === "") {
      errors.push(`Invalid ${paramName}`);
    } else if (typeCheck && !mongoose.Types.ObjectId.isValid(param)) {
      errors.push(`Invalid ${paramName}`);
    }
  };

  if (req.method === "POST") {
    paramNames.forEach(paramName => {
      typeCheckFlag = paramName.toLowerCase().includes("id") ? true : false;
      console.log(`Typecheck for paramName:${paramName} is ${typeCheckFlag}`);
      validateParam(req.body[paramName], paramName, typeCheckFlag);
    });
  }

  if (req.method === "GET" || req.method === "DELETE") {
    paramNames.forEach(paramName => {
      typeCheckFlag = paramName.toLowerCase().includes("id") ? true : false;
      validateParam(req.query[paramName], paramName, typeCheckFlag);
    });
  }

  if (errors.length > 0) {
    return res.status(400).json({message: "Invalid parameters", errors});
  }

  next();
};

module.exports = validateObjectIds;
