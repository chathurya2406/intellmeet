const Meeting = require("../models/Meeting");
const { getRedisClient } = require("../config/redis");

// CREATE MEETING
const createMeeting = async (req, res) => {
  try {
    const { title, description, meetingCode, date } = req.body;

    const meeting = await Meeting.create({
      title,
      description,
      meetingCode,
      date,
      createdBy: req.user._id,
    });

    res.status(201).json({
      success: true,
      message: "Meeting created successfully",
      meeting,
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Create failed",
    });
  }
};


// GET ALL MEETINGS

const getMeetings = async (req, res) => {
  try {

    const redisClient = getRedisClient();

    // Check Redis cache
    if (redisClient) {

      const cachedMeetings = await redisClient.get("meetings");

      if (cachedMeetings) {
        return res.status(200).json({
          success: true,
          source: "redis cache",
          meetings: JSON.parse(cachedMeetings),
        });
      }
    }

    // Fetch from MongoDB
    const meetings = await Meeting.find();

    // Save to Redis if available
    if (redisClient) {
      await redisClient.set(
        "meetings",
        JSON.stringify(meetings),
        {
          EX: 3600,
        }
      );
    }

    res.status(200).json({
      success: true,
      source: "mongodb",
      meetings,
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Fetch failed",
    });
  }
};


// GET SINGLE MEETING
const getMeetingById = async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id);

    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: "Meeting not found",
      });
    }

    res.status(200).json({
      success: true,
      meeting,
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Fetch failed",
    });
  }
};


// UPDATE MEETING
const updateMeeting = async (req, res) => {
  try {
    const { title, description, date } = req.body;

    const meeting = await Meeting.findById(req.params.id);

    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: "Meeting not found",
      });
    }

    if (title) meeting.title = title;
    if (description) meeting.description = description;
    if (date) meeting.date = date;

    const updatedMeeting = await meeting.save();

    res.status(200).json({
      success: true,
      message: "Meeting updated successfully",
      meeting: updatedMeeting,
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Update failed",
    });
  }
};


// DELETE MEETING
const deleteMeeting = async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id);

    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: "Meeting not found",
      });
    }

    await meeting.deleteOne();

    res.status(200).json({
      success: true,
      message: "Meeting deleted successfully",
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Delete failed",
    });
  }
};


module.exports = {
  createMeeting,
  getMeetings,
  getMeetingById,
  updateMeeting,
  deleteMeeting,
};