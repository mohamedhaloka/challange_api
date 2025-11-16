import mongoose from "mongoose";

const questionSchema = new mongoose.Schema({
  text: { type: String, required: true },
  answers: [{ type: String, required: true }],
  correctIndex: { type: Number, required: true }
});

export default mongoose.model("Question", questionSchema);
