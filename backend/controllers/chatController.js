const Chat = require("../models/Chat");

// Send Message
const sendMessage = async (req, res) => {
  try {

    const { meetingId, message } = req.body;

    const chat = await Chat.create({
      meetingId,
      sender: req.user._id,
      message,
    });

    res.status(201).json({
      success: true,
      message: "Message sent successfully",
      chat,
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get Messages
const getMessages = async (req, res) => {
  try {

    const chats = await Chat.find({
      meetingId: req.params.meetingId,
    })
      .populate("sender", "name email")
      .sort({ createdAt: 1 });

    res.status(200).json({
      success: true,
      chats,
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  sendMessage,
  getMessages,
};