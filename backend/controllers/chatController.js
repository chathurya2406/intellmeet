const Chat = require("../models/Chat");

const getChats = async (req, res) => {
  try {
    const chats = await Chat.find({
      roomId: req.params.roomId,
    }).sort({
      createdAt: 1,
    });

    res.json(chats);
  } catch (err) {
    res.status(500).json({
      message: err.message,
    });
  }
};

module.exports = {
  getChats,
};