const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const syllableSchema = new Schema({
  syllableType: {
    type: Number,
    default: 0,
    required: true,
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "userSchema",
    required: true,
  },
  orthoImage: {
    type: Schema.Types.ObjectId,
    ref: "orthoImageSchema",
    required: true,
  },
  skippedSyllable: {
    type: Boolean,
    default: false,
  },
  soundGroup: {
    type: Schema.Types.ObjectId,
    ref: "soundGroupSchema",
  },
  skippedSoundGroup: {
    type: Boolean,
    default: false,
  },
  grapheme: {
    type: String,
  },

  skippedGrapheme: {
    type: Boolean,
    default: false,
  },
});

module.exports = mongoose.model("syllable", syllableSchema);
