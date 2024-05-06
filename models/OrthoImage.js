const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const orthoImageSchema = new Schema({
  fileUrl: {
    type: String,
    required: true,
  },
  fileName: {
    type: String,
    required: true,
  },
  baseLanguage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "BaseLanguageSchema",
  },
});

module.exports = mongoose.model("orthoImage", orthoImageSchema);
