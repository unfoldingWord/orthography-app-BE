require("dotenv").config();
const mongoose = require("mongoose");
const express = require("express");
const app = express();
const cors = require("cors");
const cookieParser = require("cookie-parser");
const bodyParser = require("body-parser");

const PORT = process.env.PORT || 3500;

app.use(cors());
app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());
app.use(express.json());
app.use(cookieParser());

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("Database connected!"))
  .catch(err => console.log(err));

// mongoose.set("debug", (collectionName, method, query, doc) => {
//   console.log(`Mongoose query: ${collectionName}.${method}`, {query, doc});
// });

app.get("/", (req, res) => {
  return res.json("Orthoapp is running here!");
});

app.use("/api/auth", require("./routes/auth"));
app.use("/api/language", require("./routes/language"));
app.use("/api/video", require("./routes/trainingVideo"));
app.use("/api/image", require("./routes/orthoImage"));
app.use("/api/syllable", require("./routes/syllable"));
app.use("/api/progress", require("./routes/moduleProgress"));
app.use("/api/soundGroup", require("./routes/soundGroup"));
app.use("/api/grapheme", require("./routes/grapheme"));
app.use("/api/alphabetChart", require("./routes/alphabetChart"));
app.listen(PORT, () => console.log(`OrthoApp Server is running on ${PORT}!!!!`));
