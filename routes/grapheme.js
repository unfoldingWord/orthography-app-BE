const express = require("express");
const router = express.Router();
const {assignGrapheme, getMetadata, skipGrapheme, getTrainingVideo, letterGroupGallery, letterGroupGalleryByType, getLettersForUser, checkGraphemeCompleted} = require("../controllers/graphemeController");
const validateObjectIds = require("../middlewares/validateObjectIdsMiddleware");

router.post("/assignLetter", validateObjectIds(["userId"]), assignGrapheme);
router.get("/getMetadata", validateObjectIds(["userId", "imageId"]), getMetadata);
router.get("/letterGroupGallery", validateObjectIds(["userId"]), letterGroupGallery);
router.get("/letterGroupGalleryByType", validateObjectIds(["userId"]), letterGroupGalleryByType);
router.post("/skipImage", validateObjectIds(["userId", "imageId"]), skipGrapheme);
router.get("/getTrainingVideo", getTrainingVideo);
router.get("/getLettersForUser", validateObjectIds(["userId"]), getLettersForUser);
router.get("/graphemeCompletionStatus", validateObjectIds(["userId"]), checkGraphemeCompleted);

module.exports = router;
