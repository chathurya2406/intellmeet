const mongoose = require("mongoose");

const meetingSchema = new mongoose.Schema(
  {
    roomId: {
      type: String,
      required: true,
    },

    createdBy: {
      type: String,
    },

    participants: [
      {
        type: String,
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Meeting", meetingSchema);