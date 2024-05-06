const express = require("express");
const router = express.Router();
const {getModuleProgressForUser, getModuleProgressForUserAll} = require("../controllers/moduleProgressController");
const validateObjectIds = require("../middlewares/validateObjectIdsMiddleware");
router.get("/getProgress", validateObjectIds(["userId", "code", "module"]), getModuleProgressForUser);
router.get("/getProgressAll", validateObjectIds(["userId", "code"]), getModuleProgressForUserAll);

module.exports = router;
