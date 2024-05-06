const express = require("express");
const router = express.Router();
const {addTrainingVideo, getTrainingVideo, deleteTrainingVideo, updateUserWatchStatus} = require("../controllers/trainingVideoController");
const validateObjectIds = require("../middlewares/validateObjectIdsMiddleware");
router.post("/add", addTrainingVideo);
router.get("/get", validateObjectIds(["code"]), getTrainingVideo);
router.delete("/delete", validateObjectIds(["_id"]), deleteTrainingVideo);
router.post("/updateUserVideosWatchedStatus", validateObjectIds(["userId", "status"]), updateUserWatchStatus);

module.exports = router;
