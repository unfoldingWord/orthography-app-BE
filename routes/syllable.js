const express = require("express");
const router = express.Router();

const {assignSyllable, skipImage, syllableGallery, updateSyllable, syllableGalleryByType, getTrainingVideo} = require("../controllers/syllableController");
const validateObjectIds = require("../middlewares/validateObjectIdsMiddleware");

router.post("/assignSyllable", assignSyllable);
router.post("/skipImage", validateObjectIds(["userId", "imageId", "skip"]), skipImage);
router.get("/syllableGallery", validateObjectIds(["userId"]), syllableGallery);
router.post("/updateSyllable", validateObjectIds(["userId", "imageId", "syllable"]), updateSyllable);
router.get("/getSyllableByType", validateObjectIds(["userId", "syllableType"]), syllableGalleryByType);
router.get("/getTrainingVideo", getTrainingVideo);
module.exports = router;
