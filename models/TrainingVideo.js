const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const TrainingVideoSchema = new Schema(
  {
    fileUrl: {
      type: String,
      required: true,
    },
    fileName: {
      type: String,
      required: true,
    },
    title: String,
    description: String,
    status: {
      type: String,
      enum: ["DEFAULT", "PENDING", "COMPLETED"],
      default: "DEFAULT",
    },
    thumbnailFileUrl: {
      type: String,
      required: true,
    },
    thumbnailFileName: {
      type: String,
      required: true,
    },
    baseLanguage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BaseLanguageSchema",
    },
  },
  {timestamps: true}
);

module.exports = mongoose.model("TrainingVideo", TrainingVideoSchema);
