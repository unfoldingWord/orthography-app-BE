const express = require("express");
const router = express.Router();
const {addOrthoImage, deleteOrthoImage, getOrthoImage, getTrainingVideo} = require("../controllers/orthoImageController");
const validateObjectIds = require("../middlewares/validateObjectIdsMiddleware");
router.post("/add", addOrthoImage);
router.get("/get", validateObjectIds(["userId", "code"]), getOrthoImage);
router.delete("/delete", validateObjectIds(["_id"]), deleteOrthoImage);
router.get("/getTrainingVideo", getTrainingVideo);

module.exports = router;
