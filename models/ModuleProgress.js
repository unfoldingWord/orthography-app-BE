const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const ModuleProgressSchema = new Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "userSchema",
    required: true,
  },

  module: {
    type: String,
    enum: ["Identify Syllables", "Syllable Groups", "Sound Grouping", "Sound Groups", "Assign Letters", "Letter Groups", "Alphabet Chart"],
  },

  totalImages: {
    type: Number,
    default: 0,
  },

  completedImages: {
    type: Number,
    default: 0,
  },

  incompletedImages: {
    type: Number,
    default: 0,
  },

  percentageCompleted: {
    type: Number,
    default: 0,
    set: v => Math.round(v),
  },

  skippedImages: {
    type: Number,
    default: 0,
  },
  isOpen: {
    type: Boolean,
    default: false,
  },
  baseLanguage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "BaseLanguageSchema",
  },
});

module.exports = mongoose.model("ModuleProgress", ModuleProgressSchema, "moduleprogresses");
