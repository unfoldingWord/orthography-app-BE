const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const userSchema = new Schema({
  phoneNumber: {
    type: String,
    required: true,
  },
  phoneCode: {
    type: String,
    required: true,
  },
  videosWatched: {
    type: Boolean,
    default: false,
  },
  baseLanguage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "BaseLanguageSchema",
  },
});

module.exports = mongoose.model("user", userSchema);
