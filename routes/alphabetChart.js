const express = require("express");
const router = express.Router();
const validateObjectIds = require("../middlewares/validateObjectIdsMiddleware");
const {downloadPdf} = require("../controllers/alphabetChartExportController");
router.get("/downloadPDF", validateObjectIds(["userId"]), downloadPdf);

module.exports = router;
