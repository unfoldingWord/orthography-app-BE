const express = require("express");
const router = express.Router();
const {addBaseLanguage, getBaseLanguage, deleteBaseLanguage, addBaseLanguageForUser} = require("../controllers/languageController");
router.post("/add", addBaseLanguage);
router.get("/base", getBaseLanguage);
router.delete("/delete", deleteBaseLanguage);
router.post("/addBaseLanguageForUser", addBaseLanguageForUser);

module.exports = router;
