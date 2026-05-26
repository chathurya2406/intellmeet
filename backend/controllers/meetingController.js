const Meeting = require("../models/Meeting");

// CREATE MEETING
const createMeeting = async (req, res) => {
  try {
    const { roomId, createdBy } = req.body;

    const existingMeeting = await Meeting.findOne({
      roomId,
    });

    if (existingMeeting) {
      return res.status(200).json(existingMeeting);
    }

    const meeting = await Meeting.create({
      roomId,
      createdBy,
      participants: [createdBy],
    });

    res.status(201).json(meeting);

  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

// GET ALL MEETINGS
const getMeetings = async (req, res) => {
  try {
    const meetings = await Meeting.find()
      .sort({ createdAt: -1 });

    res.status(200).json(meetings);

  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

module.exports = {
  createMeeting,
  getMeetings,
};