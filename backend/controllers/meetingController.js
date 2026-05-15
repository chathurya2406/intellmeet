const Meeting = require("../models/Meeting");

const createMeeting = async (req, res) => {
  try {
    const { roomId, createdBy } = req.body;

    const meeting = await Meeting.create({
      roomId,
      createdBy,
      participants: [],
    });

    res.status(201).json(meeting);

  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

module.exports = {
  createMeeting,
};