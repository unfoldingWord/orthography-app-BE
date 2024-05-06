const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const SoundGroupSchema = new Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "userSchema",
    required: true,
  },
  baseLanguage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "BaseLanguageSchema",
    required: true,
  },
  orthoImage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "orthoImageSchema",
    required: true,
  },
});

module.exports = mongoose.model("SoundGroup", SoundGroupSchema);
